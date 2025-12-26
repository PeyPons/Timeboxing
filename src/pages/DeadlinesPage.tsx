import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Plus, Pencil, Trash2, Save, Search, Eye, EyeOff, ChevronDown, ChevronRight,
  Calendar, Users, AlertTriangle, CheckCircle2, XCircle, Copy, Filter, Sparkles, Edit
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Deadline, GlobalAssignment } from '@/types';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAbsenceHoursInRange } from '@/utils/absenceUtils';
import { getTeamEventHoursInRange } from '@/utils/teamEventUtils';

export default function DeadlinesPage() {
  const { projects, clients, employees, absences, teamEvents, currentUser } = useApp();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [globalAssignments, setGlobalAssignments] = useState<GlobalAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGlobalDialogOpen, setIsGlobalDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [editingGlobal, setEditingGlobal] = useState<GlobalAssignment | null>(null);
  
  // Estados de filtros y vista
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [onlySEO, setOnlySEO] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [filterByEmployee, setFilterByEmployee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'client' | 'assigned' | 'remaining'>('client');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set());
  
  // Estado para edición inline
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [inlineFormData, setInlineFormData] = useState<{
    employeeHours: Record<string, number>;
    notes: string;
    isHidden: boolean;
  }>({ employeeHours: {}, notes: '', isHidden: false });
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Estado para rastrear quién está editando qué proyecto
  const [editingLocks, setEditingLocks] = useState<Record<string, { employeeId: string; employeeName: string; lockedAt: string }>>({});
  const lockRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [formData, setFormData] = useState({
    projectId: '',
    notes: '',
    employeeHours: {} as Record<string, number>,
    isHidden: false
  });

  const [globalFormData, setGlobalFormData] = useState({
    name: '',
    hours: 0,
    affectsAll: true,
    affectedEmployeeIds: [] as string[]
  });

  // Cargar deadlines desde Supabase
  const loadDeadlines = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setDeadlines(data.map((d: any) => ({
          id: d.id,
          projectId: d.project_id,
          month: d.month,
          notes: d.notes,
          employeeHours: d.employee_hours || {},
          isHidden: d.is_hidden || false
        })));
        
        // Cargar proyectos ocultos
        const hidden = new Set<string>();
        data.forEach((d: any) => {
          if (d.is_hidden) hidden.add(d.project_id);
        });
        setHiddenProjects(hidden);
      }
    } catch (error: any) {
      console.error('Error cargando deadlines:', error);
      toast.error('Error al cargar deadlines');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar asignaciones globales
  const loadGlobalAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('global_assignments')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setGlobalAssignments(data.map((g: any) => ({
          id: g.id,
          month: g.month,
          name: g.name,
          hours: Number(g.hours),
          affectsAll: g.affects_all,
          affectedEmployeeIds: (g.affected_employee_ids || []) as string[]
        })));
      }
    } catch (error: any) {
      console.error('Error cargando asignaciones globales:', error);
    }
  };

  // Cargar al montar y cuando cambia el mes
  useEffect(() => {
    loadDeadlines();
    loadGlobalAssignments();
  }, [selectedMonth]);

  // Suscripción en tiempo real para deadlines
  useEffect(() => {
    const channelName = `deadlines-changes-${selectedMonth}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deadlines',
          filter: `month=eq.${selectedMonth}`
        },
        (payload) => {
          console.log('🔔 Realtime deadline change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newDeadline = payload.new as any;
            setDeadlines(prev => {
              const existing = prev.find(d => d.id === newDeadline.id);
              if (existing) {
                return prev.map(d => 
                  d.id === newDeadline.id 
                    ? {
                        id: newDeadline.id,
                        projectId: newDeadline.project_id,
                        month: newDeadline.month,
                        notes: newDeadline.notes,
                        employeeHours: newDeadline.employee_hours || {},
                        isHidden: newDeadline.is_hidden || false
                      }
                    : d
                );
              } else {
                return [...prev, {
                  id: newDeadline.id,
                  projectId: newDeadline.project_id,
                  month: newDeadline.month,
                  notes: newDeadline.notes,
                  employeeHours: newDeadline.employee_hours || {},
                  isHidden: newDeadline.is_hidden || false
                }];
              }
            });
            
            // Actualizar proyectos ocultos
            if (newDeadline.is_hidden) {
              setHiddenProjects(prev => new Set([...prev, newDeadline.project_id]));
            } else {
              setHiddenProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(newDeadline.project_id);
                return newSet;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setDeadlines(prev => prev.filter(d => d.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de deadlines');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en suscripción Realtime');
        }
      });

    return () => {
      console.log('🔌 Desconectando canal Realtime');
      supabase.removeChannel(channel);
    };
  }, [selectedMonth]);

  // Suscripción en tiempo real para global assignments
  useEffect(() => {
    const channelName = `global-assignments-changes-${selectedMonth}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_assignments',
          filter: `month=eq.${selectedMonth}`
        },
        (payload) => {
          console.log('🔔 Realtime global assignment change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newAssignment = payload.new as any;
            setGlobalAssignments(prev => {
              const existing = prev.find(a => a.id === newAssignment.id);
              if (existing) {
                return prev.map(a => 
                  a.id === newAssignment.id 
                    ? {
                        id: newAssignment.id,
                        name: newAssignment.name,
                        hours: newAssignment.hours,
                        affectsAll: newAssignment.affects_all,
                        affectedEmployeeIds: (newAssignment.affected_employee_ids || []) as string[],
                        month: newAssignment.month
                      }
                    : a
                );
              } else {
                return [...prev, {
                  id: newAssignment.id,
                  name: newAssignment.name,
                  hours: newAssignment.hours,
                  affectsAll: newAssignment.affects_all,
                  affectedEmployeeIds: (newAssignment.affected_employee_ids || []) as string[],
                  month: newAssignment.month
                }];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setGlobalAssignments(prev => prev.filter(a => a.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime global assignments subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de global assignments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en suscripción Realtime de global assignments');
        }
      });

    return () => {
      console.log('🔌 Desconectando canal Realtime de global assignments');
      supabase.removeChannel(channel);
    };
  }, [selectedMonth]);

  // Cargar locks de edición existentes
  useEffect(() => {
    const loadEditingLocks = async () => {
      try {
        const { data, error } = await supabase
          .from('project_editing_locks')
          .select(`
            *,
            employees!inner(id, first_name, name)
          `)
          .eq('month', selectedMonth)
          .gt('expires_at', new Date().toISOString());
        
        if (error) throw error;
        
        if (data) {
          const locksMap: Record<string, { employeeId: string; employeeName: string; lockedAt: string }> = {};
          data.forEach((lock: any) => {
            const employee = employees.find(e => e.id === lock.employee_id);
            if (employee && lock.expires_at > new Date().toISOString()) {
              locksMap[lock.project_id] = {
                employeeId: lock.employee_id,
                employeeName: employee.first_name || employee.name || 'Desconocido',
                lockedAt: lock.locked_at
              };
            }
          });
          setEditingLocks(locksMap);
        }
      } catch (error) {
        console.error('Error cargando locks:', error);
      }
    };
    
    loadEditingLocks();
  }, [selectedMonth, employees]);

  // Suscripción en tiempo real para locks de edición
  useEffect(() => {
    const channelName = `editing-locks-${selectedMonth}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_editing_locks',
          filter: `month=eq.${selectedMonth}`
        },
        (payload) => {
          console.log('🔔 Realtime editing lock change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const lock = payload.new as any;
            // Solo mostrar si no es nuestro propio lock
            if (lock.employee_id !== currentUser?.id && lock.expires_at > new Date().toISOString()) {
              const employee = employees.find(e => e.id === lock.employee_id);
              setEditingLocks(prev => ({
                ...prev,
                [lock.project_id]: {
                  employeeId: lock.employee_id,
                  employeeName: employee?.first_name || employee?.name || 'Alguien',
                  lockedAt: lock.locked_at
                }
              }));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedLock = payload.old as any;
            setEditingLocks(prev => {
              const newLocks = { ...prev };
              delete newLocks[deletedLock.project_id];
              return newLocks;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime editing locks subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMonth, currentUser, employees]);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive).sort((a, b) => 
      (a.first_name || a.name).localeCompare(b.first_name || b.name)
    );
  }, [employees]);

  // Calcular capacidad mensual de un empleado (restando ausencias y eventos)
  const getMonthlyCapacity = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { total: 0, absenceHours: 0, eventHours: 0, available: 0, absenceDetails: [], eventDetails: [] };
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const workSchedule = employee.workSchedule;
    
    // Calcular horas base del horario
    let baseHours = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
      baseHours += workSchedule[dayKey as keyof typeof workSchedule] || 0;
    }
    
    // Restar ausencias (con detalles)
    const employeeAbsences = absences.filter(a => a.employeeId === employeeId);
    const absenceHours = getAbsenceHoursInRange(monthStart, monthEnd, employeeAbsences, workSchedule);
    
    // Calcular detalle de cada ausencia que afecta este mes
    const absenceDetails = employeeAbsences
      .filter(a => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        return start <= monthEnd && end >= monthStart;
      })
      .map(a => {
        const hours = getAbsenceHoursInRange(monthStart, monthEnd, [a], workSchedule);
        return {
          type: a.type,
          startDate: a.startDate,
          endDate: a.endDate,
          hours
        };
      })
      .filter(a => a.hours > 0);
    
    // Restar eventos del equipo (con detalles)
    const eventHours = getTeamEventHoursInRange(monthStart, monthEnd, employeeId, teamEvents, workSchedule, employeeAbsences);
    
    // Calcular detalle de cada evento que afecta este mes
    const eventDetails = teamEvents
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= monthStart && eventDate <= monthEnd;
      })
      .map(e => ({
        name: e.name,
        date: e.date,
        hours: e.hoursOff
      }));
    
    const available = Math.max(0, baseHours - absenceHours - eventHours);
    
    return { total: baseHours, absenceHours, eventHours, available, absenceDetails, eventDetails };
  };

  // Calcular horas asignadas a un empleado (deadlines + globales)
  const getEmployeeAssignedHours = (employeeId: string) => {
    let total = 0;
    
    // Sumar horas de deadlines
    deadlines.forEach(deadline => {
      if (!hiddenProjects.has(deadline.projectId) && !deadline.isHidden) {
        total += deadline.employeeHours[employeeId] || 0;
      }
    });
    
    // Sumar asignaciones globales
    globalAssignments.forEach(assignment => {
      if (assignment.affectsAll || (assignment.affectedEmployeeIds as string[])?.includes(employeeId)) {
        total += assignment.hours;
      }
    });
    
    return total;
  };

  // Filtrar proyectos
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => p.status === 'active');
    
    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const client = clients.find(c => c.id === p.clientId);
        return (
          p.name.toLowerCase().includes(term) ||
          client?.name.toLowerCase().includes(term)
        );
      });
    }
    
    // Filtrar solo SEO (excluir SEM, RRSS, Social, DV360)
    if (onlySEO) {
      filtered = filtered.filter(p => {
        const projectName = p.name.toUpperCase();
        return !projectName.includes('SEM') && 
               !projectName.includes('RRSS') && 
               !projectName.includes('SOCIAL') && 
               !projectName.includes('DV360');
      });
    }
    
    // Filtrar ocultos
    if (!showHidden) {
      filtered = filtered.filter(p => !hiddenProjects.has(p.id));
    }
    
    // Filtrar por empleado asignado
    if (filterByEmployee !== 'all') {
      filtered = filtered.filter(p => {
        const deadline = deadlines.find(d => d.projectId === p.id && d.month === selectedMonth);
        return deadline && (deadline.employeeHours[filterByEmployee] || 0) > 0;
      });
    }
    
    // Filtrar solo proyectos sin asignar
    if (showUnassignedOnly) {
      filtered = filtered.filter(p => {
        const deadline = deadlines.find(d => d.projectId === p.id && d.month === selectedMonth);
        if (!deadline) return true; // Sin deadline = sin asignar
        const totalAssigned = (Object.values(deadline.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0);
        return totalAssigned === 0;
      });
    }
    
    // Ordenar proyectos
    filtered.sort((a, b) => {
      if (sortBy === 'client') {
        const clientA = clients.find(c => c.id === a.clientId)?.name || '';
        const clientB = clients.find(c => c.id === b.clientId)?.name || '';
        return clientA.localeCompare(clientB);
      } else if (sortBy === 'assigned') {
        const deadlineA = deadlines.find(d => d.projectId === a.id && d.month === selectedMonth);
        const deadlineB = deadlines.find(d => d.projectId === b.id && d.month === selectedMonth);
        const totalA = deadlineA ? (Object.values(deadlineA.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0) : 0;
        const totalB = deadlineB ? (Object.values(deadlineB.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0) : 0;
        return totalB - totalA;
      } else {
        const deadlineA = deadlines.find(d => d.projectId === a.id && d.month === selectedMonth);
        const deadlineB = deadlines.find(d => d.projectId === b.id && d.month === selectedMonth);
        const assignedA = deadlineA ? (Object.values(deadlineA.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0) : 0;
        const assignedB = deadlineB ? (Object.values(deadlineB.employeeHours) as number[]).reduce((s, h) => s + (h || 0), 0) : 0;
        const remainingA = (a.budgetHours || 0) - assignedA;
        const remainingB = (b.budgetHours || 0) - assignedB;
        return remainingB - remainingA;
      }
    });
    
    return filtered;
  }, [projects, clients, searchTerm, onlySEO, showHidden, showUnassignedOnly, hiddenProjects, filterByEmployee, deadlines, selectedMonth, sortBy]);

  // Agrupar proyectos por cliente
  const projectsByClient = useMemo(() => {
    const grouped: Record<string, typeof filteredProjects> = {};
    
    filteredProjects.forEach(project => {
      const clientId = project.clientId || 'sin-cliente';
      if (!grouped[clientId]) {
        grouped[clientId] = [];
      }
      grouped[clientId].push(project);
    });
    
    return grouped;
  }, [filteredProjects]);

  // Expandir todos los clientes por defecto
  useEffect(() => {
    const allClientIds = Object.keys(projectsByClient);
    setExpandedClients(new Set(allClientIds));
  }, [projectsByClient]);

  const openDialog = (deadline?: Deadline) => {
    if (deadline) {
      setEditingDeadline(deadline);
      setFormData({
        projectId: deadline.projectId,
        notes: deadline.notes || '',
        employeeHours: { ...deadline.employeeHours },
        isHidden: deadline.isHidden || false
      });
    } else {
      setEditingDeadline(null);
      setFormData({
        projectId: '',
        notes: '',
        employeeHours: {},
        isHidden: false
      });
    }
    setIsDialogOpen(true);
  };

  const openGlobalDialog = (assignment?: GlobalAssignment) => {
    if (assignment) {
      setEditingGlobal(assignment);
      setGlobalFormData({
        name: assignment.name,
        hours: assignment.hours,
        affectsAll: assignment.affectsAll,
        affectedEmployeeIds: assignment.affectedEmployeeIds || []
      });
    } else {
      setEditingGlobal(null);
      setGlobalFormData({
        name: '',
        hours: 0,
        affectsAll: true,
        affectedEmployeeIds: []
      });
    }
    setIsGlobalDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.projectId) {
      toast.error('Selecciona un proyecto');
      return;
    }

    try {
      const deadlineData = {
        project_id: formData.projectId,
        month: selectedMonth,
        notes: formData.notes || null,
        employee_hours: formData.employeeHours,
        is_hidden: formData.isHidden
      };

      if (editingDeadline) {
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', editingDeadline.id);

        if (error) throw error;

        setDeadlines(prev => prev.map(d => 
          d.id === editingDeadline.id 
            ? { ...d, ...deadlineData, projectId: formData.projectId, notes: formData.notes, employeeHours: formData.employeeHours, isHidden: formData.isHidden }
            : d
        ));
        
        if (formData.isHidden) {
          setHiddenProjects(prev => new Set([...prev, formData.projectId]));
        } else {
          setHiddenProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(formData.projectId);
            return newSet;
          });
        }
        
        toast.success('Deadline actualizado');
      } else {
        const { data, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select()
          .single();

        if (error) throw error;

        setDeadlines(prev => [...prev, {
          id: data.id,
          projectId: data.project_id,
          month: data.month,
          notes: data.notes,
          employeeHours: data.employee_hours || {},
          isHidden: data.is_hidden || false
        }]);
        
        if (formData.isHidden) {
          setHiddenProjects(prev => new Set([...prev, formData.projectId]));
        }
        
        toast.success('Deadline creado');
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error guardando deadline:', error);
      toast.error(error.message || 'Error al guardar deadline');
    }
  };

  const handleSaveGlobal = async () => {
    if (!globalFormData.name || globalFormData.hours <= 0) {
      toast.error('Completa todos los campos');
      return;
    }

    try {
      const assignmentData = {
        month: selectedMonth,
        name: globalFormData.name,
        hours: globalFormData.hours,
        affects_all: globalFormData.affectsAll,
        affected_employee_ids: globalFormData.affectsAll ? null : globalFormData.affectedEmployeeIds
      };

      if (editingGlobal) {
        const { error } = await supabase
          .from('global_assignments')
          .update(assignmentData)
          .eq('id', editingGlobal.id);

        if (error) throw error;

        setGlobalAssignments(prev => prev.map(a => 
          a.id === editingGlobal.id 
            ? { ...a, ...assignmentData, month: selectedMonth, name: globalFormData.name, hours: globalFormData.hours, affectsAll: globalFormData.affectsAll, affectedEmployeeIds: globalFormData.affectedEmployeeIds }
            : a
        ));
        toast.success('Asignación global actualizada');
      } else {
        const { data, error } = await supabase
          .from('global_assignments')
          .insert(assignmentData)
          .select()
          .single();

        if (error) throw error;

        setGlobalAssignments(prev => [...prev, {
          id: data.id,
          month: data.month,
          name: data.name,
          hours: data.hours,
          affectsAll: data.affects_all,
          affectedEmployeeIds: data.affected_employee_ids || []
        }]);
        toast.success('Asignación global creada');
      }

      setIsGlobalDialogOpen(false);
    } catch (error: any) {
      console.error('Error guardando asignación global:', error);
      toast.error(error.message || 'Error al guardar asignación global');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este deadline?')) return;

    try {
      const { error } = await supabase
        .from('deadlines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const deleted = deadlines.find(d => d.id === id);
      if (deleted) {
        setHiddenProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(deleted.projectId);
          return newSet;
        });
      }

      setDeadlines(prev => prev.filter(d => d.id !== id));
      toast.success('Deadline eliminado');
    } catch (error: any) {
      console.error('Error eliminando deadline:', error);
      toast.error('Error al eliminar deadline');
    }
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta asignación global?')) return;

    try {
      const { error } = await supabase
        .from('global_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGlobalAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Asignación global eliminada');
    } catch (error: any) {
      console.error('Error eliminando asignación global:', error);
      toast.error('Error al eliminar asignación global');
    }
  };

  // Funciones para gestionar locks de edición
  const acquireEditLock = async (projectId: string) => {
    if (!currentUser) return false;
    
    try {
      // Limpiar locks expirados primero
      await supabase
        .from('project_editing_locks')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      // Intentar adquirir el lock
      const { data, error } = await supabase
        .from('project_editing_locks')
        .upsert({
          project_id: projectId,
          employee_id: currentUser.id,
          month: selectedMonth,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
        }, {
          onConflict: 'project_id,month',
          ignoreDuplicates: false
        })
        .select()
        .single();
      
      if (error) {
        // Si hay un lock existente, verificar si es nuestro
        const { data: existing } = await supabase
          .from('project_editing_locks')
          .select('*, employees!inner(id, first_name, name)')
          .eq('project_id', projectId)
          .eq('month', selectedMonth)
          .single();
        
        if (existing && existing.employee_id !== currentUser.id) {
          const editor = employees.find(e => e.id === existing.employee_id);
          toast.warning(`${editor?.first_name || editor?.name || 'Alguien'} está editando este proyecto`);
          return false;
        }
        // Si es nuestro lock, continuar
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('Error adquiriendo lock:', error);
      return true; // Continuar de todas formas
    }
  };

  const renewEditLock = async (projectId: string) => {
    if (!currentUser || !editingProjectId) return;
    
    try {
      await supabase
        .from('project_editing_locks')
        .update({
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .eq('project_id', projectId)
        .eq('employee_id', currentUser.id)
        .eq('month', selectedMonth);
    } catch (error) {
      console.error('Error renovando lock:', error);
    }
  };

  const releaseEditLock = async (projectId: string) => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('project_editing_locks')
        .delete()
        .eq('project_id', projectId)
        .eq('employee_id', currentUser.id)
        .eq('month', selectedMonth);
    } catch (error) {
      console.error('Error liberando lock:', error);
    }
  };

  // Funciones de edición inline
  const startEditingProject = async (projectId: string) => {
    // Intentar adquirir el lock
    const lockAcquired = await acquireEditLock(projectId);
    if (!lockAcquired) return;
    
    const deadline = getProjectDeadline(projectId);
    setEditingProjectId(projectId);
    setInlineFormData({
      employeeHours: deadline?.employeeHours ? { ...deadline.employeeHours } : {},
      notes: deadline?.notes || '',
      isHidden: deadline?.isHidden || hiddenProjects.has(projectId)
    });
    setExpandedProjects(prev => new Set([...prev, projectId]));
    
    // Renovar el lock cada 2 minutos mientras se edita
    if (lockRefreshIntervalRef.current) {
      clearInterval(lockRefreshIntervalRef.current);
    }
    lockRefreshIntervalRef.current = setInterval(() => {
      if (editingProjectId === projectId) {
        renewEditLock(projectId);
      }
    }, 2 * 60 * 1000);
  };

  const cancelEditingProject = async () => {
    if (editingProjectId) {
      await releaseEditLock(editingProjectId);
    }
    if (lockRefreshIntervalRef.current) {
      clearInterval(lockRefreshIntervalRef.current);
      lockRefreshIntervalRef.current = null;
    }
    setEditingProjectId(null);
    setInlineFormData({ employeeHours: {}, notes: '', isHidden: false });
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        if (editingProjectId === projectId) {
          setEditingProjectId(null);
        }
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const updateInlineEmployeeHours = (employeeId: string, hours: number, projectId: string, immediate = false) => {
    const newFormData = {
      ...inlineFormData,
      employeeHours: {
        ...inlineFormData.employeeHours,
        [employeeId]: hours >= 0 ? hours : 0
      }
    };
    setInlineFormData(newFormData);
    
    // Si es guardado inmediato, cancelar timeout y guardar ahora
    if (immediate) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      autoSaveDeadline(projectId, newFormData);
    } else {
      // Disparar autoguardado con debounce
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      setAutoSaveStatus('idle');
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveDeadline(projectId, newFormData);
      }, 800);
    }
  };

  const autoSaveDeadline = async (projectId: string, formData: typeof inlineFormData) => {
    setAutoSaveStatus('saving');
    try {
      const existingDeadline = getProjectDeadline(projectId);
      const deadlineData = {
        project_id: projectId,
        month: selectedMonth,
        notes: formData.notes || null,
        employee_hours: formData.employeeHours,
        is_hidden: formData.isHidden
      };

      if (existingDeadline) {
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', existingDeadline.id);

        if (error) throw error;
        // No actualizamos el estado local aquí - Realtime lo hará automáticamente
      } else {
        const { data, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select()
          .single();

        if (error) throw error;
        // No actualizamos el estado local aquí - Realtime lo hará automáticamente
      }

      // Actualizar proyectos ocultos localmente (no se sincroniza por Realtime)
      if (formData.isHidden) {
        setHiddenProjects(prev => new Set([...prev, projectId]));
      } else {
        setHiddenProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      }

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 1500);
    } catch (error: any) {
      console.error('Error auto-saving:', error);
      setAutoSaveStatus('idle');
      toast.error('Error al guardar');
    }
  };

  const saveInlineDeadline = async (projectId: string) => {
    setIsSaving(true);
    try {
      const existingDeadline = getProjectDeadline(projectId);
      const deadlineData = {
        project_id: projectId,
        month: selectedMonth,
        notes: inlineFormData.notes || null,
        employee_hours: inlineFormData.employeeHours,
        is_hidden: inlineFormData.isHidden
      };

      if (existingDeadline) {
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', existingDeadline.id);

        if (error) throw error;

        setDeadlines(prev => prev.map(d => 
          d.id === existingDeadline.id 
            ? { ...d, projectId, month: selectedMonth, notes: inlineFormData.notes, employeeHours: inlineFormData.employeeHours, isHidden: inlineFormData.isHidden }
            : d
        ));
      } else {
        const { data, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select()
          .single();

        if (error) throw error;

        setDeadlines(prev => [...prev, {
          id: data.id,
          projectId: data.project_id,
          month: data.month,
          notes: data.notes,
          employeeHours: data.employee_hours || {},
          isHidden: data.is_hidden || false
        }]);
      }

      if (inlineFormData.isHidden) {
        setHiddenProjects(prev => new Set([...prev, projectId]));
      } else {
        setHiddenProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      }

      toast.success('Guardado');
      setEditingProjectId(null);
    } catch (error: any) {
      console.error('Error guardando deadline:', error);
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmployeeHours = (employeeId: string, hours: number) => {
    setFormData(prev => ({
      ...prev,
      employeeHours: {
        ...prev.employeeHours,
        [employeeId]: hours > 0 ? hours : 0
      }
    }));
  };

  const getProjectDeadline = (projectId: string) => {
    return deadlines.find(d => d.projectId === projectId && d.month === selectedMonth);
  };

  const getTotalHours = (deadline: Deadline) => {
    return Object.values(deadline.employeeHours).reduce((sum, hours) => sum + hours, 0);
  };

  // Copiar deadlines del mes anterior
  const copyFromPreviousMonth = async () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = format(subMonths(new Date(year, month - 1), 1), 'yyyy-MM');
    
    try {
      // Cargar deadlines del mes anterior desde la base de datos
      const { data: previousData, error: loadError } = await supabase
        .from('deadlines')
        .select('*')
        .eq('month', prevMonth);
      
      if (loadError) throw loadError;
      
      if (!previousData || previousData.length === 0) {
        toast.error('No hay datos del mes anterior para copiar');
        return;
      }
      
      const previousDeadlines = previousData.map((d: any) => ({
        id: d.id,
        projectId: d.project_id,
        month: d.month,
        notes: d.notes,
        employeeHours: d.employee_hours || {},
        isHidden: d.is_hidden || false
      }));
      
      if (!confirm(`¿Copiar ${previousDeadlines.length} deadlines del mes anterior?`)) return;
      
      let copied = 0;
      let skipped = 0;
      
      for (const deadline of previousDeadlines) {
        // Verificar que no exista ya en el mes actual
        const existing = deadlines.find(d => d.projectId === deadline.projectId);
        if (existing) {
          skipped++;
          continue;
        }
        
        const { data, error } = await supabase
          .from('deadlines')
          .insert({
            project_id: deadline.projectId,
            month: selectedMonth,
            notes: deadline.notes,
            employee_hours: deadline.employeeHours,
            is_hidden: deadline.isHidden
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setDeadlines(prev => [...prev, {
          id: data.id,
          projectId: data.project_id,
          month: data.month,
          notes: data.notes,
          employeeHours: data.employee_hours || {},
          isHidden: data.is_hidden || false
        }]);
        copied++;
      }
      
      if (copied > 0 && skipped > 0) {
        toast.success(`Se copiaron ${copied} deadlines (${skipped} ya existían)`);
      } else if (copied > 0) {
        toast.success(`Se copiaron ${copied} deadlines`);
      } else {
        toast.info('Todos los deadlines ya existían en este mes');
      }
    } catch (error: any) {
      console.error('Error copiando deadlines:', error);
      toast.error(error.message || 'Error al copiar');
    }
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const getMonthOptions = () => {
    const options = [];
    const current = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = addMonths(current, i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: es });
      options.push({ value, label });
    }
    return options;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Cargando deadlines...</div>
      </div>
    );
  }

  // Calcular tips inteligentes de redistribución
  const getRedistributionTips = () => {
    const tips: { from: string; to: string; reason: string; projects: string[] }[] = [];
    const employeeLoads: { id: string; name: string; percentage: number; projects: string[] }[] = [];
    
    // Calcular carga y proyectos de cada empleado SEO (excluir PPC)
    activeEmployees.forEach(emp => {
      const capacityData = getMonthlyCapacity(emp.id);
      const assigned = getEmployeeAssignedHours(emp.id);
      const percentage = capacityData.available > 0 ? Math.round((assigned / capacityData.available) * 100) : 0;
      
      // Obtener proyectos donde está asignado
      const empProjects: string[] = [];
      deadlines.forEach(d => {
        if ((d.employeeHours[emp.id] || 0) > 0) {
          const project = projects.find(p => p.id === d.projectId);
          if (project) empProjects.push(project.id);
        }
      });
      
      employeeLoads.push({ id: emp.id, name: emp.first_name || emp.name, percentage, projects: empProjects });
    });
    
    // Encontrar empleados sobrecargados (>85%) y con capacidad (<70%)
    const overloaded = employeeLoads.filter(e => e.percentage > 85);
    const available = employeeLoads.filter(e => e.percentage < 70);
    
    overloaded.forEach(over => {
      available.forEach(avail => {
        // Solo sugerir si comparten proyectos
        const sharedProjects = over.projects.filter(p => avail.projects.includes(p));
        if (sharedProjects.length > 0) {
          tips.push({
            from: over.name,
            to: avail.name,
            reason: `${over.name} está al ${over.percentage}%, ${avail.name} al ${avail.percentage}%`,
            projects: sharedProjects.map(pid => projects.find(p => p.id === pid)?.name || '').filter(Boolean)
          });
        }
      });
    });
    
    return tips.slice(0, 3); // Máximo 3 tips
  };

  const redistributionTips = getRedistributionTips();

  return (
    <div className="flex gap-6 p-6 min-h-screen bg-slate-50">
      {/* Columna principal - Proyectos */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Deadline</h1>
            <p className="text-sm text-slate-500">Asignación mensual de horas</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-9">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={copyFromPreviousMonth}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar del mes anterior</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border shadow-sm p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar proyecto o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 border-slate-200"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              id="only-seo"
              checked={onlySEO}
              onCheckedChange={setOnlySEO}
              className="scale-90"
            />
            <span className="text-slate-600">Solo SEO</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              id="show-hidden"
              checked={showHidden}
              onCheckedChange={setShowHidden}
              className="scale-90"
            />
            <span className="text-slate-600">Ocultos</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              id="show-unassigned"
              checked={showUnassignedOnly}
              onCheckedChange={setShowUnassignedOnly}
              className="scale-90"
            />
            <span className="text-orange-600 font-medium">Sin asignar</span>
          </label>
        </div>
        <Select value={filterByEmployee} onValueChange={setFilterByEmployee}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {activeEmployees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.first_name || emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Por cliente</SelectItem>
            <SelectItem value="assigned">Más asignado</SelectItem>
            <SelectItem value="remaining">Más disponible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Proyectos por cliente */}
      <div className="space-y-3">
        {Object.keys(projectsByClient).length === 0 ? (
          <div className="text-center text-slate-500 py-8 bg-white rounded-xl border">
            No hay proyectos para mostrar
          </div>
        ) : (
          Object.entries(projectsByClient).map(([clientId, clientProjects]) => {
            const client = clients.find(c => c.id === clientId);
            const isExpanded = expandedClients.has(clientId);
            
            return (
              <div key={clientId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Cabecera del cliente */}
                <button
                  onClick={() => toggleClient(clientId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: client?.color || '#6b7280' }}
                  />
                  <span className="font-bold text-slate-800">{client?.name || 'Sin cliente'}</span>
                  <span className="text-sm text-slate-400">({clientProjects.length} proyectos)</span>
                </button>
                
                {/* Proyectos del cliente */}
                {isExpanded && (
                  <div className="border-t divide-y divide-slate-100">
                    {clientProjects.map(project => {
                      const deadline = getProjectDeadline(project.id);
                      const isEditing = editingProjectId === project.id;
                      const currentHours = isEditing ? inlineFormData.employeeHours : (deadline?.employeeHours || {});
                      const totalAssigned = (Object.values(currentHours) as number[]).reduce((sum, h) => sum + (h || 0), 0);
                      const isOverBudget = totalAssigned > (project.budgetHours || 0);
                      const isUnderMin = project.minimumHours != null && project.minimumHours > 0 && totalAssigned < project.minimumHours;
                      const isHidden = isEditing ? inlineFormData.isHidden : hiddenProjects.has(project.id);
                      
                      const projectNotes = deadline?.notes;
                      
                      return (
                        <div 
                          key={project.id} 
                          className={cn(
                            isHidden && "opacity-40",
                            isEditing && "bg-indigo-50/40",
                            isOverBudget && !isEditing && "bg-red-50/40"
                          )}
                        >
                          {/* Fila del proyecto - clickeable para editar */}
                          <div 
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                              isEditing && "hover:bg-indigo-50/40"
                            )}
                            onClick={() => !isEditing && startEditingProject(project.id)}
                          >
                            {/* Info del proyecto */}
                            <div className="min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-slate-800">{project.name}</span>
                                {isHidden && <EyeOff className="h-3 w-3 text-slate-400 flex-shrink-0" />}
                                {/* Indicador de edición concurrente */}
                                {!isEditing && editingLocks[project.id] && editingLocks[project.id].employeeId !== currentUser?.id && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 border-amber-200 text-amber-700">
                                    <Edit className="h-2.5 w-2.5 mr-1" />
                                    {editingLocks[project.id].employeeName}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {project.minimumHours != null && project.minimumHours > 0 && (
                                  <span className="text-orange-500 mr-1">mín {project.minimumHours}h ·</span>
                                )}
                                <span>máx {project.budgetHours}h</span>
                              </div>
                              {/* Notas visibles si existen */}
                              {projectNotes && !isEditing && (
                                <div className="text-[11px] text-indigo-500 mt-0.5 italic truncate max-w-[200px]">
                                  📝 {projectNotes}
                                </div>
                              )}
                            </div>
                            
                            {/* Equipo asignado */}
                            <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                              {!isEditing && activeEmployees.map(emp => {
                                const hours = (currentHours as Record<string, number>)[emp.id] || 0;
                                if (hours === 0) return null;
                                return (
                                  <div 
                                    key={emp.id} 
                                    className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2 py-1"
                                  >
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={emp.avatarUrl} alt={emp.name} />
                                      <AvatarFallback className="bg-indigo-500 text-white text-[9px]">
                                        {(emp.first_name || emp.name)[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-slate-600">{emp.first_name || emp.name}</span>
                                    <span className="text-xs font-mono font-bold text-indigo-600">{hours}h</span>
                                  </div>
                                );
                              })}
                              {!isEditing && totalAssigned === 0 && (
                                <span className="text-xs text-slate-400 italic">Clic para asignar</span>
                              )}
                            </div>
                            
                            {/* Total */}
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={cn(
                                  "font-mono font-bold text-sm",
                                  isOverBudget ? "text-red-600" : 
                                  isUnderMin ? "text-orange-500" : 
                                  totalAssigned > 0 ? "text-slate-700" : "text-slate-400"
                                )}>
                                  {totalAssigned}h
                                </span>
                                <span className="text-xs text-slate-400">/{project.budgetHours}h</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Panel de edición */}
                          {isEditing && (
                            <div className="px-4 py-3 bg-slate-50 border-t">
                              <div className="flex flex-wrap gap-2 mb-3">
                                {activeEmployees.map(emp => (
                                  <div key={emp.id} className="flex items-center gap-2 bg-white border rounded-lg px-2.5 py-1.5">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={emp.avatarUrl} alt={emp.name} />
                                      <AvatarFallback className="bg-indigo-500 text-white text-[9px]">
                                        {(emp.first_name || emp.name)[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-slate-600">{emp.first_name || emp.name}</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={inlineFormData.employeeHours[emp.id] || ''}
                                      onChange={(e) => updateInlineEmployeeHours(emp.id, parseFloat(e.target.value) || 0, project.id)}
                                      onBlur={() => {
                                        const currentHours = inlineFormData.employeeHours[emp.id] || 0;
                                        updateInlineEmployeeHours(emp.id, currentHours, project.id, true);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const currentHours = inlineFormData.employeeHours[emp.id] || 0;
                                          updateInlineEmployeeHours(emp.id, currentHours, project.id, true);
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      className="h-7 w-20 text-center font-mono text-sm px-2"
                                      placeholder="0"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                                <Input
                                  placeholder="Notas..."
                                  value={inlineFormData.notes}
                                  onChange={(e) => {
                                    const newNotes = e.target.value;
                                    const newFormData = { ...inlineFormData, notes: newNotes };
                                    setInlineFormData(newFormData);
                                    // Autoguardar notas
                                    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                    autoSaveTimeoutRef.current = setTimeout(() => {
                                      autoSaveDeadline(project.id, newFormData);
                                    }, 800);
                                  }}
                                  onBlur={() => {
                                    if (autoSaveTimeoutRef.current) {
                                      clearTimeout(autoSaveTimeoutRef.current);
                                      autoSaveTimeoutRef.current = null;
                                    }
                                    autoSaveDeadline(project.id, inlineFormData);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (autoSaveTimeoutRef.current) {
                                        clearTimeout(autoSaveTimeoutRef.current);
                                        autoSaveTimeoutRef.current = null;
                                      }
                                      autoSaveDeadline(project.id, inlineFormData);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="h-7 text-xs flex-1 min-w-[150px]"
                                />
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <Switch
                                    checked={inlineFormData.isHidden}
                                    onCheckedChange={(checked) => {
                                      const newFormData = { ...inlineFormData, isHidden: checked };
                                      setInlineFormData(newFormData);
                                      // Guardar inmediatamente al cambiar ocultar
                                      autoSaveDeadline(project.id, newFormData);
                                    }}
                                    className="scale-75"
                                  />
                                  <span className="text-slate-500">Ocultar</span>
                                </label>
                                <div className="ml-auto flex items-center gap-2 text-xs">
                                  {autoSaveStatus === 'saving' && (
                                    <span className="text-slate-400 animate-pulse">Guardando...</span>
                                  )}
                                  {autoSaveStatus === 'saved' && (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Guardado
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-slate-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingProject();
                                    }}
                                  >
                                    Cerrar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Panel lateral sticky - Disponibilidad del equipo */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-6 space-y-4">
          {/* Disponibilidad en tiempo real */}
          <div className="bg-white rounded-xl border shadow-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Disponibilidad
            </h3>
            <div className="space-y-2">
              {activeEmployees.map(emp => {
                const capacityData = getMonthlyCapacity(emp.id);
                const assigned = getEmployeeAssignedHours(emp.id);
                const available = capacityData.available;
                const percentage = available > 0 ? Math.round((assigned / available) * 100) : 0;
                const remaining = available - assigned;
                const status = percentage > 100 ? 'overload' : percentage > 85 ? 'warning' : 'healthy';
                const hasReductions = capacityData.absenceHours > 0 || capacityData.eventHours > 0;
                
                return (
                  <TooltipProvider key={emp.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help">
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarImage src={emp.avatarUrl} alt={emp.name} />
                            <AvatarFallback className="bg-indigo-500 text-white text-[9px]">
                              {(emp.first_name || emp.name)[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate font-medium text-slate-700">
                                {emp.first_name || emp.name}
                                {hasReductions && <span className="text-orange-400 ml-1">*</span>}
                              </span>
                              <span className={cn(
                                "font-mono font-bold",
                                status === 'overload' ? "text-red-600" : 
                                status === 'warning' ? "text-orange-600" : 
                                "text-emerald-600"
                              )}>
                                {percentage}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Progress 
                                value={Math.min(percentage, 100)} 
                                className={cn(
                                  "h-1 flex-1",
                                  status === 'overload' && "[&>div]:bg-red-500",
                                  status === 'warning' && "[&>div]:bg-orange-500",
                                  status === 'healthy' && "[&>div]:bg-emerald-500"
                                )}
                              />
                              <span className={cn(
                                "text-[10px] font-mono w-10 text-right",
                                remaining < 0 ? "text-red-500" : "text-slate-400"
                              )}>
                                {remaining.toFixed(0)}h
                              </span>
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs max-w-[250px]">
                        <div className="space-y-1.5">
                          <div className="font-medium text-slate-100">{emp.first_name || emp.name}</div>
                          <div className="text-slate-400">Base mensual: {capacityData.total.toFixed(1)}h</div>
                          
                          {capacityData.absenceDetails.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-red-400 font-medium">Ausencias:</div>
                              {capacityData.absenceDetails.map((a, i) => (
                                <div key={i} className="text-red-300 pl-2 text-[11px]">
                                  • {a.type === 'vacation' ? 'Vacaciones' : 
                                     a.type === 'sick' ? 'Baja médica' : 
                                     a.type === 'personal' ? 'Personal' : a.type}
                                  : -{a.hours.toFixed(1)}h
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {capacityData.eventDetails.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-orange-400 font-medium">Eventos:</div>
                              {capacityData.eventDetails.map((e, i) => (
                                <div key={i} className="text-orange-300 pl-2 text-[11px]">
                                  • {e.name}: -{e.hours}h
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="border-t border-slate-600 pt-1.5 mt-1.5">
                            <span className="text-slate-400">Disponible: </span>
                            <span className="font-mono font-bold text-white">{available.toFixed(1)}h</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          {/* Tips de redistribución */}
          {redistributionTips.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Sugerencias
              </h3>
              <div className="space-y-2">
                {redistributionTips.map((tip, i) => (
                  <div key={i} className="text-xs bg-white border border-orange-100 rounded p-2">
                    <div className="font-medium text-slate-800 mb-0.5">
                      {tip.from} → {tip.to}
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {tip.reason}
                    </div>
                    {tip.projects.length > 0 && (
                      <div className="text-[10px] text-orange-600 mt-1">
                        En común: {tip.projects.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tareas globales compactas */}
          <div className="bg-white rounded-xl border shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Otras asignaciones
              </h3>
              <Button onClick={() => openGlobalDialog()} size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {globalAssignments.length === 0 ? (
              <div className="text-[10px] text-slate-400 italic">Sin asignaciones extra</div>
            ) : (
              <div className="space-y-1">
                {globalAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs group">
                    <span className="truncate text-slate-600">{a.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-indigo-600">+{a.hours}h</span>
                      <button 
                        onClick={() => openGlobalDialog(a)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog para asignaciones globales */}
      <Dialog open={isGlobalDialogOpen} onOpenChange={setIsGlobalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingGlobal ? 'Editar Asignación Global' : 'Nueva Asignación Global'}
            </DialogTitle>
            <DialogDescription>
              Tareas que afectan a uno o más empleados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la tarea</Label>
              <Input
                placeholder="Ej: Deadline afecta a todos, Creación timeboxing"
                value={globalFormData.name}
                onChange={(e) => setGlobalFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Horas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={globalFormData.hours || ''}
                onChange={(e) => setGlobalFormData(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
                placeholder="Ej: 2.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="affects-all"
                checked={globalFormData.affectsAll}
                onCheckedChange={(checked) => setGlobalFormData(prev => ({ ...prev, affectsAll: checked }))}
              />
              <Label htmlFor="affects-all" className="cursor-pointer">
                Afecta a todos los empleados
              </Label>
            </div>

            {!globalFormData.affectsAll && (
              <div className="space-y-2">
                <Label>Seleccionar empleados</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                  {activeEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`emp-${emp.id}`}
                        checked={globalFormData.affectedEmployeeIds?.includes(emp.id)}
                        onChange={(e) => {
                          const ids = (globalFormData.affectedEmployeeIds || []) as string[];
                          if (e.target.checked) {
                            setGlobalFormData(prev => ({ ...prev, affectedEmployeeIds: [...ids, emp.id] }));
                          } else {
                            setGlobalFormData(prev => ({ ...prev, affectedEmployeeIds: ids.filter(id => id !== emp.id) }));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`emp-${emp.id}`} className="cursor-pointer text-sm">
                        {emp.first_name || emp.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGlobalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGlobal} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

