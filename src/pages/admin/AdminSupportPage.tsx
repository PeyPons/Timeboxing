import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SupportMessageEditor } from "@/components/support/SupportMessageEditor";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquarePlus, Eye } from "lucide-react";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { toast } from "@/lib/notify";
import { SupportMessageContent } from "@/components/support/SupportMessageContent";

interface SupportTicketRow {
  id: string;
  agency_id: string;
  agency_name: string;
  reporter_user_id: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AgencyOption {
  id: string;
  name: string;
}

interface TicketDetail {
  id: string;
  agency_id: string;
  agency_name: string;
  reporter_user_id: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  author_user_id?: string;
  author_display?: string | null;
  message: string;
  created_at: string;
  is_internal?: boolean;
}

export default function AdminSupportPage() {
  const { t } = useAppTranslation();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [createSubject, setCreateSubject] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createAgencyId, setCreateAgencyId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [createMessageKey, setCreateMessageKey] = useState(0);
  const [replyKey, setReplyKey] = useState(0);
  const [replyIsInternal, setReplyIsInternal] = useState(true);
  const [addingReply, setAddingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_support_tickets", {
        p_status: statusFilter === "all" ? null : statusFilter,
        p_agency_id: agencyFilter === "all" ? null : agencyFilter,
      });
      if (error) throw error;
      setTickets((data as SupportTicketRow[]) || []);
    } catch (e: unknown) {
      console.error("[AdminSupportPage] Error listing tickets:", e);
      toast.error(t("admin.support.errLoad", "Error al cargar tickets"));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, agencyFilter, t]);

  const fetchAgencies = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("admin_list_agencies", {
        p_search: null,
        p_status: null,
      });
      if (error) throw error;
      const list = (data as { id: string; name: string }[]) || [];
      setAgencies(list.map((a) => ({ id: a.id, name: a.name })));
      if (list.length > 0 && !createAgencyId) setCreateAgencyId(list[0].id);
    } catch (e) {
      console.warn("[AdminSupportPage] Error loading agencies:", e);
    }
  }, [createAgencyId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  useEffect(() => {
    if (!selectedTicketId) {
      setTicketDetail(null);
      setReplies([]);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    (async () => {
      try {
        const [ticketRes, repliesRes] = await Promise.all([
          supabase.rpc("admin_get_support_ticket", { p_ticket_id: selectedTicketId }),
          supabase.rpc("admin_list_support_ticket_replies", { p_ticket_id: selectedTicketId }),
        ]);
        if (cancelled) return;
        if (ticketRes.error) throw ticketRes.error;
        if (repliesRes.error) throw repliesRes.error;
        const ticketRow = (ticketRes.data as unknown[])?.[0];
        setTicketDetail(ticketRow ? (ticketRow as TicketDetail) : null);
        setReplies((repliesRes.data as TicketReply[]) || []);
      } catch (e) {
        if (!cancelled) {
          console.error("[AdminSupportPage] Error loading ticket detail:", e);
          toast.error(t("admin.support.errLoadTicket", "Error al cargar el ticket"));
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTicketId, t]);

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    try {
      const { error } = await supabase.rpc("admin_update_support_ticket_status", {
        p_ticket_id: ticketId,
        p_status: newStatus,
      });
      if (error) throw error;
      toast.success(t("admin.support.statusUpdated", "Estado actualizado"));
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (e: unknown) {
      console.error("[AdminSupportPage] Error updating status:", e);
      toast.error(t("admin.support.errUpdateStatus", "Error al actualizar estado"));
    } finally {
      setUpdatingId(null);
    }
  };

  const addReply = async () => {
    if (!selectedTicketId || !replyMessage?.trim()) {
      toast.error(t("admin.support.writeMessage", "Escribe un mensaje"));
      return;
    }
    setAddingReply(true);
    try {
      const { error } = await supabase.rpc("admin_add_support_ticket_reply", {
        p_ticket_id: selectedTicketId,
        p_message: replyMessage.trim(),
        p_internal: replyIsInternal,
      });
      if (error) throw error;
      toast.success(replyIsInternal ? t("admin.support.internalReplyAdded", "Comentario interno añadido") : t("admin.support.replyAdded", "Respuesta enviada al usuario"));
      setReplyMessage("");
      setReplyKey((k) => k + 1);
      const { data } = await supabase.rpc("admin_list_support_ticket_replies", {
        p_ticket_id: selectedTicketId,
      });
      setReplies((data as TicketReply[]) || []);
    } catch (e: unknown) {
      console.error("[AdminSupportPage] Error adding reply:", e);
      toast.error(t("admin.support.errAddReply", "Error al añadir respuesta"));
    } finally {
      setAddingReply(false);
    }
  };

  const updateStatusFromDetail = async (newStatus: string) => {
    if (!ticketDetail) return;
    setUpdatingId(ticketDetail.id);
    try {
      const { error } = await supabase.rpc("admin_update_support_ticket_status", {
        p_ticket_id: ticketDetail.id,
        p_status: newStatus,
      });
      if (error) throw error;
      toast.success(t("admin.support.statusUpdated", "Estado actualizado"));
      setTicketDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketDetail.id ? { ...t, status: newStatus } : t))
      );
    } catch (e: unknown) {
      console.error("[AdminSupportPage] Error updating status:", e);
      toast.error(t("admin.support.errUpdateStatus", "Error al actualizar estado"));
    } finally {
      setUpdatingId(null);
    }
  };

  const createTicket = async () => {
    if (!createAgencyId?.trim() || !createSubject?.trim() || !createMessage?.trim()) {
      toast.error(t("admin.support.allFieldsReq", "Agencia, asunto y mensaje son obligatorios"));
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_support_ticket", {
        p_agency_id: createAgencyId,
        p_subject: createSubject.trim(),
        p_message: createMessage.trim(),
      });
      if (error) throw error;
      toast.success(t("admin.support.ticketCreated", "Ticket creado"));
      setCreateSubject("");
      setCreateMessage("");
      setCreateMessageKey((k) => k + 1);
      setFormOpen(false);
      fetchTickets();
    } catch (e: unknown) {
      console.error("[AdminSupportPage] Error creating ticket:", e);
      toast.error(t("admin.support.errCreateTicket", "Error al crear ticket"));
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const statusLabel: Record<string, string> = {
    open: t("admin.support.statusOpen", "Abierto"),
    in_progress: t("admin.support.statusInProgress", "En curso"),
    closed: t("admin.support.statusClosed", "Cerrado"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("admin.support.title", "Soporte")}</h1>
          <p className="text-slate-600 mt-1">
            {t('admin.support.subtitle')}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          {t('admin.support.newTicket')}
        </Button>
      </div>

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.support.createTitle", "Crear ticket")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">{t("common.agency", "Agencia")}</label>
              <Select value={createAgencyId} onValueChange={setCreateAgencyId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("admin.support.selectAgency", "Seleccionar agencia")} />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t("admin.support.subject", "Asunto")}</label>
              <Input
                value={createSubject}
                onChange={(e) => setCreateSubject(e.target.value)}
                placeholder={t("admin.support.subjectPlaceholder", "Asunto del ticket")}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t("common.message", "Mensaje")}</label>
              <SupportMessageEditor
                key={createMessageKey}
                value={createMessage}
                onChange={setCreateMessage}
                placeholder={t('admin.support.createMessagePlaceholder')}
                minHeight="120px"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createTicket} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.support.filterStatusAll')}</SelectItem>
                <SelectItem value="open">{t('admin.support.filterStatusOpen')}</SelectItem>
                <SelectItem value="in_progress">{t('admin.support.filterStatusInProgress')}</SelectItem>
                <SelectItem value="closed">{t('admin.support.filterStatusClosed')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("common.agency", "Agencia")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.support.allAgencies')}</SelectItem>
                {agencies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('admin.support.noTickets')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.agency", "Agencia")}</TableHead>
                  <TableHead>{t("admin.support.subject", "Asunto")}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.createdAt')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.agency_name}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={ticket.subject}>
                        {ticket.subject}
                      </div>
                      {ticket.message && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]" title={ticket.message}>
                          {ticket.message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.status === "closed"
                            ? "secondary"
                            : ticket.status === "in_progress"
                              ? "default"
                              : "outline"
                        }
                      >
                        {statusLabel[ticket.status] ?? ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ticket.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setSelectedTicketId(ticket.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                        <Select
                          value={ticket.status}
                          onValueChange={(v) => updateStatus(ticket.id, v)}
                          disabled={updatingId === ticket.id}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            {updatingId === ticket.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">{t('admin.support.statusOpen')}</SelectItem>
                            <SelectItem value="in_progress">{t('admin.support.statusInProgress')}</SelectItem>
                            <SelectItem value="closed">{t('admin.support.statusClosed')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("admin.support.detailTitle", "Detalle del ticket")}</SheetTitle>
          </SheetHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : ticketDetail ? (
            <div className="space-y-6 mt-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-slate-500">{t("common.agency", "Agencia")}</span>
                  <span className="font-medium text-slate-900">{ticketDetail.agency_name}</span>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-0.5">{t("admin.support.subject", "Asunto")}</p>
                  <p className="font-medium text-slate-900">{ticketDetail.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-0.5">{t("admin.support.initialMessage", "Mensaje inicial")}</p>
                  <SupportMessageContent content={ticketDetail.message} />
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                  <Select
                    value={ticketDetail.status}
                    onValueChange={updateStatusFromDetail}
                    disabled={updatingId === ticketDetail.id}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      {updatingId === ticketDetail.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t('admin.support.statusOpen')}</SelectItem>
                      <SelectItem value="in_progress">{t('admin.support.statusInProgress')}</SelectItem>
                      <SelectItem value="closed">{t('admin.support.statusClosed')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-500">
                    {t('admin.support.createdAt', { date: formatDate(ticketDetail.created_at) })}
                    {ticketDetail.updated_at !== ticketDetail.created_at && (
                      <> · {t('admin.support.updatedAt', { date: formatDate(ticketDetail.updated_at) })}</>
                    )}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">{t('admin.support.conversation')}</h3>
                {replies.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">{t("admin.support.noReplies", "Sin comentarios aún.")}</p>
                ) : (
                  <ul className="space-y-4 mb-5">
                    {replies.map((r) => (
                      <li
                        key={r.id}
                        className={`flex gap-3 rounded-lg border p-3 text-sm ${r.is_internal
                          ? "border-amber-200 bg-amber-50/50"
                          : "border-primary/20 bg-primary/5"
                          }`}
                      >
                        <Avatar className="h-8 w-8 shrink-0 border border-slate-200">
                          <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                            {(r.author_display || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900">
                              {r.author_display || t('common.user')}
                            </span>
                            <Badge
                              variant={r.is_internal ? "secondary" : "default"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {r.is_internal ? t('admin.support.replyBadgeInternal') : t('admin.support.replyBadgeUser')}
                            </Badge>
                            <span className="text-xs text-slate-500">{formatDate(r.created_at)}</span>
                          </div>
                          <SupportMessageContent content={r.message} className="text-slate-700 text-sm" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                  <SupportMessageEditor
                    key={replyKey}
                    value={replyMessage}
                    onChange={setReplyMessage}
                    placeholder={replyIsInternal ? t("admin.support.internalNotePlaceholder", "Nota interna (solo visible para admin)…") : t("admin.support.replyPlaceholder", "Respuesta visible para la agencia…")}
                    minHeight="100px"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replyIsInternal}
                        onChange={(e) => setReplyIsInternal(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t('admin.support.internalOnlyLabel')}
                    </label>
                    <Button size="sm" onClick={addReply} disabled={addingReply || !replyMessage?.trim()}>
                      {addingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : replyIsInternal ? t("admin.support.sendInternal", "Enviar comentario interno") : t("admin.support.sendReply", "Enviar respuesta al usuario")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 py-8">{t('admin.support.loadTicketFailed')}</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
