import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch'; // ✅ Importar Switch
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, CalendarIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AbsencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function AbsencesSheet({ open, onOpenChange, employeeId }: AbsencesSheetProps) {
  const { employees, absences, addAbsence, deleteAbsence } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  
  const employeeAbsences = absences.filter(a => a.employeeId === employeeId);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('vacation');
  const [description, setDescription] = useState('');
  
  // ✅ Nuevos estados para gestión parcial
  const [isFullDay, setIsFullDay] = useState(true);
  const [hours, setHours] = useState('4');

  if (!employee) return null;

  const handleAdd = () => {
    if (!startDate) return;

    addAbsence({
      employeeId,
      startDate,
      endDate: endDate || startDate,
      type: type as any,
      description,
      // Si es día completo guardamos 0 (o null), si no, las horas especificadas
      hours: isFullDay ? 0 : Number(hours)
    });

    setStartDate('');
    setEndDate('');
    setDescription('');
    setIsFullDay(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Ausencias: {employee.name}</SheetTitle>
          <SheetDescription>Registra vacaciones, bajas o permisos.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="grid gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta (Opcional)</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="vacation">Vacaciones</SelectItem>
                        <SelectItem value="sick_leave">Baja Médica</SelectItem>
                        <SelectItem value="personal">Asuntos Propios</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ✅ SECCIÓN DÍA PARCIAL */}
            <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="full-day-mode" className="cursor-pointer">¿Día completo?</Label>
                    <Switch id="full-day-mode" checked={isFullDay} onCheckedChange={setIsFullDay} />
                </div>

                {!isFullDay && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label>Horas de ausencia (por día)</Label>
                        <Input type="number" value={hours} onChange={e => setHours(e.target.value)} min={0.5} max={8} step={0.5} />
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label>Motivo (Opcional)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Cita médica..." />
            </div>

            <Button onClick={handleAdd} className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Plus className="mr-2 h-4 w-4" /> Añadir Ausencia
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Historial</h4>
            {employeeAbsences.length === 0 && <p className="text-sm text-center py-4 text-muted-foreground">No hay ausencias registradas.</p>}
            
            {employeeAbsences.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(absence => (
                <div key={absence.id} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                                absence.type === 'vacation' ? "bg-green-100 text-green-700" : 
                                absence.type === 'sick_leave' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
                            )}>
                                {absence.type === 'sick_leave' ? 'Baja' : absence.type}
                            </span>
                            {/* ✅ INDICADOR DE HORAS */}
                            {absence.hours && absence.hours > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                    -{absence.hours}h
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium mt-1">
                            {format(new Date(absence.startDate), 'd MMM', { locale: es })} 
                            {absence.endDate && absence.endDate !== absence.startDate && ` - ${format(new Date(absence.endDate), 'd MMM', { locale: es })}`}
                        </p>
                        {absence.description && <p className="text-xs text-muted-foreground">{absence.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600" onClick={() => deleteAbsence(absence.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
