import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Employee, WorkSchedule, EmployeeRole } from '@/types';
import { UserPermissions, PERMISSION_LABELS, DEFAULT_PERMISSIONS } from '@/types/permissions';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Briefcase, CalendarClock, Target, Lock, Clock, ShieldCheck, Hash, Key } from 'lucide-react';

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
  const [role, setRole] = useState<Employee['role']>('SEO');
  const [department, setDepartment] = useState('SEO');
  const [capacity, setCapacity] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [crmUserId, setCrmUserId] = useState<number | ''>('');
  
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(defaultSchedule);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  
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
        setRole(employeeToEdit.role || 'SEO');
        setDepartment(employeeToEdit.department || 'SEO');
        setCapacity(employeeToEdit.defaultWeeklyCapacity);
        setHourlyRate(employeeToEdit.hourlyRate || 0);
        setCrmUserId(employeeToEdit.crmUserId || '');
        setWorkSchedule(employeeToEdit.workSchedule || defaultSchedule);
        setPermissions(employeeToEdit.permissions || DEFAULT_PERMISSIONS);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('SEO');
        setDepartment('SEO');
        setCapacity(40);
        setHourlyRate(0);
        setCrmUserId('');
        setWorkSchedule(defaultSchedule);
        setPermissions(DEFAULT_PERMISSIONS);
      }
    }
  }, [open, employeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    let authUserId = employeeToEdit?.user_id;
    let authMessage = "";

    try {
        const isNewEmployee = !employeeToEdit;
        const hasPassword = password.length >= 6;
        
        // Para NUEVOS empleados, es OBLIGATORIO crear cuenta de acceso
        if (isNewEmployee) {
            if (!email || !email.trim()) {
                toast.error("El email es obligatorio para crear un nuevo empleado");
                setIsProcessing(false);
                return;
            }
            if (!hasPassword) {
                toast.error("La contraseña es obligatoria (mínimo 6 caracteres) para crear un nuevo empleado");
                setIsProcessing(false);
                return;
            }
            
            // Crear usuario en Supabase Auth
            console.log('[EmployeeDialog] Creando usuario en Auth:', email);
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: { email, password, name }
            });
            
            if (error) {
                console.error('[EmployeeDialog] Error en create-user:', error);
                
                // Intentar obtener más detalles del error
                let errorMessage = 'Error al crear cuenta de acceso';
                if (error.message) {
                    errorMessage = error.message;
                } else if (error.context) {
                    errorMessage = error.context.message || errorMessage;
                }
                
                // Si el error viene de la función, intentar parsear el body
                if (error.context?.body) {
                    try {
                        const errorBody = typeof error.context.body === 'string' 
                            ? JSON.parse(error.context.body) 
                            : error.context.body;
                        if (errorBody.error) {
                            errorMessage = errorBody.error;
                        }
                    } catch (e) {
                        // Ignorar error de parsing
                    }
                }
                
                throw new Error(errorMessage);
            }
            
            if (!data?.user?.id) {
                console.error('[EmployeeDialog] No se recibió user.id. Respuesta completa:', data);
                throw new Error('No se pudo crear la cuenta de acceso. La función no devolvió un ID de usuario. Verifica que la Edge Function "create-user" esté desplegada en Supabase.');
            }
            
            authUserId = data.user.id;
            authMessage = "Empleado y cuenta de acceso creados.";
            console.log('[EmployeeDialog] Usuario Auth creado:', authUserId);
        } 
        // Para empleados EXISTENTES, solo actualizar si hay nueva contraseña
        else if (hasPassword) {
            if (!email) {
                toast.error("Debes proporcionar un email para actualizar el acceso");
                setIsProcessing(false);
                return;
            }
            
            if (employeeToEdit?.user_id) {
                // Ya tiene cuenta de auth -> actualizar credenciales
                const { error } = await supabase.functions.invoke('update-user', {
                    body: { userId: employeeToEdit.user_id, password, email }
                });
                if (error) throw error;
                authMessage = "Credenciales actualizadas.";
            } else {
                // Empleado existente SIN cuenta de auth -> crear nueva
                console.log('[EmployeeDialog] Creando cuenta Auth para empleado existente:', email);
                const { data, error } = await supabase.functions.invoke('create-user', {
                    body: { email, password, name }
                });
                
                if (error) {
                    console.error('[EmployeeDialog] Error en create-user:', error);
                    
                    // Intentar obtener más detalles del error
                    let errorMessage = 'Error al crear cuenta de acceso';
                    if (error.message) {
                        errorMessage = error.message;
                    } else if (error.context) {
                        errorMessage = error.context.message || errorMessage;
                    }
                    
                    // Si el error viene de la función, intentar parsear el body
                    if (error.context?.body) {
                        try {
                            const errorBody = typeof error.context.body === 'string' 
                                ? JSON.parse(error.context.body) 
                                : error.context.body;
                            if (errorBody.error) {
                                errorMessage = errorBody.error;
                            }
                        } catch (e) {
                            // Ignorar error de parsing
                        }
                    }
                    
                    throw new Error(errorMessage);
                }
                
                if (!data?.user?.id) {
                    console.error('[EmployeeDialog] No se recibió user.id. Respuesta completa:', data);
                    throw new Error('No se pudo crear la cuenta de acceso. La función no devolvió un ID de usuario.');
                }
                
                authUserId = data.user.id;
                authMessage = "Cuenta de acceso creada.";
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
            crmUserId: crmUserId !== '' ? Number(crmUserId) : undefined,
            workSchedule: workSchedule,
            permissions: permissions,
            isActive: true,
            avatarUrl: employeeToEdit?.avatarUrl || `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${name}`
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
        console.error("Error completo:", error);
        
        // Intentar extraer el mensaje de error más descriptivo
        let errorMsg = "Error al guardar";
        
        if (error?.message) {
            errorMsg = error.message;
        } else if (error?.error?.message) {
            errorMsg = error.error.message;
        } else if (typeof error === 'string') {
            errorMsg = error;
        }
        
        // Mensajes específicos para errores comunes
        if (errorMsg.includes("already been registered") || errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
            toast.error("Este email ya tiene una cuenta. Usa otro email.");
        } else if (errorMsg.includes("invalid email") || errorMsg.includes("email")) {
            toast.error("El formato del email no es válido.");
        } else if (errorMsg.includes("password") && errorMsg.includes("weak")) {
            toast.error("La contraseña es demasiado débil. Usa al menos 6 caracteres.");
        } else if (errorMsg.includes("Edge Function") || errorMsg.includes("desplegada")) {
            toast.error("Error: La función 'create-user' no está desplegada. Contacta al administrador.");
        } else {
            toast.error(errorMsg);
        }
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
            <DialogTitle>{isEditing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
            <DialogDescription>Modifica datos, acceso y horario.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="permissions" disabled={!isEditing}>Permisos</TabsTrigger>
              <TabsTrigger value="schedule" disabled={!isEditing}>Horario</TabsTrigger>
              <TabsTrigger value="management" disabled={!isEditing}>Gestión</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 py-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                
                <div className={`p-4 border rounded-lg space-y-4 ${isEditing ? 'bg-slate-50' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        {hasAccess ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-600"/>
                            <span className="text-sm font-semibold text-slate-700">Acceso activo</span>
                          </>
                        ) : isEditing ? (
                          <>
                            <Lock className="w-4 h-4 text-red-500"/>
                            <span className="text-sm font-semibold text-red-700">Sin acceso al sistema</span>
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 text-amber-600"/>
                            <span className="text-sm font-semibold text-amber-800">Configurar acceso (obligatorio)</span>
                          </>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">
                              Email {!isEditing && <span className="text-red-500">*</span>}
                            </Label>
                            <Input 
                              id="email" 
                              type="email" 
                              value={email} 
                              onChange={e => setEmail(e.target.value)} 
                              placeholder="usuario@agencia.com"
                              required={!isEditing}
                              className={!isEditing && !email ? 'border-amber-300' : ''}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">
                              {hasAccess ? 'Nueva contraseña' : 'Contraseña'}
                              {!isEditing && <span className="text-red-500">*</span>}
                            </Label>
                            <Input 
                                id="password" 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                placeholder={hasAccess ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
                                autoComplete="new-password"
                                required={!isEditing}
                                className={!isEditing && password.length < 6 ? 'border-amber-300' : ''}
                            />
                        </div>
                    </div>
                    <p className={`text-xs ${isEditing ? 'text-slate-500' : 'text-amber-700'}`}>
                        {hasAccess 
                            ? "Deja la contraseña vacía si no quieres cambiarla." 
                            : isEditing 
                              ? "Este empleado no puede acceder al sistema. Introduce email y contraseña para habilitarlo."
                              : "El email y la contraseña son obligatorios para que el empleado pueda acceder al sistema."}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="role">Rol</Label>
                      <Select value={role} onValueChange={setRole} required>
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Responsable">Responsable</SelectItem>
                          <SelectItem value="Coordinador">Coordinador</SelectItem>
                          <SelectItem value="SEO">SEO</SelectItem>
                          <SelectItem value="PPC">PPC</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="dept">Departamento</Label>
                      <Select value={department} onValueChange={setDepartment}>
                          <SelectTrigger>
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="SEO">SEO</SelectItem>
                              <SelectItem value="PPC">PPC</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="capacity">Capacidad (h/sem)</Label>
                      <Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="rate">Coste/Hora (€)</Label>
                      <Input id="rate" type="number" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} />
                  </div>
                </div>

                {/* Campo CRM User ID */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-purple-600"/>
                        <span className="text-sm font-semibold text-purple-800">Integración CRM</span>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="crmUserId" className="text-purple-700">ID Usuario CRM</Label>
                        <Input 
                            id="crmUserId" 
                            type="number" 
                            value={crmUserId} 
                            onChange={e => setCrmUserId(e.target.value ? Number(e.target.value) : '')} 
                            placeholder="Ej: 33"
                            className="bg-white"
                        />
                        <p className="text-xs text-purple-600">
                            Este ID se usa para exportar tareas al CRM. Déjalo vacío si no aplica.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isProcessing}>
                        {isProcessing ? 'Guardando...' : 'Guardar datos'}
                    </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="permissions" className="py-4 space-y-4">
              <div className="bg-indigo-50 text-indigo-800 p-3 rounded-md text-sm flex gap-2">
                <Key className="h-5 w-5 shrink-0" />
                <p>Controla a qué secciones puede acceder este empleado. Si un permiso está desactivado, no verá esa sección en el menú.</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Gestión</h3>
                  {(['can_access_planner', 'can_access_projects', 'can_access_clients', 'can_access_team'] as const).map((permission) => (
                    <div key={permission} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <Label htmlFor={permission} className="text-sm font-medium cursor-pointer">
                          {PERMISSION_LABELS[permission]}
                        </Label>
                      </div>
                      <Switch
                        id={permission}
                        checked={permissions[permission] !== false}
                        onCheckedChange={(checked) => 
                          setPermissions(prev => ({ ...prev, [permission]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">PPC</h3>
                  {(['can_access_google_ads', 'can_access_meta_ads', 'can_access_ads_reports'] as const).map((permission) => (
                    <div key={permission} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <Label htmlFor={permission} className="text-sm font-medium cursor-pointer">
                          {PERMISSION_LABELS[permission]}
                        </Label>
                      </div>
                      <Switch
                        id={permission}
                        checked={permissions[permission] !== false}
                        onCheckedChange={(checked) => 
                          setPermissions(prev => ({ ...prev, [permission]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Análisis</h3>
                  {(['can_access_reports', 'can_access_client_reports'] as const).map((permission) => (
                    <div key={permission} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <Label htmlFor={permission} className="text-sm font-medium cursor-pointer">
                          {PERMISSION_LABELS[permission]}
                        </Label>
                      </div>
                      <Switch
                        id={permission}
                        checked={permissions[permission] !== false}
                        onCheckedChange={(checked) => 
                          setPermissions(prev => ({ ...prev, [permission]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Otros</h3>
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                    <div className="flex-1">
                      <Label htmlFor="can_access_deadlines" className="text-sm font-medium cursor-pointer">
                        {PERMISSION_LABELS.can_access_deadlines}
                      </Label>
                    </div>
                    <Switch
                      id="can_access_deadlines"
                      checked={permissions.can_access_deadlines !== false}
                      onCheckedChange={(checked) => 
                        setPermissions(prev => ({ ...prev, can_access_deadlines: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSubmit} className="bg-indigo-600" disabled={isProcessing}>
                  {isProcessing ? 'Guardando...' : 'Guardar permisos'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="py-4">
              <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                      <Clock className="h-5 w-5 shrink-0" />
                      <p>Ajusta las horas diarias. Esto recalculará la capacidad semanal automáticamente.</p>
                  </div>
                  <ScheduleEditor 
                      schedule={workSchedule} 
                      onChange={setWorkSchedule} 
                  />
                  <div className="flex justify-end pt-2">
                      <Button onClick={handleSubmit} className="bg-indigo-600">Guardar horario</Button>
                  </div>
              </div>
            </TabsContent>

            <TabsContent value="management" className="py-4 space-y-4">
               <div className="grid grid-cols-1 gap-4">
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowProjects(true)}>
                      <Briefcase className="h-5 w-5 text-indigo-600" />
                      <div className="text-left">
                          <div className="font-semibold">Proyectos</div>
                          <div className="text-xs text-muted-foreground">Asignaciones</div>
                      </div>
                  </Button>
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowGoals(true)}>
                      <Target className="h-5 w-5 text-emerald-600" />
                      <div className="text-left">
                          <div className="font-semibold">Objetivos</div>
                          <div className="text-xs text-muted-foreground">OKRs</div>
                      </div>
                  </Button>
                  <Button variant="outline" className="justify-start gap-4 h-auto p-4" onClick={() => setShowAbsences(true)}>
                      <CalendarClock className="h-5 w-5 text-amber-600" />
                      <div className="text-left">
                          <div className="font-semibold">Ausencias</div>
                          <div className="text-xs text-muted-foreground">Vacaciones</div>
                      </div>
                  </Button>
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
