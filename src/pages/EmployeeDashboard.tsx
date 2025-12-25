import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { EmployeeRow } from '@/components/planner/EmployeeRow'; // Reutilizamos el componente del Planner
import { AllocationSheet } from '@/components/planner/AllocationSheet';
import { getWeeksForMonth, getMonthName, isCurrentWeek } from '@/utils/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { Employee } from '@/types';
import { startOfMonth, endOfMonth, max, min, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmployeeDashboard() {
  const { employees, allocations, absences, teamEvents, projects, isLoading: isGlobalLoading, getEmployeeMonthlyLoad } = useApp();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  
  // Estado para la vista de calendario (igual que PlannerGrid)
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Estado para Sheets
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);
  const [showAbsences, setShowAbsences] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  useEffect(() => {
    const checkUserLink = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            if (employees.length > 0) {
                const profile = employees.find(e => 
                    (e.email && e.email.toLowerCase() === user.email?.toLowerCase()) || 
                    e.user_id === user.id
                );
                setMyEmployeeProfile(profile || null);
            }
        }
    };

    if (!isGlobalLoading) {
        checkUserLink();
    }
  }, [employees, isGlobalLoading]);

  // Navegación de meses
  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());

  if (isGlobalLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Cargando...</div>;
  }

  if (!myEmployeeProfile && currentUser) {
      return (
          <div className="p-10 max-w-2xl mx-auto text-center space-y-6 pt-20">
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl shadow-sm">
                  <h1 className="text-xl font-bold text-amber-900 mb-2">Perfil no vinculado</h1>
                  <p className="text-amber-800">Hola <strong>{currentUser.email}</strong>. Contacta con un administrador.</p>
              </div>
          </div>
      );
  }

  if (!myEmployeeProfile) return null;

  // Cálculos para la vista
  const weeks = getWeeksForMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Layout de la grilla (mismo que PlannerGrid)
  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;
  
  // KPI Mensual
  const monthlyLoad = getEmployeeMonthlyLoad(myEmployeeProfile.id, year, month);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Tu planificación mensual.</p>
          </div>
          
          <div className="flex gap-3">
              <Button variant="outline" className="gap-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={() => setShowGoals(true)}>
                  <TrendingUp className="h-4 w-4" /> Mis Objetivos
              </Button>
              <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={() => setShowAbsences(true)}>
                  <Calendar className="h-4 w-4" /> Ausencias
              </Button>
          </div>
      </div>

      {/* CONTROLES DE FECHA (Igual que Planner) */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm w-fit">
            <h2 className="text-lg font-bold capitalize text-slate-900 flex items-center gap-2 ml-2">
                {getMonthName(currentMonth)} <Badge variant="outline" className="text-xs font-normal">{year}</Badge>
            </h2>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes Actual</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
      </div>

      {/* VISTA PLANIFICADOR (Replicada) */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <div style={{ minWidth: '1000px' }}>
                {/* Cabecera de Semanas */}
                <div className="grid bg-slate-50 border-b" style={{ gridTemplateColumns: gridTemplate }}>
                    <div className="px-4 py-3 font-bold text-sm text-slate-700 flex items-center border-r">Mi Calendario</div>
                    {weeks.map((week, index) => (
                        <div key={week.weekStart.toISOString()} className={cn("text-center px-1 py-2 border-r flex flex-col justify-center", isCurrentWeek(week.weekStart) && "bg-indigo-50/50")}>
                            <span className={cn("text-xs font-bold uppercase", isCurrentWeek(week.weekStart) ? "text-indigo-600" : "text-slate-500")}>S{index + 1}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{format(max([week.weekStart, monthStart]), 'd', { locale: es })}-{format(min([week.weekEnd, monthEnd]), 'd MMM', { locale: es })}</span>
                        </div>
                    ))}
                    <div className="px-2 py-3 font-bold text-xs text-center flex items-center justify-center">TOTAL MES</div>
                </div>

                {/* Fila del Empleado (Reutilizamos EmployeeRow) */}
                <div className="grid bg-white" style={{ gridTemplateColumns: gridTemplate }}>
                    <EmployeeRow 
                        employee={myEmployeeProfile} 
                        weeks={weeks} 
                        projects={projects}
                        allocations={allocations}
                        absences={absences}
                        teamEvents={teamEvents}
                        viewDate={currentMonth}
                        onOpenSheet={(empId, date) => setSelectedCell({ employeeId: empId, weekStart: date })}
                    />
                    
                    {/* Celda Total (Copiada de PlannerGrid) */}
                    <div className="flex items-center justify-center border-l p-2 bg-slate-50/30">
                        <div className={cn("flex flex-col items-center justify-center w-16 h-12 rounded-lg border-2", monthlyLoad.status === 'overload' ? "bg-red-50 border-red-200 text-red-700" : monthlyLoad.status === 'warning' ? "bg-yellow-50 border-yellow-200 text-yellow-700" : monthlyLoad.status === 'healthy' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400")}>
                            <span className="text-sm font-bold leading-none">{monthlyLoad.hours}h</span>
                            <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </Card>

      {/* DIÁLOGOS Y SHEETS */}
      {selectedCell && (
        <AllocationSheet 
            open={!!selectedCell} 
            onOpenChange={(open) => !open && setSelectedCell(null)} 
            employeeId={selectedCell.employeeId} 
            weekStart={selectedCell.weekStart.toISOString()} 
            viewDateContext={currentMonth} 
        />
      )}

      {/* Corregido: Renderizado condicional seguro para Ausencias */}
      {showAbsences && (
          <AbsencesSheet 
            open={showAbsences} 
            onOpenChange={setShowAbsences} 
            employeeId={myEmployeeProfile.id} 
          />
      )}

      {/* Corregido: Renderizado condicional seguro para Objetivos */}
      {showGoals && (
          <ProfessionalGoalsSheet 
            open={showGoals} 
            onOpenChange={setShowGoals} 
            employeeId={myEmployeeProfile.id} 
          />
      )}
    </div>
  );
}
