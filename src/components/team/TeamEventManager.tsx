import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch'; // ✅ Importar Switch
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TeamEventManager() {
  const { teamEvents, addTeamEvent, deleteTeamEvent, employees } = useApp();
  
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState<Date | undefined>(undefined);
  const [hoursReduction, setHoursReduction] = useState('0');
  const [isFullDay, setIsFullDay] = useState(false); // ✅ Estado nuevo
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const handleAddEvent = () => {
    if (!newEventName || !newEventDate) return;

    // Si es día completo, ponemos 8 horas (o podrías poner un número alto como 24 si tu lógica lo soporta)
    const reduction = isFullDay ? 8 : parseFloat(hoursReduction);

    addTeamEvent({
      name: newEventName,
      date: format(newEventDate, 'yyyy-MM-dd'),
      hoursReduction: reduction,
      affectedEmployeeIds: selectedEmployees.length > 0 ? selectedEmployees : employees.map(e => e.id),
      description: isFullDay ? 'Festivo / Día Completo' : ''
    });

    // Reset
    setNewEventName('');
    setNewEventDate(undefined);
    setHoursReduction('0');
    setIsFullDay(false);
    setSelectedEmployees([]);
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.id));
    }
  };

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Eventos y Festivos
        </CardTitle>
        <CardDescription>Añade festivos o eventos de equipo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="grid gap-4 p-4 border rounded-lg bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Nombre del evento</Label>
                    <Input placeholder="Ej: Navidad, Puente..." value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !newEventDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newEventDate ? format(newEventDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={newEventDate} onSelect={setNewEventDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-end">
                {/* ✅ SWITCH DÍA COMPLETO */}
                <div className="flex items-center space-x-2 border p-2 rounded-md bg-white w-full md:w-auto h-10">
                    <Switch id="full-day" checked={isFullDay} onCheckedChange={setIsFullDay} />
                    <Label htmlFor="full-day" className="cursor-pointer font-medium text-sm">Día completo (Festivo)</Label>
                </div>

                <div className={cn("space-y-2 flex-1 transition-opacity", isFullDay && "opacity-50 pointer-events-none")}>
                    <Label>Reducción de horas</Label>
                    <Input type="number" value={hoursReduction} onChange={(e) => setHoursReduction(e.target.value)} min={0} />
                </div>

                <Button onClick={handleAddEvent} disabled={!newEventName || !newEventDate} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" /> Añadir
                </Button>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label className="text-xs text-muted-foreground">Afecta a:</Label>
                    <Button variant="link" size="sm" onClick={toggleSelectAll} className="h-auto p-0 text-xs">
                        {selectedEmployees.length === employees.length ? "Deseleccionar todos" : "Seleccionar todos"}
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto border p-2 rounded bg-white">
                    {employees.map(emp => (
                        <div key={emp.id} className="flex items-center space-x-2 bg-slate-100 px-2 py-1 rounded text-xs">
                            <Checkbox 
                                id={`emp-${emp.id}`} 
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={() => toggleEmployeeSelection(emp.id)}
                            />
                            <label htmlFor={`emp-${emp.id}`} className="cursor-pointer select-none">{emp.name}</label>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="space-y-2">
            <h4 className="text-sm font-medium">Próximos Eventos</h4>
            {teamEvents.length === 0 && <p className="text-sm text-muted-foreground italic">No hay eventos programados.</p>}
            <div className="grid gap-2">
                {teamEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-md bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-1 h-8 rounded-full", event.hoursReduction >= 8 ? "bg-red-500" : "bg-amber-500")} />
                            <div>
                                <p className="font-medium text-sm">{event.name}</p>
                                <p className="text-xs text-muted-foreground flex gap-2">
                                    <span>{format(new Date(event.date), "PPP", { locale: es })}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-slate-700">{event.hoursReduction >= 8 ? "Día Completo" : `-${event.hoursReduction}h`}</span>
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteTeamEvent(event.id)} className="text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
