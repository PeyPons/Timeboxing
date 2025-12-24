import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { TeamEventManager } from '@/components/team/TeamEventManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, CalendarOff, Mail, Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function TeamPage() {
  const { employees, addEmployee } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para añadir empleado rápido
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState(''); // Nuevo campo Password
  const [newEmpRole, setNewEmpRole] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddEmployee = async () => {
    if (!newEmpName) return toast.error("El nombre es obligatorio");
    setIsCreating(true);

    let authUserId = undefined;

    // 1. Intentar crear usuario en Auth (opcional)
    if (newEmpEmail && newEmpPassword) {
        try {
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: { email: newEmpEmail, password: newEmpPassword, name: newEmpName }
            });
            if (!error && data?.user?.id) {
                authUserId = data.user.id;
                toast.success("Cuenta de acceso creada.");
            }
        } catch (err) {
            console.log("Creación automática no disponible (requiere Backend).");
        }
    }

    // 2. Crear ficha empleado
    await addEmployee({
        name: newEmpName,
        email: newEmpEmail,
        user_id: authUserId,
        role: newEmpRole || 'Sin rol',
        defaultWeeklyCapacity: 40,
        workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
        isActive: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newEmpName}`
    });

    toast.success("Empleado añadido correctamente");
    
    // Limpieza
    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpPassword('');
    setNewEmpRole('');
    setIsAddingEmp(false);
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Equipo</h1>
            <p className="text-muted-foreground">Gestiona a tus empleados, sus horarios y proyecciones.</p>
        </div>
        
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-white dark:bg-slate-900 border-dashed">
                        <CalendarOff className="h-4 w-4 text-orange-500" />
                        Gestionar Festivos
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <TeamEventManager />
                </DialogContent>
            </Dialog>

            <Button onClick={() => setIsAddingEmp(!isAddingEmp)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                {isAddingEmp ? 'Cancelar' : <><Plus className="h-4 w-4" /> Nuevo Empleado</>}
            </Button>
        </div>
      </div>

      {/* Formulario Rápido (Expandible) */}
      {isAddingEmp && (
        <div className="bg-white border border-indigo-100 shadow-lg rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4 text-indigo-700 font-semibold border-b border-indigo-50 pb-2">
                <UserPlus className="h-5 w-5" /> Alta Rápida de Empleado
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500">Nombre *</span>
                    <Input value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="Nombre completo" className="bg-slate-50" autoFocus />
                </div>
                
                <div className="space-y-1.5 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3"/> Email</span>
                    <Input value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)} placeholder="usuario@empresa.com" className="bg-slate-50" />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3"/> Contraseña</span>
                    <Input type="password" value={newEmpPassword} onChange={e => setNewEmpPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="bg-slate-50" />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500">Rol</span>
                    <Input value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} placeholder="Ej: Diseñador" className="bg-slate-50" />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <Button onClick={handleAddEmployee} disabled={isCreating} className="bg-indigo-600 w-full md:w-auto">
                    {isCreating ? 'Guardando...' : 'Crear Ficha y Acceso'}
                </Button>
            </div>
        </div>
      )}

      {/* Buscador y Grid */}
      <div className="relative mt-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre o rol..."
          className="pl-9 max-w-sm bg-white border-slate-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredEmployees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
        {filteredEmployees.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-slate-500">No se encontraron empleados.</p>
            </div>
        )}
      </div>
    </div>
  );
}
