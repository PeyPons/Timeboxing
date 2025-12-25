import { Employee } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

interface EmployeeCardProps {
  employee: Employee;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { deleteEmployee, toggleEmployeeActive } = useApp();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este empleado?')) {
      deleteEmployee(employee.id);
      toast.success("Empleado eliminado");
    }
  };

  const handleToggleActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEmployeeActive(employee.id);
    toast.success(employee.isActive ? "Empleado desactivado" : "Empleado activado");
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
            {employee.name}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
              {employee.role}
            </Badge>
            {employee.department && (
              <span className="flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" /> {employee.department}
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
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleToggleActive}>
              {employee.isActive ? <><UserX className="mr-2 h-4 w-4" /> Desactivar</> : <><UserCheck className="mr-2 h-4 w-4" /> Activar</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDelete}>
              <UserCog className="mr-2 h-4 w-4" /> Eliminar
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
                        onChange={() => {}} 
                    />
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
