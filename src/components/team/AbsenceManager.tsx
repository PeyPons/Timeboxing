import { useState } from 'react';
import { Employee, Absence } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { getAbsenceTypeLabel, getAbsenceTypeColor } from '@/utils/absenceUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AbsenceManagerProps {
  employee: Employee;
}

export function AbsenceManager({ employee }: AbsenceManagerProps) {
  const { absences, addAbsence, deleteAbsence } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [newAbsence, setNewAbsence] = useState({
    startDate: '',
    endDate: '',
    type: 'vacation' as Absence['type'],
    description: '',
  });

  const employeeAbsences = absences.filter(a => a.employeeId === employee.id);

  const handleAddAbsence = () => {
    if (!newAbsence.startDate || !newAbsence.endDate) return;
    
    addAbsence({
      employeeId: employee.id,
      startDate: newAbsence.startDate,
      endDate: newAbsence.endDate,
      type: newAbsence.type,
      description: newAbsence.description,
    });
    
    setNewAbsence({
      startDate: '',
      endDate: '',
      type: 'vacation',
      description: '',
    });
    setIsOpen(false);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMM yyyy', { locale: es });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calendar className="h-4 w-4" />
          Ausencias
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva ausencia - {employee.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={newAbsence.startDate}
                    onChange={(e) => setNewAbsence(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={newAbsence.endDate}
                    onChange={(e) => setNewAbsence(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newAbsence.type}
                  onValueChange={(value: Absence['type']) => setNewAbsence(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacaciones</SelectItem>
                    <SelectItem value="sick">Enfermedad</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={newAbsence.description}
                  onChange={(e) => setNewAbsence(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ej: Vacaciones de verano"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddAbsence} disabled={!newAbsence.startDate || !newAbsence.endDate}>
                  Añadir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {employeeAbsences.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin ausencias programadas</p>
      ) : (
        <div className="space-y-2">
          {employeeAbsences.map(absence => (
            <div 
              key={absence.id} 
              className="flex items-center justify-between rounded-md bg-accent/50 px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className={`${getAbsenceTypeColor(absence.type)} text-white text-xs`}>
                  {getAbsenceTypeLabel(absence.type)}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => deleteAbsence(absence.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
