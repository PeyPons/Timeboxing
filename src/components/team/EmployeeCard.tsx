import { memo, useState } from 'react';
import { Employee } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScheduleEditor } from './ScheduleEditor';
import { MoreHorizontal, Mail, Phone, Building2, Clock, UserCog, UserCheck, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { getValidRole, getValidDepartment, translateRoleLabel } from '@/utils/roleUtils';
import { normalizeDepartments } from '@/utils/departmentUtils';
import { toast } from '@/lib/notify';
import { SensitiveText } from '@/components/privacy/SensitiveText';

interface EmployeeCardProps {
  employee: Employee;
}

export const EmployeeCard = memo(function EmployeeCard({ employee }: EmployeeCardProps) {
  const { deleteEmployee, toggleEmployeeActive } = useApp();
  const { currentAgency } = useAgency();
  const { t } = useAppTranslation();
  
  // Obtener roles y departamentos disponibles
  const availableRoles = currentAgency?.settings?.roles || [];
  const availableDepartments = normalizeDepartments(currentAgency?.settings?.departments);
  const displayRole = translateRoleLabel(
    getValidRole(employee, availableRoles),
    (key, fallback) => t(key, { defaultValue: fallback ?? key }),
  );
  const displayDepartment = getValidDepartment(employee, availableDepartments.length ? availableDepartments : undefined);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await deleteEmployee(employee.id);
    if (ok) {
      toast.success(t('team.employeeCard.deleteSuccess', 'Empleado eliminado'));
    } else {
      toast.error(t('team.employeeCard.deleteError', 'No se pudo eliminar el empleado'));
    }
    setShowDeleteConfirm(false);
  };

  const handleToggleActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEmployeeActive(employee.id);
    toast.success(employee.isActive
      ? t('team.employeeCard.deactivated', 'Employee deactivated')
      : t('team.employeeCard.activated', 'Employee activated'));
  };

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-md ${!employee.isActive ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
          <AvatarImage src={employee.avatarUrl} alt={employee.name} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
            {employee.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <CardTitle className="text-base font-bold truncate text-slate-900">
            <SensitiveText kind="employee" id={employee.id}>{employee.name}</SensitiveText>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
              {displayRole}
            </Badge>
            {displayDepartment && (
              <span className="flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" />{' '}
                <SensitiveText kind="department" id={`${employee.id}|${displayDepartment}`}>{displayDepartment}</SensitiveText>
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('team.employeeCard.actions', 'Actions')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleToggleActive}>
              {employee.isActive ? <><UserX className="mr-2 h-4 w-4" /> {t('team.employeeCard.deactivate', 'Deactivate')}</> : <><UserCheck className="mr-2 h-4 w-4" /> {t('team.employeeCard.activate', 'Activate')}</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDeleteClick}>
              <UserCog className="mr-2 h-4 w-4" /> {t('team.employeeCard.delete', 'Remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="grid gap-4 text-xs pt-2">
        {/* Contacto */}
        <div className="flex flex-col gap-1 text-slate-500">
          {employee.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              <span className="truncate">{employee.email}</span>
            </div>
          )}
        </div>

        {/* Horario - MODO LECTURA (Aquí está el cambio clave) */}
        {employee.workSchedule && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-medium">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Horario Semanal</span>
            </div>
            <div className="pointer-events-none"> {/* Bloqueo extra por seguridad */}
              <ScheduleEditor
                schedule={employee.workSchedule}
                readOnly={true} // <--- ESTO LO HACE SOLO LECTURA
                onChange={() => { }}
              />
            </div>
          </div>
        )}
      </CardContent>


      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al empleado "
              <SensitiveText kind="employee" id={employee.id}>{employee.name}</SensitiveText>
              " y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card >
  );
});
