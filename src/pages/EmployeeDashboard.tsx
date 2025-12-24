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
  
  // Nuevo estado para evitar el "flash" de error mientras comprobamos
  const [isCheckingLink, setIsCheckingLink] = useState(true);

  // Detectar usuario logueado y cruzar con ficha de empleado
  useEffect(() => {
    let mounted = true;

    const checkUserLink = async () => {
        try {
            // 1. Obtenemos usuario autenticado
            const { data: { user } } = await supabase.auth.getUser();
            
            if (mounted && user) {
                setCurrentUser(user);
                
                // 2. Buscamos si existe un empleado con ese email o ID
                if (employees.length > 0) {
                    const profile = employees.find(e => 
                        (e.email && e.email.toLowerCase() === user.email?.toLowerCase()) || 
                        e.user_id === user.id
                    );
                    setMyEmployeeProfile(profile || null);
                }
            }
        } catch (error) {
            console.error("Error verificando perfil:", error);
        } finally {
            if (mounted) setIsCheckingLink(false);
        }
    };

    // Solo ejecutamos si ya terminó la carga global de datos
    if (!isGlobalLoading) {
        checkUserLink();
    }

    return () => { mounted = false; };
  }, [employees, isGlobalLoading]);

  // MOSTRAR SPINNER SI ESTAMOS CARGANDO DATOS O VERIFICANDO EL LINK
  if (isGlobalLoading || isCheckingLink) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  <p className="text-slate-500 text-sm animate-pulse">Sincronizando tu espacio...</p>
              </div>
          </div>
      );
  }

  // SI DESPUÉS DE CARGAR TODO NO HAY PERFIL -> ENTONCES SÍ MOSTRAMOS ERROR
  if (!myEmployeeProfile) {
      return (
          <div className="p-10 max-w-2xl mx-auto text-center space-y-6 pt-20">
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl shadow-sm">
                  <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                  </div>
                  <h1 className="text-xl font-bold text-amber-900 mb-2">Cuenta no vinculada</h1>
                  <p className="text-amber-800 mb-4">
                      Has iniciado sesión como <strong>{currentUser?.email}</strong>,<br/>
                      pero no hemos encontrado una ficha de empleado asociada.
                  </p>
                  <div className="text-sm text-amber-700 bg-white/50 p-4 rounded text-left border border-amber-100">
                      <strong>Solución (para Admins):</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1 ml-1">
                          <li>Ve a la sección <strong>Equipo</strong> en el menú lateral.</li>
                          <li>Busca tu ficha o crea una nueva.</li>
                          <li>Asegúrate de que el campo <strong>Email</strong> sea exactamente: <span className="font-mono bg-white px-1 rounded">{currentUser?.email}</span></li>
                      </ol>
                  </div>
              </div>
          </div>
      );
  }

  // --- DASHBOARD REAL (Si todo va bien) ---

  // KPIs Personales
  const myActiveAllocations = allocations.filter(a => a.employeeId === myEmployeeProfile.id && a.status === 'planned');
  const myActiveProjectIds = Array.from(new Set(myActiveAllocations.map(a => a.projectId)));
  
  const totalAssignedHours = myActiveAllocations.reduce((acc, curr) => acc + Number(curr.hoursAssigned), 0);
  const capacity = myEmployeeProfile.defaultWeeklyCapacity || 40;
  const loadPercentage = capacity > 0 ? Math.min(100, (totalAssignedHours / capacity) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* SALUDO PERSONALIZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Aquí tienes tu resumen operativo para esta semana.</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
              <div className={`h-2.5 w-2.5 rounded-full ${loadPercentage > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
              <span className="text-sm font-medium text-slate-700">{loadPercentage.toFixed(0)}% de Carga</span>
          </div>
      </div>

      {/* TARJETAS DE ACCIÓN RÁPIDA (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Carga de Trabajo */}
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
                      <p className="text-xs text-indigo-100 mt-2 font-medium">
                          {loadPercentage >= 100 ? '⚠️ Estás al límite de tu capacidad' : '✅ Carga saludable'}
                      </p>
                  </div>
              </CardContent>
          </Card>

          {/* 2. Proyectos Activos */}
          <Card className="border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Foco Actual</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{myActiveProjectIds.length}</div>
                  <p className="text-xs text-slate-500 mt-1">Proyectos activos esta semana</p>
                  <div className="mt-4 flex flex-wrap gap-1">
                      {myActiveProjectIds.slice(0, 3).map(pid => {
                          const p = projects.find(proj => proj.id === pid);
                          return p ? <Badge key={pid} variant="secondary" className="text-[10px]">{p.name}</Badge> : null;
                      })}
                      {myActiveProjectIds.length > 3 && <Badge variant="outline" className="text-[10px]">+{myActiveProjectIds.length - 3}</Badge>}
                  </div>
              </CardContent>
          </Card>

          {/* 3. Acciones Personales */}
          <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Mis Gestiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                  <Sheet>
                      <SheetTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-slate-700 h-9 text-xs">
                              <Calendar className="w-3.5 h-3.5 mr-2 text-indigo-500"/> Solicitar Vacaciones / Baja
                          </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                          <SheetHeader><SheetTitle>Mis Ausencias</SheetTitle><SheetDescription>Historial y solicitudes</SheetDescription></SheetHeader>
                          <div className="mt-4"><AbsencesSheet employeeId={myEmployeeProfile.id} employeeName={myEmployeeProfile.first_name} /></div>
                      </SheetContent>
                  </Sheet>
                  
                  <Sheet>
                      <SheetTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-slate-700 h-9 text-xs">
                              <TrendingUp className="w-3.5 h-3.5 mr-2 text-emerald-500"/> Ver Mis Objetivos
                          </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                          <SheetHeader><SheetTitle>Plan de Carrera</SheetTitle><SheetDescription>Metas y seguimiento</SheetDescription></SheetHeader>
                          <div className="mt-4"><ProfessionalGoalsSheet employeeId={myEmployeeProfile.id} /></div>
                      </SheetContent>
                  </Sheet>
              </CardContent>
          </Card>
      </div>

      {/* VISTA PRINCIPAL (TABS) */}
      <Tabs defaultValue="week" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-slate-100 p-1">
                <TabsTrigger value="week" className="px-4">Mi Semana</TabsTrigger>
                <TabsTrigger value="projects" className="px-4">Detalle Tareas</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="week" className="mt-0">
              <MyWeekView employeeId={myEmployeeProfile.id} />
          </TabsContent>

          <TabsContent value="projects" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2">
                  {myActiveProjectIds.length === 0 && (
                      <div className="col-span-2 text-center py-16 text-slate-400 border-2 border-dashed rounded-xl bg-slate-50">
                          <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                          <p>No tienes tareas asignadas actualmente.</p>
                      </div>
                  )}
                  {myActiveProjectIds.map(projId => {
                      const project = projects.find(p => p.id === projId);
                      const projAllocations = myActiveAllocations.filter(a => a.projectId === projId);
                      const totalHours = projAllocations.reduce((acc, curr) => acc + Number(curr.hoursAssigned), 0);
                      // Fallback por si healthStatus no existe
                      const isAtRisk = (project as any)?.healthStatus === 'at_risk';

                      return (
                          <Card key={projId} className="hover:border-indigo-300 transition-colors">
                              <CardHeader className="pb-2">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <CardTitle className="text-base font-bold text-slate-800">{project?.name}</CardTitle>
                                          <CardDescription className="text-xs mt-1">Asignación total: {totalHours.toFixed(1)}h</CardDescription>
                                      </div>
                                      {isAtRisk && (
                                          <Badge variant="destructive" className="flex gap-1 text-[10px] h-5">
                                              <AlertCircle className="w-3 h-3"/> Atención
                                          </Badge>
                                      )}
                                  </div>
                              </CardHeader>
                              <CardContent>
                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                          <CheckSquare className="w-3 h-3"/> Tareas Asignadas
                                      </div>
                                      <ul className="space-y-1">
                                           {projAllocations
                                              .filter(a => a.taskName)
                                              .map((t, i) => (
                                                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                                                      <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0"></span>
                                                      <span>{t.taskName} <span className="text-slate-400">({t.hoursAssigned}h)</span></span>
                                                  </li>
                                              ))
                                           }
                                           {projAllocations.every(a => !a.taskName) && (
                                              <li className="text-xs text-slate-400 italic">Asignación genérica (sin tareas específicas)</li>
                                           )}
                                      </ul>
                                  </div>
                              </CardContent>
                          </Card>
                      )
                  })}
              </div>
          </TabsContent>
      </Tabs>
    </div>
  );
}
