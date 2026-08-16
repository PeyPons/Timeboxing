import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserPlus, Trash2, Shield } from "lucide-react";
import { toast } from "@/lib/notify";

interface PlatformAdminRow {
  user_id: string;
  email: string | null;
  role: string;
  created_at: string;
}

export default function AdminAdminsPage() {
  const { t } = useAppTranslation();
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("admin");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_platform_admins");
      if (error) throw error;
      setAdmins((data as PlatformAdminRow[]) || []);
    } catch (e: unknown) {
      console.error("[AdminAdminsPage] Error listing admins:", e);
      toast.error(t("admin.admins.errLoad", "Error al cargar administradores"));
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const email = addEmail.trim().toLowerCase();
    if (!email) {
      toast.error(t("admin.admins.errEmail", "Indica un email"));
      return;
    }
    setAdding(true);
    try {
      const body: { email: string; role: string; password?: string; name?: string } = {
        email,
        role: addRole || "admin",
      };
      if (addPassword.trim()) body.password = addPassword;
      if (addName.trim()) body.name = addName;
      const { data, error } = await supabase.functions.invoke("add-platform-admin", { body });
      if (error) {
        const bodyMsg = (data as { error?: string } | null)?.error;
        const msg = bodyMsg ?? error.message ?? "Error al invocar la función";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(t("admin.admins.successAdd", "Administrador añadido correctamente"));
      setAddOpen(false);
      setAddEmail("");
      setAddPassword("");
      setAddName("");
      setAddRole("admin");
      fetchAdmins();
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : t("admin.admins.errAdd", "Error al añadir");
      if (
        msg.includes("500") ||
        msg.toLowerCase().includes("internal server error") ||
        msg.toLowerCase().includes("failed to fetch")
      ) {
        msg += t("admin.admins.errServer", " Revisa en el servidor: docker logs supabase-edge-functions");
      }
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      const { error } = await supabase.rpc("admin_remove_platform_admin", {
        p_user_id: userId,
      });
      if (error) throw error;
      toast.success(t("admin.admins.successRemove", "Administrador quitado del panel"));
      fetchAdmins();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("admin.admins.errRemove", "Error al quitar");
      toast.error(msg);
    } finally {
      setRemovingId(null);
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

  const isCurrentUser = (userId: string) => currentUser?.id === userId;
  const canRemove = admins.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administradores de plataforma</h1>
        <p className="text-slate-600 mt-1">
          Usuarios con acceso al panel /admin, sin vinculación a ninguna agencia. Puedes añadir por email (si ya existe) o crear una cuenta nueva indicando email y contraseña.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={fetchAdmins} disabled={loading}>
                Actualizar
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <UserPlus className="h-4 w-4" />
                    Añadir administrador
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.admins.addBtn", "Añadir administrador")}</DialogTitle>
                    <DialogDescription>
                      Si indicas contraseña, se creará la cuenta (el usuario podrá entrar con ese email y contraseña). Si no, el usuario debe existir ya en el sistema.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAdd}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="admin-email">{t("common.email", "Email")}</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          autoComplete="email"
                          placeholder={t("admin.admins.emailPlaceholder", "usuario@ejemplo.com")}
                          value={addEmail}
                          onChange={(e) => setAddEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="admin-password">{t("admin.admins.pwdOptional", "Contraseña (opcional)")}</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={t("admin.admins.pwdPlaceholder", "Mín. 6 caracteres para crear cuenta nueva")}
                          value={addPassword}
                          onChange={(e) => setAddPassword(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="admin-name">{t("admin.admins.nameOptional", "Nombre (opcional)")}</Label>
                        <Input
                          id="admin-name"
                          type="text"
                          autoComplete="name"
                          placeholder={t("admin.admins.namePlaceholder", "Nombre para mostrar")}
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="admin-role">{t("admin.admins.roleOptional", "Rol (opcional)")}</Label>
                        <Input
                          id="admin-role"
                          placeholder="admin"
                          value={addRole}
                          onChange={(e) => setAddRole(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={adding || !addEmail.trim()}>
                        {adding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t("common.add", "Añadir")
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : admins.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No hay administradores listados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t("common.email", "Email")}</TableHead>
                  <TableHead>{t("common.role", "Rol")}</TableHead>
                  <TableHead>{t("admin.admins.createdAt", "Fecha alta")}</TableHead>
                  <TableHead className="text-right">{t("common.actions", "Acciones")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.user_id}>
                    <TableCell>
                      <Shield className="h-4 w-4 text-amber-500" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {admin.email || (
                        <span className="text-slate-400">ID: {admin.user_id.slice(0, 8)}…</span>
                      )}
                      {isCurrentUser(admin.user_id) && (
                        <span className="ml-2 text-xs text-slate-500">{t("admin.admins.you", "(tú)")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{admin.role}</TableCell>
                    <TableCell className="text-slate-500">{formatDate(admin.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {canRemove && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemove(admin.user_id)}
                          disabled={removingId === admin.user_id || isCurrentUser(admin.user_id)}
                          title={
                            isCurrentUser(admin.user_id)
                              ? t("admin.admins.cannotRemoveSelf", "No puedes quitarte a ti mismo")
                              : t("admin.admins.removeAccess", "Quitar acceso de administrador")
                          }
                        >
                          {removingId === admin.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Quitar
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
