import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Briefcase, CalendarClock, Target, Users, Mail, Clock } from 'lucide-react';

// Importamos tus componentes existentes para recuperar la funcionalidad
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
  
  // Estados del Formulario Básico
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Development');
  const [capacity, setCapacity] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(0);

  // Estados para abrir los otros Sheets (Proyectos, Ausencias, etc.)
  const [showProjects, setShowProjects] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (open) {
      if (employeeToEdit) {
        setName(employeeToEdit.name);
        setEmail(employeeToEdit.email || '');
        setRole(employeeToEdit.role);
        setDepartment(employeeToEdit.department || 'Development');
        setCapacity(employeeToEdit.defaultWeeklyCapacity);
        setHourlyRate(employeeToEdit.hourlyRate || 0);
      } else {
        // Reset para nuevo empleado
        setName('');
        setEmail('');
        setRole('');
        setDepartment('Development');
        setCapacity(40);
        setHourlyRate(0);
      }
    }
  }, [open, employeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Objeto base del empleado
    const employeeData = {
      name,
      email: email.trim() || undefined, // Email para Login (Supabase)
      role,
      department,
      defaultWeeklyCapacity: Number(capacity),
      hourlyRate: Number(hourlyRate),
      // IMPORTANTE: No sobrescribimos workSchedule si ya existe. 
      // Si es nuevo, ponemos uno por defecto.
      workSchedule: employeeToEdit?.workSchedule || { 
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 
      },
      isActive: true,
      avatarUrl: employeeToEdit?.avatarUrl
    };

    try {
      if (employeeToEdit) {
        await updateEmployee({ ...employeeToEdit, ...employeeData });
      } else {
        await addEmployee(employeeData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error guardando empleado:", error);
    }
  };

  // Si estamos creando uno nuevo, solo mostramos la pestaña de perfil
  // Si estamos editando, mostramos todo (Horario, Gestión, etc.)
  const isEditing = !!employeeToEdit;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Gestión de Empleado' : 'Nuevo Empleado'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Configura perfil, horario, proyectos y objetivos.' 
                : 'Crea el perfil básico. Podrás configurar el horario detallado después de guardarlo.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="schedule" disabled={!isEditing}>Horario</TabsTrigger>
              <TabsTrigger value="management" disabled={!isEditing}>Gestión</TabsTrigger>
            </TabsList>

            {/* PESTAÑA 1: PERFIL BÁSICO + EMAIL */}
            <TabsContent value="profile" className="space-y-4 py-4">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-500" />
                    Email (Login)
                  </Label>
                  <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      placeholder="usuario@agencia.com"
                  />
                  <p className="text-[11px] text-muted-foreground">
                      Vincula este empleado con su cuenta de acceso en Supabase.
                  </p>
                </div>

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
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                        {isEditing ? 'Guardar Cambios' : 'Crear Empleado'}
                    </Button>
                </div>
              </form>
            </TabsContent>

            {/* PESTAÑA 2: HORARIO DETALLADO (Recuperado) */}
            <TabsContent value="schedule" className="py-4">
              {employeeToEdit && (
                <div className="space-y-4">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                        <Clock className="h-5 w-5 shrink-0" />
                        <p>Define las horas laborables exactas para cada día de la semana. Esto afecta al cálculo de capacidad mensual.</p>
                    </div>
                    {/* Renderizamos el editor de horario que ya tenías */}
                    <ScheduleEditor employee={employeeToEdit} />
                </div>
              )}
            </TabsContent>

            {/* PESTAÑA 3: GESTIÓN (Proyectos, OKRs, Ausencias) */}
            <TabsContent value="management" className="py-4 space-y-4">
               <div className="grid grid-cols-1 gap-4">
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4 hover:border-indigo-300 hover:bg-indigo-50" onClick={() => setShowProjects(true)}>
                      <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                          <Briefcase className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-semibold">Proyectos Asignados</div>
                          <div className="text-xs text-muted-foreground">Gestionar asignaciones y proyectos activos.</div>
                      </div>
                  </Button>

                  <Button variant="outline" className="h-auto p-4 justify-start gap-4 hover:border-emerald-300 hover:bg-emerald-50" onClick={() => setShowGoals(true)}>
                      <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                          <Target className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-semibold">Objetivos OKR</div>
                          <div className="text-xs text-muted-foreground">Ver y editar objetivos profesionales trimestrales.</div>
                      </div>
                  </Button>

                  <Button variant="outline" className="h-auto p-4 justify-start gap-4 hover:border-amber-300 hover:bg-amber-50" onClick={() => setShowAbsences(true)}>
                      <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                          <CalendarClock className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-semibold">Ausencias y Vacaciones</div>
                          <div className="text-xs text-muted-foreground">Registrar días libres, bajas o vacaciones.</div>
                      </div>
                  </Button>
               </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* RENDERIZAMOS LOS SHEETS AUXILIARES (Stacking) */}
      {employeeToEdit && (
        <>
            {/* Sheet de Proyectos */}
            <ProjectsSheet 
                open={showProjects} 
                onOpenChange={setShowProjects} 
                employeeId={employeeToEdit.id} 
            />

            {/* Sheet de Objetivos */}
            <ProfessionalGoalsSheet 
                open={showGoals} 
                onOpenChange={setShowGoals} 
                employeeId={employeeToEdit.id} 
            />

            {/* Sheet de Ausencias */}
            <AbsencesSheet 
                open={showAbsences} 
                onOpenChange={setShowAbsences} 
                employeeId={employeeToEdit.id} 
            />
        </>
      )}
    </>
  );
}
