import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { MyWeekView } from '@/components/employee/MyWeekView';
import { PriorityInsights, ProjectTeamPulse } from '@/components/employee/DashboardWidgets'; 
import { Card } from '@/components/ui/card';
import { EmployeeRow } from '@/components/planner/EmployeeRow'; 
import { AllocationSheet } from '@/components/planner/AllocationSheet';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { getWeeksForMonth, getMonthName } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, max, min, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee } from '@/types';

export default function EmployeeDashboard() {
  const { employees, allocations, absences, teamEvents, projects, isLoading: isGlobalLoading, getEmployeeMonthlyLoad } = useApp();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);
  
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);

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
    if (!isGlobalLoading) checkUserLink();
  }, [employees, isGlobalLoading]);

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());

  if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Cargando...</div>;
  if (!myEmployeeProfile) return null;

  const weeks = getWeeksForMonth(currentMonth);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridTemplate = `250px repeat(${weeks.length}, minmax(0, 1fr)) 100px`;
  const monthlyLoad = getEmployeeMonthlyLoad(myEmployeeProfile.id, currentMonth.getFullYear(), currentMonth.getMonth());

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* 1. CABECERA */}
      <div className="flex justify-between items-center">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Tu planificación mensual.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGoals(true)} className="gap-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                <TrendingUp className="h-4 w-4" /> Mis Objetivos
            </Button>
            <Button variant="outline" onClick={() => setShowAbsences(true)} className="gap-2 text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100">
                <Calendar className="h-4 w-4" /> Ausencias
            </Button>
          </div>
      </div>

      {/* 2. CONTROL MES */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm w-fit">
            <h2 className="text-lg font-bold capitalize text-slate-900 flex items-center gap-2 ml-2">
                {getMonthName(currentMonth)} <Badge variant="outline" className="text-xs font-normal">{currentMonth.getFullYear()}</Badge>
            </h2>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Mes Actual</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
      </div>

      {/* 3. RESUMEN TIPO PLANIFICADOR */}
      <Card className="overflow-hidden border-slate-200 shadow-sm bg-white">
          <div className="overflow-x-auto custom-scrollbar">
            <div style={{ minWidth: '1000px' }}>
                <div className="grid bg-slate-50 border-b" style={{ gridTemplateColumns: gridTemplate }}>
                    <div className="px-4 py-3 font-bold text-sm text-slate-700 flex items-center border-r">Mi Calendario</div>
                    {weeks.map((week, index) => (
                        <div key={week.weekStart.toISOString()} className="text-center px-1 py-2 border-r flex flex-col justify-center">
                            <span className="text-xs font-bold uppercase text-slate-500">S{index + 1}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{format(max([week.weekStart, monthStart]), 'd', { locale: es })}-{format(min([week.weekEnd, monthEnd]), 'd MMM', { locale: es })}</span>
                        </div>
                    ))}
                    <div className="px-2 py-3 font-bold text-xs text-center flex items-center justify-center">TOTAL MES</div>
                </div>

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
                    <div className="flex items-center justify-center border-l p-2 bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center w-20 h-14 rounded-lg bg-red-50 border border-red-200 text-red-700">
                            <span className="text-base font-bold leading-none">{monthlyLoad.hours}h</span>
                            <span className="text-[10px] opacity-70">/ {monthlyLoad.capacity}h</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </Card>

      {/* 4. WIDGETS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1"><PriorityInsights employeeId={myEmployeeProfile.id} /></div>
          <div className="lg:col-span-2"><ProjectTeamPulse employeeId={myEmployeeProfile.id} /></div>
      </div>

      {/* 5. LISTA DE TAREAS (MENSUAL) */}
      <div className="pt-4 border-t">
          {/* CAMBIADO TÍTULO PARA REFLEJAR EL MES */}
          <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              Detalle de Tareas: {getMonthName(currentMonth)}
          </h3>
          {/* PASAMOS LA FECHA SELECCIONADA A MYWEEKVIEW */}
          <MyWeekView employeeId={myEmployeeProfile.id} viewDate={currentMonth} />
      </div>

      {selectedCell && (
        <AllocationSheet 
            open={!!selectedCell} 
            onOpenChange={(open) => !open && setSelectedCell(null)} 
            employeeId={selectedCell.employeeId} 
            weekStart={selectedCell.weekStart.toISOString()} 
            viewDateContext={currentMonth} 
        />
      )}

      {showGoals && <ProfessionalGoalsSheet open={showGoals} onOpenChange={setShowGoals} employeeId={myEmployeeProfile.id} />}
      {showAbsences && <AbsencesSheet open={showAbsences} onOpenChange={setShowAbsences} employeeId={myEmployeeProfile.id} />}
    </div>
  );
}
