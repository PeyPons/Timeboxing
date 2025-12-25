import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { MyWeekView } from '@/components/employee/MyWeekView';
// Importamos los nuevos widgets
import { PriorityInsights, ProjectTeamPulse } from '@/components/employee/DashboardWidgets'; 
import { Card, CardContent } from '@/components/ui/card'; // Eliminamos importaciones no usadas si las hubiera
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, AlertTriangle } from 'lucide-react';
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

  if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Cargando...</div>;
  if (!myEmployeeProfile && currentUser) return <div className="p-10 text-center">Perfil no vinculado.</div>;
  if (!myEmployeeProfile) return null;

  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  
  const weeklyLoad = getEmployeeLoadForWeek(myEmployeeProfile.id, currentWeekStart.toISOString());

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* 1. CABECERA + KPI CARGA (Lo que ya tenías) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
              <h1 className="text-3xl font-bold text-slate-900">Hola, {myEmployeeProfile.first_name || myEmployeeProfile.name} 👋</h1>
              <p className="text-slate-500">Panel de Operaciones</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm w-full md:w-auto">
              <div className={`p-3 rounded-full ${weeklyLoad.status === 'overload' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {weeklyLoad.status === 'overload' ? <AlertTriangle className="w-6 h-6"/> : <Clock className="w-6 h-6"/>}
              </div>
              <div className="space-y-1 min-w-[140px]">
                  <div className="flex justify-between text-sm font-medium text-slate-600">
                      <span>Carga Semanal</span>
                      <span className={weeklyLoad.percentage > 100 ? "text-red-600 font-bold" : "text-slate-900"}>{weeklyLoad.percentage}%</span>
                  </div>
                  <Progress value={weeklyLoad.percentage} className={`h-2.5 ${weeklyLoad.status === 'overload' ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-600'}`} />
                  <div className="flex justify-between text-xs text-slate-400"><span>{weeklyLoad.hours}h Asignadas</span><span>{weeklyLoad.capacity}h Capacidad</span></div>
              </div>
          </div>
      </div>

      {/* 2. SECCIÓN INTELIGENTE: RECOMENDACIONES Y EQUIPO (NUEVO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Recomendaciones (Ocupa 1/3) */}
          <div className="lg:col-span-1 space-y-4">
              <PriorityInsights employeeId={myEmployeeProfile.id} />
              
              {/* Aquí podrías mover los botones de Objetivos/Ausencias si quieres agruparlos */}
          </div>

          {/* Columna Derecha: Vista de Equipo (Ocupa 2/3) */}
          <div className="lg:col-span-2">
              <ProjectTeamPulse employeeId={myEmployeeProfile.id} />
          </div>
      </div>

      {/* 3. VISTA PRINCIPAL DE TAREAS */}
      <Tabs defaultValue="week" className="w-full pt-4">
          <TabsList className="bg-slate-100 p-1 mb-4">
              <TabsTrigger value="week" className="px-4">Mi Semana</TabsTrigger>
              <TabsTrigger value="history" className="px-4" disabled>Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="week" className="mt-0">
              <MyWeekView employeeId={myEmployeeProfile.id} />
          </TabsContent>
      </Tabs>
    </div>
  );
}
