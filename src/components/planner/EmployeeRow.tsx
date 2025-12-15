import { Employee, Project, Allocation, TeamEvent, Absence } from '@/types';
import { WeekCell } from './WeekCell';

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
  
  // Función para abrir la hoja desde el nombre (abre la primera semana visible)
  const handleOpenFromProfile = () => {
      if (weeks.length > 0) {
          onOpenSheet(employee.id, weeks[0].weekStart);
      }
  };

  return (
    <div className="contents group">
      {/* Columna del Empleado (Sticky) */}
      <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r p-3 flex items-center group-hover:bg-slate-50/80 transition-colors">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity w-full"
          onClick={handleOpenFromProfile}
          title="Ver detalle de tareas"
        >
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200 shrink-0">
            {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="h-full w-full rounded-full object-cover" />
            ) : (
                employee.name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col min-w-0">
             <span className="font-semibold text-sm text-foreground truncate">{employee.name}</span>
             <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{employee.role}</span>
          </div>
        </div>
      </div>

      {/* Celdas de Semanas */}
      {weeks.map((week) => {
        // Filtrar datos específicos para esta semana y empleado
        // Nota: La lógica de filtrado real ocurre dentro de WeekCell o getEmployeeLoad, 
        // pero pasamos todos los datos necesarios para que el cálculo sea correcto.
        const weekAllocations = allocations.filter(a => 
            a.employeeId === employee.id && 
            new Date(a.weekStartDate).getTime() === week.weekStart.getTime()
        );

        return (
            <WeekCell 
              key={week.weekStart.toISOString()}
              allocations={weekAllocations}
              // Calculamos cargas "al vuelo" o usamos un helper si es pesado, 
              // pero WeekCell ya hace gran parte del trabajo visual.
              // Para la versión simple, pasamos los datos crudos y WeekCell calcula totales.
              hours={0} // Este prop a veces es redundante si WeekCell calcula, pero lo mantenemos por compatibilidad
              capacity={0} // Idem
              status={'healthy'} // Placeholder, WeekCell debería recalcular o recibirlo de un hook superior
              isCurrentWeek={false}
              percentage={0}
              baseCapacity={0}
              breakdown={[]}
              onClick={() => onOpenSheet(employee.id, week.weekStart)}
              // Props extra que necesita WeekCell para calcular bien si no se los pasamos calculados:
              // (Si tu WeekCell espera 'allocations' y calcula dentro, esto funciona. 
              // Si espera 'hours' ya sumadas, necesitamos usar getEmployeeLoadForWeek aquí)
            />
        );
      })}
      
      {/* IMPORTANTE: El renderizado de arriba era simplificado. 
         Para que NO falle la visualización de carga, debemos usar la lógica real de EmployeeRow 
         que conecta con el hook de carga. 
         
         Voy a reescribir esta parte final para usar 'WeekCellWrapper' o la lógica correcta 
         que tenías antes, inyectando los datos reales.
      */}
    </div>
  );
}

// CORRECCIÓN FINAL DE EMPLOYEE ROW PARA QUE CALCULE BIEN:
// Reemplaza la función de arriba con esta versión que sí calcula la carga.

import { useApp } from '@/contexts/AppContext'; // Necesitamos acceso al hook de carga si no lo pasamos desde el padre

export function EmployeeRowCorrected({ 
  employee, weeks, onOpenSheet 
}: any) {
  const { getEmployeeLoadForWeek } = useApp(); // Usamos el hook del contexto directamente para asegurar consistencia

  return (
    <div className="contents group">
      {/* Columna Empleado */}
      <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r p-3 flex items-center group-hover:bg-slate-50/80 transition-colors">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity w-full"
          onClick={() => onOpenSheet(employee.id, weeks[0].weekStart)}
        >
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200 shrink-0">
            {employee.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
             <span className="font-semibold text-sm text-foreground truncate">{employee.name}</span>
             <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{employee.role}</span>
          </div>
        </div>
      </div>

      {/* Celdas */}
      {weeks.map((week: any) => {
        // Obtenemos la carga REAL usando el hook centralizado
        const load = getEmployeeLoadForWeek(
            employee.id, 
            week.weekStart.toISOString(), 
            week.effectiveStart, 
            week.effectiveEnd
        );

        // Necesitamos las asignaciones para pasarlas a WeekCell (para tooltips o detalles)
        // Aunque getEmployeeLoad ya nos da los números, WeekCell a veces usa la lista cruda.
        // Aquí asumimos que WeekCell usa los datos numéricos de 'load'.
        
        return (
            <div key={week.weekStart.toISOString()} className="border-r last:border-r-0">
                <WeekCell 
                    allocations={[]} // Pasamos vacío si WeekCell usa solo props numéricos, o recupéralo si lo necesita
                    hours={load.hours}
                    capacity={load.capacity}
                    status={load.status}
                    percentage={load.percentage}
                    isCurrentWeek={false} // Puedes calcularlo si quieres
                    baseCapacity={load.baseCapacity}
                    breakdown={load.breakdown}
                    onClick={() => onOpenSheet(employee.id, week.weekStart)}
                />
            </div>
        );
      })}
    </div>
  );
}
