import { useState } from 'react';
import { Employee } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScheduleEditor } from './ScheduleEditor';
import { AbsenceManager } from './AbsenceManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmployeeCardProps {
  employee: Employee;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { updateEmployee, deleteEmployee, toggleEmployeeActive } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmployee, setEditedEmployee] = useState(employee);

  const initials = employee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSave = () => {
    updateEmployee(editedEmployee);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEmployee(employee);
    setIsEditing(false);
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-lg animate-fade-in",
      !employee.isActive && "opacity-60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className={cn(
              "h-12 w-12 border-2",
              employee.isActive ? "border-primary/20" : "border-muted"
            )}>
              <AvatarFallback className={cn(
                "font-semibold",
                employee.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{employee.name}</h3>
                {!employee.isActive && (
                  <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{employee.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Editar perfil de {employee.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={editedEmployee.name}
                        onChange={(e) => setEditedEmployee({ ...editedEmployee, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <Input
                        value={editedEmployee.role}
                        onChange={(e) => setEditedEmployee({ ...editedEmployee, role: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Horario semanal
                    </Label>
                    <ScheduleEditor
                      schedule={editedEmployee.workSchedule}
                      onChange={(schedule) => setEditedEmployee({ 
                        ...editedEmployee, 
                        workSchedule: schedule,
                        defaultWeeklyCapacity: Object.values(schedule).reduce((a, b) => a + b, 0)
                      })}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará a {employee.name} y todas sus asignaciones. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteEmployee(employee.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Active/Inactive Toggle */}
        <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-muted/50">
          <Label htmlFor={`active-${employee.id}`} className="text-sm cursor-pointer">
            Estado activo
          </Label>
          <Switch
            id={`active-${employee.id}`}
            checked={employee.isActive}
            onCheckedChange={() => toggleEmployeeActive(employee.id)}
          />
        </div>

        <div className="grid grid-cols-7 gap-1">
          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day, i) => {
            const hours = employee.workSchedule[day];
            const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
            return (
              <div 
                key={day}
                className={cn(
                  "flex flex-col items-center rounded-md p-1.5 text-center",
                  hours > 0 ? 'bg-primary/10' : 'bg-muted/50'
                )}
              >
                <span className="text-xs text-muted-foreground">{dayLabels[i]}</span>
                <span className={cn(
                  "text-sm font-medium",
                  hours > 0 ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {hours}h
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-accent/50 py-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Capacidad semanal:</span>
          <span className="font-bold text-primary">{employee.defaultWeeklyCapacity}h</span>
        </div>
        
        {employee.isActive && (
          <div className="mt-4 border-t pt-4">
            <AbsenceManager employee={employee} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
