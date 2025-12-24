import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Briefcase, CalendarClock, Target, Mail, Clock, Lock } from 'lucide-react';

// Importamos tus componentes existentes
import { ScheduleEditor } from './ScheduleEditor';
import { ProjectsSheet } from './ProjectsSheet';
import { ProfessionalGoalsSheet } from './ProfessionalGoalsSheet';
import { AbsencesSheet } from './AbsencesSheet';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeToEdit?: Employee | null;
}

export function EmployeeDialog({ open, onOpenChange, employeeToEdit }: EmployeeDialogProps) {
  const { addEmployee, updateEmployee } = useApp();
  
  // Estados del Formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Nuevo estado para contraseña
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Development');
  const [capacity, setCapacity] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [isCreatingAuth, setIsCreatingAuth] = useState(false);

  // Estados para Sheets
  const [showProjects, setShowProjects] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);

  useEffect(() => {
    if (open) {
      if (employeeToEdit) {
        setName(employeeToEdit.name);
        setEmail(employeeToEdit.email || '');
        setPassword(''); // Al editar, no mostramos la contraseña anterior por seguridad
        setRole(employeeToEdit.role);
        setDepartment(employeeToEdit.department || 'Development');
        setCapacity(employeeToEdit.defaultWeeklyCapacity);
        setHourlyRate(employeeToEdit.hourlyRate || 0);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('');
        setDepartment('Development');
        setCapacity(40);
        setHourlyRate(0);
      }
    }
  }, [open, employeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Intentar crear usuario en Auth (Solo si es nuevo y tiene pass)
    let authUserId = employeeToEdit?.user_id;
    
    if (!employeeToEdit && email && password) {
       setIsCreatingAuth(true);
       try {
          // Intentamos llamar a la Edge Function de administración
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: { email, password, name }
          });

          if (!error && data?.user?.id) {
             authUserId = data.user.id;
             toast.success("Usuario de acceso creado correctamente.");
          } else {
             console.warn("No se pudo crear Auth automático (requiere Edge Function). Se creará solo la ficha.");
             // Si falla (porque no hay Edge Function), avisamos pero continuamos
             toast.info("Ficha creada. Crea el acceso manualmente en Supabase o configura Edge Functions.");
          }
       } catch (err) {
          console.error("Error Auth:", err);
       } finally {
          setIsCreatingAuth(false);
       }
    }

    // 2. Guardar ficha de empleado
    const employeeData = {
      name,
      email: email.trim() || undefined,
      user_id: authUserId, // Vinculamos si se creó
      role,
      department,
      defaultWeeklyCapacity: Number(capacity),
      hourlyRate: Number(hourlyRate),
      workSchedule: employeeToEdit?.workSchedule || { 
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 
      },
      isActive: true,
      avatarUrl: employeeToEdit?.avatarUrl
    };

    try {
      if (employeeToEdit) {
        await updateEmployee({ ...employeeToEdit, ...employeeData });
        toast.success("Empleado actualizado");
      } else {
        await addEmployee(employeeData);
        toast.success("Empleado creado");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error guardando empleado:", error);
      toast.error("Error al guardar los datos");
    }
  };

  const isEditing = !!employeeToEdit;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Gestión de Empleado' : 'Nuevo Empleado'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Configura perfil, horario y accesos.' 
                : 'Define los datos básicos y credenciales de acceso.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="schedule" disabled={!isEditing}>Horario</TabsTrigger>
              <TabsTrigger value="management" disabled={!isEditing}>Gestión</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 py-4">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                
                {/* SECCIÓN CREDENCIALES */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="flex items-center gap-2 text-indigo-600">
                        <Mail className="h-4 w-4" />
                        Email (Login)
                      </Label>
                      <Input 
                          id="email" 
                          type="email" 
                          value={email} 
                          onChange={e => setEmail(e.target.value)} 
                          placeholder="usuario@agencia.com"
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="password" className={`flex items-center gap-2 ${isEditing ? 'text-slate-400' : 'text-indigo-600'}`}>
                        <Lock className="h-4 w-4" />
                        {isEditing ? 'Nueva Contraseña' : 'Contraseña Inicial'}
                      </Label>
                      <Input 
                          id="password" 
                          type="password" 
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                          placeholder={isEditing ? "Opcional (cambiar)" : "Mínimo 6 caracteres"}
                          disabled={isEditing && !email} // Solo habilitar si hay email
                      />
                    </div>
                </div>
                {!isEditing && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                        ℹ️ Si defines una contraseña, el sistema intentará crear el usuario automáticamente. 
                    </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="role">Rol</Label>
                      <Input id="role" value={role} onChange={e => setRole(e.target.value)} placeholder="Ej: Senior Dev" required />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="dept">Departamento</Label>
                      <Select value={department} onValueChange={setDepartment}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Development">Desarrollo</SelectItem>
                              <SelectItem value="Design">Diseño</SelectItem>
                              <SelectItem value="Management">Gestión</SelectItem>
                              <SelectItem value="Marketing">Marketing</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="capacity">Capacidad Semanal (h)</Label>
                      <Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="rate">Coste/Hora (€)</Label>
                      <Input id="rate" type="number" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isCreatingAuth}>
                        {isCreatingAuth ? 'Creando Usuario...' : (isEditing ? 'Guardar Cambios' : 'Crear Empleado')}
                    </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="schedule" className="py-4">
              {employeeToEdit && (
                <div className="space-y-4">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                        <Clock className="h-5 w-5 shrink-0" />
                        <p>Horario laborable estándar. Afecta al cálculo de capacidad.</p>
                    </div>
                    <ScheduleEditor employee={employeeToEdit} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="management" className="py-4 space-y-4">
               <div className="grid grid-cols-1 gap-4">
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => setShowProjects(true)}>
                      <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><Briefcase className="h-5 w-5" /></div>
                      <div className="text-left"><div className="font-semibold">Proyectos</div><div className="text-xs text-muted-foreground">Gestionar asignaciones.</div></div>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => setShowGoals(true)}>
                      <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><Target className="h-5 w-5" /></div>
                      <div className="text-left"><div className="font-semibold">Objetivos OKR</div><div className="text-xs text-muted-foreground">Metas trimestrales.</div></div>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => setShowAbsences(true)}>
                      <div className="bg-amber-100 p-2 rounded-full text-amber-600"><CalendarClock className="h-5 w-5" /></div>
                      <div className="text-left"><div className="font-semibold">Ausencias</div><div className="text-xs text-muted-foreground">Vacaciones y bajas.</div></div>
                  </Button>
               </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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
