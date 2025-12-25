import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { MyWeekView } from '@/components/employee/MyWeekView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, TrendingUp, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Employee } from '@/types';
import { startOfWeek } from 'date-fns';

export default function EmployeeDashboard() {
  const { employees, allocations, isLoading: isGlobalLoading, getEmployeeLoadForWeek } = useApp();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  
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

  if (isGlobalLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  <p className="text-slate-500 text-sm animate-pulse">Sincronizando...</p>
              </div>
          </div>
      );
  }

  if (!myEmployeeProfile && currentUser) {
      return (
          <div className="p-10 max-w-2xl mx-auto text-center space-y-6 pt-20">
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl shadow-sm">
                  <h1 className="text-xl font-bold text-amber-900 mb-2">Perfil no vinculado</h1>
                  <p className="text-amber-800">Hola <strong>{currentUser.email}</strong>. Tu usuario existe pero no está vinculado a una ficha de empleado.</p>
              </div>
          </div>
      );
  }

  if (!myEmployeeProfile) return null;

  // --- LÓGICA CENTRALIZADA ---
  // Usamos exactamente la misma función que el Planificador para calcular la carga
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Lunes
  
  // Obtenemos la carga real usando el Helper del contexto (incluye festivos, ausencias, etc.)
  const weeklyLoad = getEmployeeLoadForWeek(
      myEmployeeProfile.id, 
      currentWeekStart.toISOString()
  );

  // Filtramos tareas activas para contadores rápidos
  const myActiveAllocations = allocations.filter(a => 
      a.employeeId === myEmployeeProfile.id && 
      (a.status === 'planned' || a.status === 'active')
  );
  const pendingTasksCount = myActiveAllocations.length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* CABECERA CON KPI DE CARGA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Panel de Operaciones</p>
          </div>
          
          {/* Tarjeta de Estado de Capacidad */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm w-full md:w-auto">
              <div className={`p-3 rounded-full ${weeklyLoad.status === 'overload' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {weeklyLoad.status === 'overload' ? <AlertTriangle className="w-6 h-6"/> : <Clock className="w-6 h-6"/>}
              </div>
              <div className="space-y-1 min-w-[140px]">
                  <div className="flex justify-between text-sm font-medium text-slate-600">
                      <span>Carga Semanal</span>
                      <span className={weeklyLoad.percentage > 100 ? "text-red-600 font-bold" : "text-slate-900"}>
                          {weeklyLoad.percentage}%
                      </span>
                  </div>
                  <Progress 
                    value={weeklyLoad.percentage} 
                    className={`h-2.5 ${weeklyLoad.status === 'overload' ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-600'}`} 
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                      <span>Asignado: {weeklyLoad.hours}h</span>
                      <span>Capacidad: {weeklyLoad.capacity}h</span>
                  </div>
              </div>
          </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:border-indigo-300 transition-colors cursor-default border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><CheckSquare className="w-5 h-5"/></div>
                  <div>
                      <div className="text-2xl font-bold text-slate-900">{pendingTasksCount}</div>
                      <div className="text-xs text-slate-500 font-medium uppercase">Tareas Pendientes</div>
                  </div>
              </CardContent>
          </Card>

          <Card className="hover:border-emerald-300 transition-colors cursor-pointer border-slate-200 shadow-sm group">
              <Sheet>
                  <SheetTrigger asChild>
                      <CardContent className="p-4 flex items-center gap-4 h-full w-full">
                          <div className="bg-emerald-100 p-2.5 rounded-lg text-emerald-600 group-hover:bg-emerald-200 transition-colors"><TrendingUp className="w-5 h-5"/></div>
                          <div>
                              <div className="text-sm font-bold text-slate-900">Mis Objetivos</div>
                              <div className="text-xs text-emerald-600 font-medium">Ver Progreso →</div>
                          </div>
                      </CardContent>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                      <SheetHeader><SheetTitle>Mis Objetivos (OKRs)</SheetTitle></SheetHeader>
                      <div className="mt-6"><ProfessionalGoalsSheet employeeId={myEmployeeProfile.id} /></div>
                  </SheetContent>
              </Sheet>
          </Card>

          <Card className="hover:border-amber-300 transition-colors cursor-pointer border-slate-200 shadow-sm group">
              <Sheet>
                  <SheetTrigger asChild>
                      <CardContent className="p-4 flex items-center gap-4 h-full w-full">
                          <div className="bg-amber-100 p-2.5 rounded-lg text-amber-600 group-hover:bg-amber-200 transition-colors"><Calendar className="w-5 h-5"/></div>
                          <div>
                              <div className="text-sm font-bold text-slate-900">Ausencias</div>
                              <div className="text-xs text-amber-600 font-medium">Solicitar / Ver →</div>
                          </div>
                      </CardContent>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                      <SheetHeader><SheetTitle>Gestión de Ausencias</SheetTitle></SheetHeader>
                      <div className="mt-6"><AbsencesSheet employeeId={myEmployeeProfile.id} employeeName={myEmployeeProfile.first_name} /></div>
                  </SheetContent>
              </Sheet>
          </Card>
      </div>

      {/* VISTA PRINCIPAL */}
      <Tabs defaultValue="week" className="w-full">
          <TabsList className="bg-slate-100 p-1 mb-4">
              <TabsTrigger value="week" className="px-4">Mi Semana</TabsTrigger>
              <TabsTrigger value="history" className="px-4" disabled>Histórico (Próximamente)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="week" className="mt-0">
              <MyWeekView employeeId={myEmployeeProfile.id} />
          </TabsContent>
      </Tabs>
    </div>
  );
}
