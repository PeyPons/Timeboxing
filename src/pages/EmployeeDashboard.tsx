import { useEffect, useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Calendar, PlusCircle } from 'lucide-react';
import { startOfMonth, endOfMonth, max, min, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee } from '@/types';
import { toast } from 'sonner';

export default function EmployeeDashboard() {
  const { employees, allocations, absences, teamEvents, projects, addAllocation, isLoading: isGlobalLoading, getEmployeeMonthlyLoad } = useApp();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; weekStart: Date } | null>(null);
  
  // Estados Modales
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);
  const [isAddingExtra, setIsAddingExtra] = useState(false);

  // Estados Formulario Tarea Extra
  const [extraTaskName, setExtraTaskName] = useState('');
  const [extraEstimated, setExtraEstimated] = useState('1'); 
  const [extraReal, setExtraReal] = useState('0');

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

  // Lógica para Tarea Extra (Interna)
  const internalProject = useMemo(() => {
      return projects.find(p => 
          p.name.toLowerCase().includes('interno') || 
          p.name.toLowerCase().includes('gestión')
      ) || projects[0]; 
  }, [projects]);

  const handleAddExtraTask = async () => {
      if (!myEmployeeProfile) return;
      if (!extraTaskName) { toast.error("Pon un nombre a la tarea"); return; }
      if (!internalProject) { toast.error("No hay proyectos disponibles."); return; }

      try {
          // CORRECCIÓN CLAVE: Calcular el Lunes de la semana actual para que salga en el planificador
          const today = new Date();
          const mondayOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
          const formattedDate = format(mondayOfCurrentWeek, 'yyyy-MM-dd');

          await addAllocation({
              projectId: internalProject.id,
              employeeId: myEmployeeProfile.id,
              weekStartDate: formattedDate, // Guardamos con fecha lunes
              hoursAssigned: Number(extraEstimated), 
              hoursActual: Number(extraReal),       
              hoursComputed: 0,
              taskName: extraTaskName,
              status: 'active', // Directamente activa
              description: 'Tarea rápida añadida desde Dashboard'
          });
          
          toast.success("Tarea añadida al planificador");
          setIsAddingExtra(false);
          // Reset
          setExtraTaskName(''); setExtraEstimated('1'); setExtraReal('0');
      } catch (error) {
          console.error(error);
          toast.error("Error al crear tarea");
      }
  };

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
      
      {/* 1. CABECERA + ACCIONES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Panel de Control Operativo</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* BOTÓN TAREA EXTRA (MOVIDO AQUÍ) */}
            <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
                <DialogTrigger asChild>
                    <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm">
                        <PlusCircle className="h-4 w-4" /> Tarea Extra
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Añadir Tarea Rápida</DialogTitle><DialogDescription>Se asignará a <strong>{internalProject?.name}</strong> en la semana actual.</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2"><Label>Tarea</Label><Input value={extraTaskName} onChange={e => setExtraTaskName(e.target.value)} autoFocus placeholder="Ej: Llamada cliente urgente..." /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Estimado (h)</Label><Input type="number" step="0.5" value={extraEstimated} onChange={e => setExtraEstimated(e.target.value)} /></div>
                            <div className="space-y-2"><Label>Real (h)</Label><Input type="number" step="0.5" value={extraReal} onChange={e => setExtraReal(e.target.value)} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button><Button onClick={handleAddExtraTask}>Añadir al Planificador</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="h-9 w-px bg-slate-200 mx-1 hidden md:block"></div>

            <Button variant="outline" onClick={() => setShowGoals(true)} className="gap-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                <TrendingUp className="h-4 w-4" /> Objetivos
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

      {/* 5. LISTADO DE PROYECTOS (MENSUAL) */}
      <div className="pt-4 border-t">
          <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              Resumen de Proyectos: {getMonthName(currentMonth)}
          </h3>
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
