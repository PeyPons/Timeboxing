import { useState, useEffect, useCallback } from "react";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, Pause, Play, LogIn, CreditCard, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PLAN_DISPLAY_NAMES, PLAN_IDS, type PlanId } from "@/config/plans";

interface AgencyRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  setup_completed: boolean;
  created_at: string;
  employees_count: number;
  projects_count: number;
  plan_id?: string;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

/** Mensaje legible cuando invoke devuelve 4xx/5xx (el body va en error.context, no en data). */
function parseEdgeFunctionError(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "context" in e) {
    const ctx = (e as { context?: { body?: unknown; status?: number } }).context;
    if (ctx?.body) {
      try {
        const body =
          typeof ctx.body === "string" ? JSON.parse(ctx.body) : (ctx.body as Record<string, unknown>);
        if (typeof body?.error === "string") return body.error;
      } catch {
        /* ignore */
      }
    }
  }
  return e instanceof Error ? e.message : fallback;
}

export default function AdminAgenciesPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [settingPlanId, setSettingPlanId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<AgencyRow | null>(null);
  const [purgeSlugConfirm, setPurgeSlugConfirm] = useState("");
  const [purgingId, setPurgingId] = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_agencies", {
        p_search: search || null,
        p_status: statusFilter === "all" ? null : statusFilter,
      });
      if (error) throw error;
      setAgencies((data as AgencyRow[]) || []);
    } catch (e: unknown) {
      console.error("[AdminAgenciesPage] Error listing agencies:", e);
      toast.error(t("admin.agencies.errLoad", "Error al cargar agencias"));
      setAgencies([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, t]);

  const filteredAgencies = planFilter === "all"
    ? agencies
    : agencies.filter((a) => (a.plan_id ?? "starter") === planFilter);

  const setAgencyPlan = async (agencyId: string, planId: PlanId) => {
    setSettingPlanId(agencyId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error(t("admin.agencies.errAuth", "Debes iniciar sesión"));
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-set-agency-plan", {
        body: { agency_id: agencyId, plan_id: planId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));

      const appliedPlan = (data?.plan_id as PlanId | undefined) ?? planId;
      const displayName = PLAN_DISPLAY_NAMES[appliedPlan] ?? appliedPlan;
      if (data?.warning) {
        toast.warning(String(data.warning));
      }
      toast.success(
        data?.stripe_synced
          ? `Plan ${displayName} (sincronizado con Stripe)`
          : `Plan actualizado a ${displayName}`,
      );

      setAgencies((prev) =>
        prev.map((a) =>
          a.id === agencyId
            ? {
                ...a,
                plan_id: appliedPlan,
                subscription_status:
                  appliedPlan === "starter" ? "active" : a.subscription_status,
                trial_ends_at: appliedPlan === "starter" ? null : a.trial_ends_at,
              }
            : a,
        ),
      );
      void fetchAgencies();
    } catch (e: unknown) {
      console.error("[AdminAgenciesPage] Error setting plan:", e);
      toast.error(
        parseEdgeFunctionError(e, t("admin.agencies.errPlan", "Error al cambiar plan")),
      );
    } finally {
      setSettingPlanId(null);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  const updateStatus = async (agencyId: string, newStatus: "active" | "suspended") => {
    setUpdatingId(agencyId);
    try {
      const { error } = await supabase.rpc("admin_update_agency_status", {
        p_agency_id: agencyId,
        p_status: newStatus,
      });
      if (error) throw error;
      toast.success(newStatus === "suspended" ? t("admin.agencies.suspendedSuccess", "Agencia suspendida") : t("admin.agencies.reactivated", "Agencia reactivada"));
      setAgencies((prev) =>
        prev.map((a) => (a.id === agencyId ? { ...a, status: newStatus } : a))
      );
    } catch (e: unknown) {
      console.error("[AdminAgenciesPage] Error updating status:", e);
      toast.error(t("admin.agencies.errStatus", "Error al actualizar estado"));
    } finally {
      setUpdatingId(null);
    }
  };

  const executePurgeAgency = async () => {
    if (!purgeTarget || purgeSlugConfirm.trim() !== purgeTarget.slug) return;
    setPurgingId(purgeTarget.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-agency", {
        body: { agencyId: purgeTarget.id },
      });
      if (error) {
        const bodyMsg = (data as { error?: string } | null)?.error;
        throw new Error(bodyMsg ?? error.message ?? "Error al invocar la función");
      }
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }
      toast.success(
        t("admin.agencies.purgeSuccess", "Agencia eliminada permanentemente de la base de datos")
      );
      setPurgeTarget(null);
      setPurgeSlugConfirm("");
      await fetchAgencies();
    } catch (e: unknown) {
      console.error("[AdminAgenciesPage] purge agency:", e);
      toast.error(
        e instanceof Error ? e.message : t("admin.agencies.purgeError", "No se pudo eliminar la agencia")
      );
    } finally {
      setPurgingId(null);
    }
  };

  const accessAsAgency = async (agencyId: string) => {
    setImpersonatingId(agencyId);
    try {
      const { error } = await supabase.rpc("admin_impersonate_agency", {
        p_agency_id: agencyId,
      });
      if (error) throw error;
      toast.success(t("admin.agencies.redirecting", "Redirigiendo a la app con la agencia seleccionada"));
      navigate(`/planner?agency=${agencyId}`);
    } catch (e: unknown) {
      console.error("[AdminAgenciesPage] Error accediendo como agencia:", e);
      toast.error(t("admin.agencies.errImpersonate", "No se pudo acceder como esta agencia"));
    } finally {
      setImpersonatingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatTrialEnd = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const planLabel = (planId: string | undefined) =>
    PLAN_DISPLAY_NAMES[(planId ?? "starter") as PlanId] ?? planId ?? "Free";

  const subscriptionLabel = (s: string | null | undefined) => {
    if (!s) return "—";
    const map: Record<string, string> = {
      active: t("admin.agencies.active", "Activa"),
      trialing: "Prueba",
      past_due: "Pago pendiente",
      canceled: "Cancelada",
      incomplete: "Incompleta",
      incomplete_expired: "Expirada",
    };
    return map[s] ?? s;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.agencies.pageTitle')}</h1>
        <p className="text-slate-600 mt-1">
          {t('admin.agencies.pageSubtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("admin.agencies.searchPlaceholder", "Buscar por nombre o slug...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('common.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.agencies.filterStatusAll')}</SelectItem>
                  <SelectItem value="active">{t('admin.agencies.filterStatusActive')}</SelectItem>
                  <SelectItem value="suspended">{t('admin.agencies.filterStatusSuspended')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder={t('common.plan')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.agencies.filterPlanAll')}</SelectItem>
                  {PLAN_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PLAN_DISPLAY_NAMES[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAgencies} disabled={loading}>
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : agencies.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('admin.agencies.emptySearch')}</p>
          ) : filteredAgencies.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('admin.agencies.emptyPlanFilter')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name", "Nombre")}</TableHead>
                  <TableHead>{t("common.slug", "Slug")}</TableHead>
                  <TableHead>{t("common.status", "Estado")}</TableHead>
                  <TableHead>{t("common.plan", "Plan")}</TableHead>
                  <TableHead>{t("common.subscription", "Suscripción")}</TableHead>
                  <TableHead>{t("admin.agencies.trialEnd", "Trial hasta")}</TableHead>
                  <TableHead>{t("admin.agencies.setup", "Setup")}</TableHead>
                  <TableHead>{t("admin.agencies.employees", "Empleados")}</TableHead>
                  <TableHead>{t("admin.agencies.projects", "Proyectos")}</TableHead>
                  <TableHead>{t("common.createdAt", "Creación")}</TableHead>
                  <TableHead className="text-right">{t("common.actions", "Acciones")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">{agency.name}</TableCell>
                    <TableCell className="text-slate-600">{agency.slug}</TableCell>
                    <TableCell>
                      <Badge variant={agency.status === "suspended" ? "destructive" : "default"}>
                        {agency.status === "suspended" ? t("admin.agencies.suspended", "Suspendida") : t("admin.agencies.active", "Activa")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{planLabel(agency.plan_id)}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {subscriptionLabel(agency.subscription_status)}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {formatTrialEnd(agency.trial_ends_at)}
                    </TableCell>
                    <TableCell>
                      {agency.setup_completed ? (
                        <span className="text-green-600">{t("admin.agencies.completed", "Completado")}</span>
                      ) : (
                        <span className="text-amber-600">{t("common.pending", "Pendiente")}</span>
                      )}
                    </TableCell>
                    <TableCell>{agency.employees_count}</TableCell>
                    <TableCell>{agency.projects_count}</TableCell>
                    <TableCell className="text-slate-500">{formatDate(agency.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={settingPlanId === agency.id}
                              title="Forzar plan (soporte)"
                            >
                              {settingPlanId === agency.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CreditCard className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {PLAN_IDS.map((id) => (
                              <DropdownMenuItem
                                key={id}
                                onClick={() => setAgencyPlan(agency.id, id)}
                              >
                                Forzar {PLAN_DISPLAY_NAMES[id]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() => accessAsAgency(agency.id)}
                          disabled={impersonatingId === agency.id}
                          title={t("admin.agencies.impersonate", "Ver la app como si fueras de esta agencia")}
                        >
                          {impersonatingId === agency.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <LogIn className="h-4 w-4" />
                              {t("common.enter", "Entrar")}
                            </>
                          )}
                        </Button>
                        {agency.status === "suspended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(agency.id, "active")}
                            disabled={updatingId === agency.id}
                          >
                            {updatingId === agency.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Reactivar
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => updateStatus(agency.id, "suspended")}
                            disabled={updatingId === agency.id}
                          >
                            {updatingId === agency.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Pause className="h-4 w-4 mr-1" />
                                Suspender
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title={t(
                            "admin.agencies.purgeTitle",
                            "Eliminar agencia y todos sus datos (irreversible)"
                          )}
                          onClick={() => {
                            setPurgeTarget(agency);
                            setPurgeSlugConfirm("");
                          }}
                          disabled={purgingId === agency.id}
                        >
                          {purgingId === agency.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPurgeTarget(null);
            setPurgeSlugConfirm("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.agencies.purgeDialogTitle", "Eliminar agencia para siempre")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  {t(
                    "admin.agencies.purgeDialogBody",
                    "Se cancelará la suscripción en Stripe si existe, y se borrarán empleados, proyectos, asignaciones y el resto de datos de esta agencia. No hay vuelta atrás."
                  )}
                </p>
                {purgeTarget && (
                  <p className="font-medium text-slate-800">
                    {t("admin.agencies.purgeConfirmSlug", "Escribe el slug de la agencia para confirmar:")}{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5">{purgeTarget.slug}</code>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="purge-slug-confirm" className="sr-only">
              Slug
            </Label>
            <Input
              id="purge-slug-confirm"
              value={purgeSlugConfirm}
              onChange={(e) => setPurgeSlugConfirm(e.target.value)}
              placeholder={purgeTarget?.slug ?? "slug"}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgingId !== null}>
              {t("common.cancel", "Cancelar")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                purgingId !== null ||
                !purgeTarget ||
                purgeSlugConfirm.trim() !== purgeTarget.slug
              }
              onClick={() => void executePurgeAgency()}
            >
              {purgingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("admin.agencies.purgeConfirm", "Eliminar permanentemente")
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
