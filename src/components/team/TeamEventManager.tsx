import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { TeamEvent } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar, Users, Clock, Pencil } from 'lucide-react';

export function TeamEventManager() {
  const { teamEvents, employees, addTeamEvent, updateTeamEvent, deleteTeamEvent } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null);
  
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [hoursReduction, setHoursReduction] = useState('');
  const [description, setDescription] = useState('');
  const [affectAll, setAffectAll] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const activeEmployees = employees.filter(e => e.isActive);

  const resetForm = () => {
    setName('');
    setDate('');
    setHoursReduction('');
    setDescription('');
    setAffectAll(true);
    setSelectedEmployees([]);
    setEditingEvent(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const startEdit = (event: TeamEvent) => {
    setEditingEvent(event);
    setName(event.name);
    setDate(event.date);
    setHoursReduction(event.hoursReduction.toString());
    setDescription(event.description || '');
    setAffectAll(event.affectedEmployeeIds === 'all');
    setSelectedEmployees(event.affectedEmployeeIds === 'all' ? [] : event.affectedEmployeeIds);
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!name || !date || !hoursReduction) return;

    const eventData = {
      name,
      date,
      hoursReduction: parseFloat(hoursReduction),
      affectedEmployeeIds: affectAll ? 'all' as const : selectedEmployees,
      description: description || undefined,
    };

    if (editingEvent) {
      updateTeamEvent({ ...eventData, id: editingEvent.id });
    } else {
      addTeamEvent(eventData);
    }

    handleOpenChange(false);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Eventos de equipo</h3>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Editar evento' : 'Nuevo evento de equipo'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del evento</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Formación, Cierre anticipado..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horas reducidas</Label>
                  <Input
                    type="number"
                    value={hoursReduction}
                    onChange={(e) => setHoursReduction(e.target.value)}
                    placeholder="Ej: 2"
                    min="0.5"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles adicionales..."
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="affect-all"
                    checked={affectAll}
                    onCheckedChange={(checked) => setAffectAll(checked as boolean)}
                  />
                  <Label htmlFor="affect-all" className="cursor-pointer">
                    Afecta a todo el equipo
                  </Label>
                </div>

                {!affectAll && (
                  <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
                    {activeEmployees.map(employee => (
                      <div key={employee.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`emp-${employee.id}`}
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={() => toggleEmployee(employee.id)}
                        />
                        <Label htmlFor={`emp-${employee.id}`} className="cursor-pointer text-sm">
                          {employee.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!name || !date || !hoursReduction || (!affectAll && selectedEmployees.length === 0)}
                >
                  {editingEvent ? 'Guardar cambios' : 'Crear evento'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teamEvents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay eventos programados
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Los eventos reducen la capacidad disponible del equipo
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {teamEvents.map(event => {
            const affectedCount = event.affectedEmployeeIds === 'all' 
              ? activeEmployees.length 
              : event.affectedEmployeeIds.length;

            return (
              <div 
                key={event.id}
                className="rounded-lg border bg-card p-3 flex items-center justify-between group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{event.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      -{event.hoursReduction}h
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(event.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {event.affectedEmployeeIds === 'all' ? 'Todo el equipo' : `${affectedCount} empleados`}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(event)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará "{event.name}" y se restaurará la capacidad afectada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTeamEvent(event.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
