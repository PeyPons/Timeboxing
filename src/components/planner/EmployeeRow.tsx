import { Employee, Project, Allocation, TeamEvent, Absence } from '@/types';
import { WeekCell } from './WeekCell';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface EmployeeRowProps {
  employee: Employee;
  weeks: { weekStart: Date; weekEnd: Date; effectiveStart?: Date; effectiveEnd?: Date }[];
  projects: Project[];
  allocations: Allocation[];
  teamEvents: TeamEvent[];
  absences: Absence[];
  viewDate: Date;
  onOpenSheet: (employeeId: string, weekStart: Date) => void;
}

export function EmployeeRow({ 
  employee, weeks, projects, allocations, teamEvents, absences, viewDate, onOpenSheet 
}: EmployeeRowProps) {
  
  return (
    <div className="contents group">
      {/* Columna del Empleado */}
      <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r p-3 flex items-center justify-between group-hover:bg-slate-50/80 transition-colors">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onOpenSheet(employee.id, weeks[0].weekStart)} // Abre la primera semana al clicar nombre
          title="Ver Timeboxing completo"
        >
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
            {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="h-full w-full rounded-full object-cover" />
            ) : (
                employee.name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col">
             <span className="font-semibold text-sm text-foreground">{employee.name}</span>
             <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{employee.role}</span>
          </div>
        </div>

        {/* Botón explícito para abrir */}
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onOpenSheet(employee.id, weeks[0].weekStart)}
        >
            <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Celdas de Semanas */}
      {weeks.map((week) => (
        <WeekCell 
          key={week.weekStart.toISOString()}
          week={week}
          employee={employee}
          allocations={allocations}
          projects={projects}
          absences={absences}
          teamEvents={teamEvents}
          viewDate={viewDate}
          onOpenSheet={onOpenSheet}
        />
      ))}
    </div>
  );
}
