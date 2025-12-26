import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Deadline } from '@/types';
import { cn } from '@/lib/utils';

export default function DeadlinesPage() {
  const { projects, clients, employees, isAdmin } = useApp();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  
  const [formData, setFormData] = useState({
    projectId: '',
    notes: '',
    employeeHours: {} as Record<string, number>
  });

  // Cargar deadlines desde Supabase
  const loadDeadlines = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setDeadlines(data.map((d: any) => ({
          id: d.id,
          projectId: d.project_id,
          notes: d.notes,
          employeeHours: d.employee_hours || {}
        })));
      }
    } catch (error: any) {
      console.error('Error cargando deadlines:', error);
      toast.error('Error al cargar deadlines');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar al montar el componente
  useEffect(() => {
    loadDeadlines();
  }, []);

  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status === 'active')
      .sort((a, b) => {
        const clientA = clients.find(c => c.id === a.clientId)?.name || '';
        const clientB = clients.find(c => c.id === b.clientId)?.name || '';
        return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
      });
  }, [projects, clients]);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive).sort((a, b) => 
      (a.first_name || a.name).localeCompare(b.first_name || b.name)
    );
  }, [employees]);

  const openDialog = (deadline?: Deadline) => {
    if (deadline) {
      setEditingDeadline(deadline);
      setFormData({
        projectId: deadline.projectId,
        notes: deadline.notes || '',
        employeeHours: { ...deadline.employeeHours }
      });
    } else {
      setEditingDeadline(null);
      setFormData({
        projectId: '',
        notes: '',
        employeeHours: {}
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.projectId) {
      toast.error('Selecciona un proyecto');
      return;
    }

    try {
      const deadlineData = {
        project_id: formData.projectId,
        notes: formData.notes || null,
        employee_hours: formData.employeeHours
      };

      if (editingDeadline) {
        // Actualizar
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', editingDeadline.id);

        if (error) throw error;

        setDeadlines(prev => prev.map(d => 
          d.id === editingDeadline.id 
            ? { ...d, ...deadlineData, projectId: formData.projectId, notes: formData.notes, employeeHours: formData.employeeHours }
            : d
        ));
        toast.success('Deadline actualizado');
      } else {
        // Crear
        const { data, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select()
          .single();

        if (error) throw error;

        setDeadlines(prev => [...prev, {
          id: data.id,
          projectId: data.project_id,
          notes: data.notes,
          employeeHours: data.employee_hours || {}
        }]);
        toast.success('Deadline creado');
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error guardando deadline:', error);
      toast.error(error.message || 'Error al guardar deadline');
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

      setDeadlines(prev => prev.filter(d => d.id !== id));
      toast.success('Deadline eliminado');
    } catch (error: any) {
      console.error('Error eliminando deadline:', error);
      toast.error('Error al eliminar deadline');
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
    return deadlines.find(d => d.projectId === projectId);
  };

  const getTotalHours = (deadline: Deadline) => {
    return Object.values(deadline.employeeHours).reduce((sum, hours) => sum + hours, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Cargando deadlines...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Deadlines</h1>
          <p className="text-slate-500 mt-1">Asignación de horas por proyecto y empleado</p>
        </div>
        {isAdmin && (
          <Button onClick={() => openDialog()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Nuevo Deadline
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asignaciones de Horas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Cliente</TableHead>
                  <TableHead className="w-[200px]">Proyecto</TableHead>
                  <TableHead className="w-[120px] text-center">Horas Contratadas</TableHead>
                  <TableHead className="w-[200px]">Anotaciones</TableHead>
                  {activeEmployees.map(emp => (
                    <TableHead key={emp.id} className="w-[100px] text-center min-w-[100px]">
                      <div className="truncate" title={emp.first_name || emp.name}>
                        {emp.first_name || emp.name}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[120px] text-center">Total Asignado</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeEmployees.length + 5} className="text-center text-slate-500 py-8">
                      No hay proyectos activos
                    </TableCell>
                  </TableRow>
                ) : (
                  activeProjects.map(project => {
                    const client = clients.find(c => c.id === project.clientId);
                    const deadline = getProjectDeadline(project.id);
                    const totalAssigned = deadline ? getTotalHours(deadline) : 0;
                    const isOverBudget = totalAssigned > project.budgetHours;

                    return (
                      <TableRow key={project.id} className={cn(isOverBudget && "bg-red-50")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: client?.color || '#6b7280' }}
                            />
                            {client?.name || 'Sin cliente'}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {project.budgetHours}h
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deadline ? (
                            <div className="text-sm text-slate-600 max-w-[200px] truncate" title={deadline.notes || ''}>
                              {deadline.notes || '-'}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        {activeEmployees.map(emp => {
                          const hours = deadline?.employeeHours[emp.id] || 0;
                          return (
                            <TableCell key={emp.id} className="text-center">
                              {deadline ? (
                                <span className={cn(
                                  "font-mono text-sm",
                                  hours > 0 ? "text-slate-900" : "text-slate-400"
                                )}>
                                  {hours > 0 ? `${hours}h` : '-'}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <Badge 
                            variant={isOverBudget ? "destructive" : totalAssigned > 0 ? "default" : "outline"}
                            className="font-mono"
                          >
                            {totalAssigned}h
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openDialog(deadline || { id: '', projectId: project.id, employeeHours: {} })}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {deadline && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  onClick={() => handleDelete(deadline.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar deadline */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeadline ? 'Editar Deadline' : 'Nuevo Deadline'}
            </DialogTitle>
            <DialogDescription>
              Asigna horas por empleado para este proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
                disabled={!!editingDeadline}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map(project => {
                    const client = clients.find(c => c.id === project.clientId);
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        {client?.name || 'Sin cliente'} - {project.name} ({project.budgetHours}h)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Anotaciones</Label>
              <Textarea
                placeholder="Ej: LB 3,5 horas (link building)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Asignación de Horas por Empleado</Label>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {activeEmployees.map(emp => {
                  const hours = formData.employeeHours[emp.id] || 0;
                  const project = projects.find(p => p.id === formData.projectId);
                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg border bg-slate-50">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{emp.first_name || emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.role}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={hours}
                          onChange={(e) => updateEmployeeHours(emp.id, parseFloat(e.target.value) || 0)}
                          className="w-24 text-center"
                          placeholder="0"
                        />
                        <span className="text-sm text-slate-500">h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {formData.projectId && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Total asignado:</span>
                  <span className={cn(
                    "font-mono font-semibold",
                    Object.values(formData.employeeHours).reduce((sum, h) => sum + h, 0) > (projects.find(p => p.id === formData.projectId)?.budgetHours || 0)
                      ? "text-red-600"
                      : "text-slate-900"
                  )}>
                    {Object.values(formData.employeeHours).reduce((sum, h) => sum + h, 0)}h
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-slate-600">Horas contratadas:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {projects.find(p => p.id === formData.projectId)?.budgetHours || 0}h
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

