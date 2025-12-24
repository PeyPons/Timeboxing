import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { MyWeekView } from '@/components/employee/MyWeekView';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, TrendingUp, AlertCircle, Clock, Calendar } from 'lucide-react';
import { AbsencesSheet } from '@/components/team/AbsencesSheet';
import { ProfessionalGoalsSheet } from '@/components/team/ProfessionalGoalsSheet';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Employee } from '@/types';

export default function EmployeeDashboard() {
  const { employees, projects, allocations, isLoading: isGlobalLoading } = useApp();
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

  // Spinner de carga suave
  if (isGlobalLoading || (!myEmployeeProfile && !currentUser)) {
      return <div className="p-10 text-slate-400 text-sm">Cargando tu espacio...</div>;
  }

  // Fallback si no hay perfil
  if (!myEmployeeProfile) {
      return (
          <div className="p-10 max-w-2xl mx-auto text-center space-y-6 pt-20">
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl shadow-sm">
                  <h1 className="text-xl font-bold text-amber-900 mb-2">Cuenta no vinculada</h1>
                  <p className="text-amber-800">Hola <strong>{currentUser?.email}</strong>. No hemos encontrado tu ficha de empleado.</p>
              </div>
          </div>
      );
  }

  // KPI Cálculos
  const myActiveAllocations = allocations.filter(a => a.employeeId === myEmployeeProfile.id && a.status === 'planned');
  const myActiveProjectIds = Array.from(new Set(myActiveAllocations.map(a => a.projectId)));
  const totalAssignedHours = myActiveAllocations.reduce((acc, curr) => acc + Number(curr.hoursAssigned), 0);
  const capacity = myEmployeeProfile.defaultWeeklyCapacity || 40;
  const loadPercentage = capacity > 0 ? Math.min(100, (totalAssignedHours / capacity) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* SALUDO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Tu resumen operativo para esta semana.</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
              <div className={`h-2.5 w-2.5 rounded-full ${loadPercentage > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
              <span className="text-sm font-medium text-slate-700">{loadPercentage.toFixed(0)}% de Carga</span>
          </div>
      </div>

      {/* TARJETAS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Clock className="w-24 h-24" /></div>
              <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                      <p className="text-indigo-100 text-sm font-medium mb-1">Horas Asignadas</p>
                      <div className="flex items-baseline gap-1">
                          <h3 className="text-4xl font-bold">{totalAssignedHours.toFixed(1)}</h3>
                          <span className="text-indigo-200">/ {capacity}h</span>
                      </div>
                  </div>
                  <div>
                      <Progress value={loadPercentage} className="mt-4 h-2 bg-indigo-900/30" indicatorColor="bg-white" />
                  </div>
              </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Proyectos Activos</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{myActiveProjectIds.length}</div>
                  <div className="mt-4 flex flex-wrap gap-1">
                      {myActiveProjectIds.slice(0, 3).map(pid => {
                          const p = projects.find(proj => proj.id === pid);
                          return p ? <Badge key={pid} variant="secondary" className="text-[10px]">{p.name}</Badge> : null;
                      })}
                  </div>
              </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Gestiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                  <Sheet>
                      <SheetTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-slate-700 h-9 text-xs">
                              <Calendar className="w-3.5 h-3.5 mr-2 text-indigo-500"/> Vacaciones
                          </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                          <SheetHeader><SheetTitle>Mis Ausencias</SheetTitle></SheetHeader>
                          <div className="mt-4"><AbsencesSheet employeeId={myEmployeeProfile.id} employeeName={myEmployeeProfile.first_name} /></div>
                      </SheetContent>
                  </Sheet>
                  <Sheet>
                      <SheetTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-slate-700 h-9 text-xs">
                              <TrendingUp className="w-3.5 h-3.5 mr-2 text-emerald-500"/> Objetivos
                          </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                          <SheetHeader><SheetTitle>Plan de Carrera</SheetTitle></SheetHeader>
                          <div className="mt-4"><ProfessionalGoalsSheet employeeId={myEmployeeProfile.id} /></div>
                      </SheetContent>
                  </Sheet>
              </CardContent>
          </Card>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <Tabs defaultValue="week" className="w-full">
          <TabsList className="bg-slate-100 p-1 mb-4">
              <TabsTrigger value="week" className="px-4">Mi Semana</TabsTrigger>
              <TabsTrigger value="projects" className="px-4">Detalle Tareas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="week" className="mt-0">
              <MyWeekView employeeId={myEmployeeProfile.id} />
          </TabsContent>

          <TabsContent value="projects" className="mt-0">
             <div className="text-slate-500 text-sm">Vista detallada de proyectos (En construcción)</div>
          </TabsContent>
      </Tabs>
    </div>
  );
}
