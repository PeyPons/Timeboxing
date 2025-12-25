import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee, WorkSchedule } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Briefcase, CalendarClock, Target, Mail, Lock, Clock, ShieldCheck } from 'lucide-react';

import { ScheduleEditor } from './ScheduleEditor';
import { ProjectsSheet } from './ProjectsSheet';
import { ProfessionalGoalsSheet } from './ProfessionalGoalsSheet';
import { AbsencesSheet } from './AbsencesSheet';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeToEdit?: Employee | null;
}

const defaultSchedule: WorkSchedule = {
  monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0
};

export function EmployeeDialog({ open, onOpenChange, employeeToEdit }: EmployeeDialogProps) {
  const { addEmployee, updateEmployee } = useApp();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Development');
  const [capacity, setCapacity] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(0);
  
  // ESTADO CRÍTICO: Aquí guardamos los cambios del horario
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(defaultSchedule);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);

  useEffect(() => {
    if (open) {
      if (employeeToEdit) {
        setName(employeeToEdit.name);
        setEmail(employeeToEdit.email || '');
        setPassword(''); 
        setRole(employeeToEdit.role);
        setDepartment(employeeToEdit.department || 'Development');
        setCapacity(employeeToEdit.defaultWeeklyCapacity);
        setHourlyRate(employeeToEdit.hourlyRate || 0);
        // Cargamos el horario del empleado o el default
        setWorkSchedule(employeeToEdit.workSchedule || defaultSchedule);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('');
        setDepartment('Development');
        setCapacity(40);
        setHourlyRate(0);
        setWorkSchedule(defaultSchedule);
      }
    }
  }, [open, employeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    let authUserId = employeeToEdit?.user_id;
    let authMessage = "";

    try {
        if (email && password) {
            if (employeeToEdit && employeeToEdit.user_id) {
                const { error } = await supabase.functions.invoke('update-user', {
                    body: { userId: employeeToEdit.user_id, password, email }
                });
                if (error) throw error;
                authMessage = "Credenciales actualizadas.";
            } else {
                const { data, error } = await supabase.functions.invoke('create-user', {
                    body: { email, password, name }
                });
                if (error) throw error;
                if (data?.user?.id) {
                    authUserId = data.user.id;
                    authMessage = "Cuenta de acceso creada.";
                }
            }
        }

        const employeeData = {
            name,
            email: email.trim() || undefined,
            user_id: authUserId,
            role,
            department,
            defaultWeeklyCapacity: Number(capacity),
            hourlyRate: Number(hourlyRate),
            // IMPORTANTE: Enviamos el estado local 'workSchedule' que tiene los cambios
            workSchedule: workSchedule, 
            isActive: true,
            avatarUrl: employeeToEdit?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
        };

        if (employeeToEdit) {
            await updateEmployee({ ...employeeToEdit, ...employeeData });
            toast.success(authMessage || "Empleado actualizado");
        } else {
            await addEmployee(employeeData);
            toast.success(authMessage || "Empleado creado");
        }
        onOpenChange(false);

    } catch (error: any) {
        console.error("Error:", error);
        toast.error("Error al guardar");
    } finally {
        setIsProcessing(false);
    }
  };

  const isEditing = !!employeeToEdit;
  const hasAccess = isEditing && !!employeeToEdit.user_id;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
            <DialogDescription>Modifica datos, acceso y horario.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="schedule" disabled={!isEditing}>Horario</TabsTrigger>
              <TabsTrigger value="management" disabled={!isEditing}>Gestión</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 py-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                
                <div className="p-4 bg-slate-50 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        {hasAccess ? <ShieldCheck className="w-4 h-4 text-emerald-600"/> : <Lock className="w-4 h-4 text-amber-500"/>}
                        <span className="text-sm font-semibold text-slate-700">
                            {hasAccess ? 'Acceso (Activo)' : 'Configurar Acceso'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@agencia.com" /></div>
                        <div className="grid gap-2"><Label htmlFor="password">{hasAccess ? 'Nueva Contraseña' : 'Crear Contraseña'}</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={hasAccess ? "Opcional" : "Mínimo 6 chars"} /></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label htmlFor="role">Rol</Label><Input id="role" value={role} onChange={e => setRole(e.target.value)} required /></div>
                  <div className="grid gap-2"><Label htmlFor="dept">Departamento</Label><Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Development">Desarrollo</SelectItem><SelectItem value="Design">Diseño</SelectItem><SelectItem value="Management">Gestión</SelectItem><SelectItem value="Marketing">Marketing</SelectItem></SelectContent></Select></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label htmlFor="capacity">Capacidad (h/sem)</Label><Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
                  <div className="grid gap-2"><Label htmlFor="rate">Coste/Hora (€)</Label><Input id="rate" type="number" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} /></div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isProcessing}>{isProcessing ? 'Guardando...' : 'Guardar Datos'}</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="schedule" className="py-4">
              <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                      <Clock className="h-5 w-5 shrink-0" />
                      <p>Ajusta las horas diarias. Esto recalculará la capacidad semanal automáticamente.</p>
                  </div>
                  {/* Editor editable conectado al estado workSchedule */}
                  <ScheduleEditor 
                      schedule={workSchedule} 
                      onChange={setWorkSchedule} 
                  />
                  <div className="flex justify-end pt-2">
                      <Button onClick={handleSubmit} className="bg-indigo-600">Guardar Horario</Button>
                  </div>
              </div>
            </TabsContent>

            <TabsContent value="management" className="py-4 space-y-4">
               <div className="grid grid-cols-1 gap-4">
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowProjects(true)}><Briefcase className="h-5 w-5 text-indigo-600" /><div className="text-left"><div className="font-semibold">Proyectos</div><div className="text-xs text-muted-foreground">Asignaciones</div></div></Button>
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowGoals(true)}><Target className="h-5 w-5 text-emerald-600" /><div className="text-left"><div className="font-semibold">Objetivos</div><div className="text-xs text-muted-foreground">OKRs</div></div></Button>
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowAbsences(true)}><CalendarClock className="h-5 w-5 text-amber-600" /><div className="text-left"><div className="font-semibold">Ausencias</div><div className="text-xs text-muted-foreground">Vacaciones</div></div></Button>
               </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Sheets Auxiliares */}
      {employeeToEdit && (
        <>
            <ProjectsSheet open={showProjects} onOpenChange={setShowProjects} employeeId={employeeToEdit.id} />
            <ProfessionalGoalsSheet open={showGoals} onOpenChange={setShowGoals} employeeId={employeeToEdit.id} />
            <AbsencesSheet open={showAbsences} onOpenChange={setShowAbsences} employeeId={employeeToEdit.id} />
        </>
      )}
    </>
  );
}
