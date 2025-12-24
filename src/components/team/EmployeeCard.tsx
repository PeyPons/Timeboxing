import { Employee } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Mail, Briefcase, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
}

export function EmployeeCard({ employee, onEdit }: EmployeeCardProps) {
  const { toggleEmployeeActive, deleteEmployee } = useApp();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${!employee.isActive ? 'opacity-60 grayscale' : ''}`}>
      <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={employee.avatarUrl} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
              {getInitials(employee.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm leading-none">{employee.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {employee.role}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(employee)}>
              Editar detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleEmployeeActive(employee.id)}>
              {employee.isActive ? 'Desactivar' : 'Activar'}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => deleteEmployee(employee.id)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {/* Email Section - Critical for Login Linking */}
        <div className="text-xs flex items-center gap-2 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-1.5 rounded border">
            <Mail className="h-3.5 w-3.5 text-indigo-500" />
            <span className="truncate" title={employee.email}>
                {employee.email || "Sin email vinculado"}
            </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Briefcase className="h-3.5 w-3.5" />
            <span>{employee.department}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{employee.defaultWeeklyCapacity}h/sem</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
           <Badge variant={employee.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
             {employee.isActive ? 'Activo' : 'Inactivo'}
           </Badge>
           {employee.hourlyRate && employee.hourlyRate > 0 && (
               <Badge variant="outline" className="text-[10px] h-5 border-emerald-200 text-emerald-700 bg-emerald-50">
                   {employee.hourlyRate}€/h
               </Badge>
           )}
        </div>
      </CardContent>
    </Card>
  );
}
