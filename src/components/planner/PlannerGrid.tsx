import { useApp } from '@/contexts/AppContext';
import EmployeeRow from './EmployeeRow';
import { format, addDays, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PlannerGrid() {
  const { employees, weeks, currentDate } = useApp();

  // Filtrar empleados activos
  const activeEmployees = employees.filter(e => e.isActive);

  // Configuración del Grid para ajustar 5 semanas sin scroll forzado
  // 250px para la columna de empleado, el resto se divide equitativamente
  const gridStyle = {
    gridTemplateColumns: `250px repeat(${weeks.length}, minmax(0, 1fr))`
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 rounded-lg shadow border border-slate-200 dark:border-slate-800">
      
      {/* Cabecera del Grid */}
      <div 
        className="grid border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-10"
        style={gridStyle}
      >
        {/* Celda vacía esquina superior izquierda (Cabecera empleados) */}
        <div className="p-3 font-semibold text-sm text-slate-500 border-r border-slate-200 dark:border-slate-800 flex items-center">
          Equipo ({activeEmployees.length})
        </div>

        {/* Cabeceras de Semanas */}
        {weeks.map((weekStart, index) => {
            const start = new Date(weekStart);
            const end = addDays(start, 4); // Viernes
            const isCurrentMonth = isSameMonth(start, currentDate) || isSameMonth(end, currentDate);

            return (
                <div 
                    key={weekStart} 
                    className={`
                        p-2 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center
                        ${!isCurrentMonth ? 'bg-slate-100/50 dark:bg-slate-900/50 text-slate-400' : ''}
                    `}
                >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        Semana {index + 1}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                        {format(start, 'd MMM', { locale: es })} - {format(end, 'd MMM', { locale: es })}
                    </span>
                </div>
            );
        })}
      </div>

      {/* Cuerpo del Grid (Filas de empleados) */}
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        <div className="min-w-full"> 
          {activeEmployees.map(employee => (
            <EmployeeRow 
              key={employee.id} 
              employee={employee} 
              weeks={weeks}
              gridColumnsStyle={gridStyle} // Pasamos el estilo al hijo para mantener alineación
            />
          ))}
          
          {activeEmployees.length === 0 && (
             <div className="p-10 text-center text-muted-foreground">
                No hay empleados activos. Añade miembros al equipo para comenzar.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
