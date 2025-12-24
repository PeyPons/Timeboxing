import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Employee } from '@/types';

export default function EmployeeDashboard() {
  const { employees, isLoading: isGlobalLoading } = useApp();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myEmployeeProfile, setMyEmployeeProfile] = useState<Employee | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toISOString().split('T')[1]} - ${msg}`]);

  useEffect(() => {
    addLog("Componente montado. Iniciando chequeo...");
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        addLog(`Usuario Auth detectado: ${user.email}`);
        setCurrentUser(user);
        
        if (employees.length > 0) {
          addLog(`Buscando en ${employees.length} empleados...`);
          const profile = employees.find(e => 
             e.user_id === user.id || 
             (e.email && e.email.toLowerCase() === user.email?.toLowerCase())
          );
          
          if (profile) {
            addLog(`Perfil encontrado: ${profile.name} (ID: ${profile.id})`);
            setMyEmployeeProfile(profile);
          } else {
            addLog("❌ No se encontró perfil de empleado compatible.");
          }
        } else {
          addLog("⚠️ La lista de empleados está vacía.");
        }
      } else {
        addLog("No hay sesión de usuario activa.");
      }
    };

    if (!isGlobalLoading) {
      checkUser();
    }
  }, [employees, isGlobalLoading]);

  // Renderizado defensivo
  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Panel de Diagnóstico</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded border">
              <p className="text-sm text-slate-500">Carga Global</p>
              <p className="font-mono font-bold">{isGlobalLoading ? "Cargando..." : "Completado"}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded border">
              <p className="text-sm text-slate-500">Perfil Empleado</p>
              <p className={`font-mono font-bold ${myEmployeeProfile ? "text-green-600" : "text-red-600"}`}>
                {myEmployeeProfile ? "VINCULADO" : "PENDIENTE"}
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-lg h-64 overflow-y-auto">
            {debugLog.map((log, i) => (
              <div key={i} className="border-b border-slate-800 pb-1 mb-1 last:border-0">
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {myEmployeeProfile && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800">
            ¡Éxito! El dashboard puede renderizarse. El problema estaba en un componente hijo.
        </div>
      )}
    </div>
  );
}
