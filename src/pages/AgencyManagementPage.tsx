import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgency, AgencyMember } from '@/contexts/AgencyContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { InviteUserDialog } from '@/components/agencies/InviteUserDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, Users, Shield, Crown, AlertTriangle, Trash2, UserCheck, UserX, UserPlus, Check, ChevronDown } from 'lucide-react';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { useAppTranslation } from '@/hooks/useAppTranslation';

export default function AgencyManagementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentAgency,
    availableAgencies,
    getAgencyMembers,
    removeUserFromAgency,
    transferAgencyOwnership
  } = useAgency();
  const { permissions } = usePermissions();
  const { t } = useAppTranslation();

  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<AgencyMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<string>('');
  const [openNewOwner, setOpenNewOwner] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Ref para evitar recargas múltiples
  const loadingRef = useRef(false);
  const lastAgencyIdRef = useRef<string | null>(null);

  // Verificar si el usuario tiene permisos de admin de agencia
  const hasAccess = permissions.can_access_agency_settings !== false;

  // Determinar el ID de la agencia a gestionar
  const agencyId = useMemo(() => {
    // Si se proporciona un ID en la URL, usarlo; sino, usar la agencia actual
    if (id) {
      // Si es un UUID válido, usarlo directamente
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        return id;
      }
      // Si no es UUID, buscar en las agencias disponibles
      const agency = availableAgencies?.find(a => a.agencyId === id);
      return agency?.agencyId || null;
    }
    return currentAgency?.id || null;
  }, [id, currentAgency?.id, availableAgencies]);

  // Verificar si tiene acceso a esta agencia
  const hasAgencyAccess = useMemo(() => {
    if (!agencyId) return false;
    // Tiene acceso si es la agencia actual o está en sus agencias disponibles
    return currentAgency?.id === agencyId ||
      availableAgencies?.some(a => a.agencyId === agencyId) ||
      false;
  }, [agencyId, currentAgency?.id, availableAgencies]);

  // Verificar permisos y redirigir si es necesario
  useEffect(() => {
    if (!hasAccess) {
      toast.error(t('agencyManagement.toast.noPermission', 'No tienes permisos para acceder a esta página'));
      navigate('/agencies');
      return;
    }

    if (agencyId && !hasAgencyAccess) {
      toast.error(t('agencyManagement.toast.noAccess', 'No tienes acceso a esta agencia'));
      navigate('/agencies');
    }
  }, [hasAccess, hasAgencyAccess, agencyId, navigate, t]);

  // Cargar miembros cuando cambie agencyId
  useEffect(() => {
    if (agencyId === lastAgencyIdRef.current) {
      return;
    }

    if (!agencyId || !hasAccess || !hasAgencyAccess) {
      setIsLoading(false);
      return;
    }

    if (loadingRef.current) {
      return;
    }

    lastAgencyIdRef.current = agencyId;
    loadingRef.current = true;
    setIsLoading(true);

    const loadMembers = async () => {
      try {
        const membersData = await getAgencyMembers(agencyId);
        if (lastAgencyIdRef.current === agencyId) {
          setMembers(membersData);
        }
      } catch (error: any) {
        console.error('[AgencyManagementPage] Error cargando miembros:', error);
        toast.error(error.message || t('agencyManagement.toast.loadError', 'Error al cargar los miembros'));
        setMembers([]);
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    };

    loadMembers();
  }, [agencyId, hasAccess, hasAgencyAccess, getAgencyMembers, t]);

  const handleDelete = (member: AgencyMember) => {
    setMemberToDelete(member);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete || !memberToDelete.userId || !agencyId) return;

    // Validar que no se elimine al último admin
    const adminMembers = members.filter(m => m.isAdmin);
    if (adminMembers.length === 1 && memberToDelete.isAdmin) {
      toast.error(t('agencyManagement.toast.lastAdminError', 'No puedes eliminar al último administrador de la agencia'));
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
      return;
    }

    setIsRemoving(true);
    try {
      const result = await removeUserFromAgency(memberToDelete.userId, agencyId);
      if (result.completelyRemoved) {
        toast.success(t('agencyManagement.toast.userDeleted', 'Usuario eliminado completamente del sistema'));
      } else {
        toast.success(t('agencyManagement.toast.userUnlinked', 'Usuario desvinculado de esta agencia'));
      }
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);

      // Recargar miembros
      lastAgencyIdRef.current = null;
      loadingRef.current = false;
      const membersData = await getAgencyMembers(agencyId);
      setMembers(membersData);
    } catch (error: any) {
      console.error('Error eliminando miembro:', error);
      toast.error(error.message || t('agencyManagement.toast.deleteError', 'Error al eliminar el miembro'));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwnerId || !agencyId) return;

    setIsTransferring(true);
    try {
      await transferAgencyOwnership(selectedNewOwnerId, agencyId);
      toast.success(t('agencyManagement.toast.transferSuccess', 'Propiedad de la agencia transferida correctamente'));
      setIsTransferDialogOpen(false);
      setSelectedNewOwnerId('');

      // Recargar miembros
      lastAgencyIdRef.current = null;
      loadingRef.current = false;
      const membersData = await getAgencyMembers(agencyId);
      setMembers(membersData);
    } catch (error: any) {
      console.error('Error transfiriendo propiedad:', error);
      toast.error(error.message || t('agencyManagement.toast.transferError', 'Error al transferir la propiedad'));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleInviteSuccess = async () => {
    if (!agencyId) return;

    // Recargar miembros
    lastAgencyIdRef.current = null;
    loadingRef.current = false;

    setIsLoading(true);
    try {
      const membersData = await getAgencyMembers(agencyId);
      setMembers(membersData);
    } catch (error: any) {
      console.error('Error recargando miembros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Estadísticas
  const stats = {
    total: members.length,
    active: members.filter(m => m.isActive).length,
    inactive: members.filter(m => !m.isActive).length,
    admins: members.filter(m => m.isAdmin).length,
  };

  const agencyName = currentAgency?.id === agencyId
    ? currentAgency?.name
    : availableAgencies?.find(a => a.agencyId === agencyId)?.agencyName || t('agencyManagement.stats.agencyFallback', 'Agencia');

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agencies')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('agencyManagement.back', 'Volver')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('agencyManagement.title', 'Gestión de Agencia')}</h1>
            <p className="text-slate-600 mt-1">{agencyName}</p>
          </div>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t('agencyManagement.buttons.invite', 'Invitar Usuario')}
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('agencyManagement.stats.total', 'Total miembros')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('agencyManagement.stats.active', 'Activos')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('agencyManagement.stats.admins', 'Administradores')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">{t('agencyManagement.stats.inactive', 'Inactivos')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-400">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de miembros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('agencyManagement.members.title', 'Miembros de la agencia')}
              </CardTitle>
              <CardDescription>
                {t('agencyManagement.members.description', 'Gestiona los miembros de la agencia y sus roles')}
              </CardDescription>
            </div>
            {/* Botón para transferir propiedad - solo si hay más de un miembro */}
            {members.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferDialogOpen(true)}
                className="gap-2"
              >
                <Crown className="h-4 w-4" />
                {t('agencyManagement.buttons.transfer', 'Transferir propiedad')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {t('agencyManagement.members.empty', 'No hay miembros en esta agencia')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('agencyManagement.table.name', 'Nombre')}</TableHead>
                  <TableHead>{t('agencyManagement.table.email', 'Email')}</TableHead>
                  <TableHead>{t('agencyManagement.table.role', 'Rol')}</TableHead>
                  <TableHead>{t('agencyManagement.table.department', 'Departamento')}</TableHead>
                  <TableHead>{t('agencyManagement.table.status', 'Estado')}</TableHead>
                  <TableHead className="text-right">{t('agencyManagement.table.actions', 'Acciones')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.name}
                        {member.isPrimary && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            <Crown className="h-3 w-3 mr-1" />
                            {t('agencyManagement.table.owner', 'Owner')}
                          </Badge>
                        )}
                        {member.isAdmin && !member.isPrimary && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            <Shield className="h-3 w-3 mr-1" />
                            {t('agencyManagement.table.admin', 'Admin')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.role || '-'}</TableCell>
                    <TableCell>{member.department || '-'}</TableCell>
                    <TableCell>
                      {member.isActive ? (
                        <Badge className="bg-green-100 text-green-700">
                          <UserCheck className="h-3 w-3 mr-1" />
                          {t('agencyManagement.table.active', 'Activo')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                          <UserX className="h-3 w-3 mr-1" />
                          {t('agencyManagement.table.inactive', 'Inactivo')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.userId && !member.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agencyManagement.dialogs.deleteTitle', '¿Eliminar miembro de la agencia?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('agencyManagement.dialogs.deleteDesc', { name: memberToDelete?.name, defaultValue: `Esta acción desvinculará a ${memberToDelete?.name} de esta agencia.` })}
              {memberToDelete?.isAdmin && stats.admins === 1 && (
                <span className="block mt-2 text-red-600 font-medium">
                  {t('agencyManagement.dialogs.lastAdminWarning', '⚠️ Este es el último administrador. No puedes eliminarlo.')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{t('common.cancel', 'Cancelar')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isRemoving || (memberToDelete?.isAdmin && stats.admins === 1)}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('agencyManagement.buttons.deleting', 'Eliminando...')}
                </>
              ) : (
                t('agencyManagement.buttons.delete', 'Eliminar de la Agencia')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de transferencia de propiedad */}
      <AlertDialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              {t('agencyManagement.dialogs.transferTitle', 'Transferir propiedad de la agencia')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('agencyManagement.dialogs.transferDesc', 'Selecciona el nuevo propietario de la agencia. El propietario actual perderá sus privilegios de propietario.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              {t('agencyManagement.dialogs.newOwnerLabel', 'Nuevo propietario')}
            </label>
            <Popover open={openNewOwner} onOpenChange={setOpenNewOwner}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">{selectedNewOwnerId ? (members.find(m => m.userId === selectedNewOwnerId)?.name ?? t('agencyManagement.dialogs.selectMember', 'Selecciona un miembro')) : t('agencyManagement.dialogs.selectMember', 'Selecciona un miembro')}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandList className="max-h-[280px]">
                    <CommandGroup>
                      {members
                        .filter(m => m.isActive && m.userId && !m.isPrimary)
                        .map(member => (
                          <CommandItem key={member.id} value={member.name || member.userId || ''} onSelect={() => { setSelectedNewOwnerId(member.userId || ''); setOpenNewOwner(false); }}>
                            <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedNewOwnerId === (member.userId || '') ? 'opacity-100' : 'opacity-0')} />
                            <div className="flex items-center gap-2">
                              {member.name}
                              {member.isAdmin && (
                                <Badge variant="outline" className="text-xs">
                                  {t('agencyManagement.table.admin', 'Admin')}
                                </Badge>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedNewOwnerId && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">{t('agencyManagement.dialogs.warningTitle', 'Advertencia')}</p>
                    <p>{t('agencyManagement.dialogs.warningDesc', 'Esta acción transferirá la propiedad de la agencia al miembro seleccionado.')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>{t('common.cancel', 'Cancelar')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={isTransferring || !selectedNewOwnerId}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('agencyManagement.buttons.transferring', 'Transfiriendo...')}
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  {t('agencyManagement.buttons.transfer', 'Transferir propiedad')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de invitación */}
      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
