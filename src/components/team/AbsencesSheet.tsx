import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Absence } from '@/types';
import { Plus, Trash2, Calendar, Palmtree } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAbsenceTypeLabel, getAbsenceTypeColor } from '@/utils/absenceUtils';
import { Badge } from '@/components/ui/badge';

interface AbsencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function AbsencesSheet({ open, onOpenChange, employeeId }: AbsencesSheetProps) {
  const { employees, absences, addAbsence, deleteAbsence } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  const employeeAbsences = absences.filter(a => a.employeeId === employeeId);

  const [isAdding, setIsAdding] = useState(false);
  const [newAbsence, setNewAbsence] = useState({
    startDate: '',
    endDate: '',
    type: 'vacation' as Absence['type'],
    description: '',
  });

  if (!employee) return null;

  const handleAdd = () => {
    if (!newAbsence.startDate || !newAbsence.endDate) return;
    
    addAbsence({
      employeeId,
      startDate: newAbsence.startDate,
      endDate: newAbsence.endDate,
      type: newAbsence.type,
      description: newAbsence.description,
    });
    
    setNewAbsence({ startDate: '', endDate: '', type: 'vacation', description: '' });
    setIsAdding(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: es });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl">
        <SheetHeader className="pb-6 border-b mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl border border-orange-200">
              <Palmtree className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-2xl">Gestión de Ausencias</SheetTitle>
              <SheetDescription className="text-base">
                Vacaciones y bajas de <span className="font-medium text-foreground">{employee.name}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Formulario Desplegable */}
          {isAdding ? (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input type="date" value={newAbsence.startDate} onChange={e => setNewAbsence(prev => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input type="date" value={newAbsence.endDate} onChange={e => setNewAbsence(prev => ({ ...prev, endDate: e.target.value }))} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newAbsence.type} onValueChange={(v: any) => setNewAbsence(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">🌴 Vacaciones</SelectItem>
                    <SelectItem value="sick">💊 Baja Médica</SelectItem>
                    <SelectItem value="personal">🏠 Asuntos Propios</SelectItem>
                    <SelectItem value="other">⚪ Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input placeholder="Ej: Viaje..." value={newAbsence.description} onChange={e => setNewAbsence(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleAdd} disabled={!newAbsence.startDate || !newAbsence.endDate}>Guardar</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsAdding(true)} className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Registrar Nueva Ausencia
            </Button>
          )}

          {/* Lista */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Historial ({employeeAbsences.length})</h3>
            
            {employeeAbsences.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50/50">
                <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-muted-foreground">Sin ausencias registradas.</p>
              </div>
            ) : (
              employeeAbsences.map((absence) => (
                <div key={absence.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full ${getAbsenceTypeColor(absence.type)}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatDate(absence.startDate)} — {formatDate(absence.endDate)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-normal h-5">
                          {getAbsenceTypeLabel(absence.type)}
                        </Badge>
                      </div>
                      {absence.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{absence.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteAbsence(absence.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
