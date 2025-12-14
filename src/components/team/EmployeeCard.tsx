import { Employee } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Mail, Phone, CalendarClock, Briefcase } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onManageGoals: (employee: Employee) => void;
  onManageAbsences: (employee: Employee) => void;
}

export default function EmployeeCard({ employee, onEdit, onManageGoals, onManageAbsences }: EmployeeCardProps) {
  const { allocations, projects } = useApp();

  // Obtener iniciales para el Avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Obtener proyectos en los que el empleado tiene asignaciones (únicos)
  const employeeProjects = Array.from(new Set(
    allocations
      .filter(a => a.employeeId === employee.id)
      .map(a => {
         const proj = projects.find(p => p.id === a.projectId);
         return proj ? proj.name : null;
      })
      .filter(Boolean) as string[] // Filtramos nulos y aseguramos tipo string
  ));

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
            <AvatarImage src={employee.avatarUrl} alt={employee.name} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
              {getInitials(employee.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm leading-none">{employee.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{employee.role}</p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Menú</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(employee)}>
              Editar perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageAbsences(employee)}>
              Gestionar ausencias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageGoals(employee)}>
              Ver objetivos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600">
              Desactivar empleado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="p-4 pt-2 space-y-4">
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{employee.email}</span>
          </div>
          {employee.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              <span>{employee.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{employee.defaultWeeklyCapacity}h / semana</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
             <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
             <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Proyectos Activos</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
            {employeeProjects.length > 0 ? (
              employeeProjects.map(projName => (
                <Badge 
                  key={projName} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                >
                  {projName}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-slate-400 italic pl-1">Sin asignaciones recientes</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
            <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-xs h-8"
                onClick={() => onManageAbsences(employee)}
            >
                Ausencias
            </Button>
            <Button 
                variant="secondary" 
                size="sm" 
                className="flex-1 text-xs h-8 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                onClick={() => onManageGoals(employee)}
            >
                Objetivos
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
