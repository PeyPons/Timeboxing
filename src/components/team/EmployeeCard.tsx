import { useState, useEffect } from 'react';
import { Employee, WorkSchedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trash2, Trophy, Palmtree, Briefcase, ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import { ProfessionalGoalsSheet } from './ProfessionalGoalsSheet';
import { AbsencesSheet } from './AbsencesSheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface EmployeeCardProps {
  employee: Employee;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { updateEmployee, deleteEmployee, toggleEmployeeActive, allocations, projects } = useApp();
  
  const [schedule, setSchedule] = useState<WorkSchedule>(employee.workSchedule);
  const [showGoals, setShowGoals] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);

  // Obtener proyectos y calcular horas totales por proyecto para este empleado
  const employeeProjectStats = projects.reduce((acc, project) => {
    const projectAllocations = allocations.filter(
      a => a.employeeId === employee.id && a.projectId === project.id
    );
    
    if (projectAllocations.length > 0) {
      const totalHours = projectAllocations.reduce((sum, a) => sum + a.hoursAssigned, 0);
      acc.push({
        id: project.id,
        name: project.name,
        hours: totalHours,
        status: project.status
      });
    }
    return acc;
  }, [] as { id: string; name: string; hours: number; status: 'active' | 'completed' | 'on-hold' }[]);

  useEffect(() => {
    setSchedule(employee.workSchedule);
  }, [employee.workSchedule]);

  const handleScheduleChange = (day: keyof WorkSchedule, value: string) => {
    const numValue = Number(value);
    setSchedule(prev => ({
      ...prev,
      [day]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const saveSchedule = async () => {
    const newCapacity = Object.values(schedule).reduce((a, b) => a + b, 0);
    await updateEmployee({
      ...employee,
      workSchedule: schedule,
      defaultWeeklyCapacity: newCapacity
    });
    toast({ title: "Horario actualizado" });
  };

  const days: { key: keyof WorkSchedule; label: string }[] = [
    { key: 'monday', label: 'L' },
    { key: 'tuesday', label: 'M' },
    { key: 'wednesday', label: 'X' },
    { key: 'thursday', label: 'J' },
    { key: 'friday', label: 'V' },
  ];

  return (
    <>
      <Card className={`transition-all hover:shadow-md ${!employee.isActive ? 'opacity-60 bg-muted/50' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <Avatar>
                <AvatarImage src={employee.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {employee.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg font-bold">{employee.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{employee.role || "Sin cargo"}</p>
              </div>
            </div>
            <Switch 
              checked={employee.isActive} 
              onCheckedChange={() => toggleEmployeeActive(employee.id)} 
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Horario Semanal</Label>
            <div className="grid grid-cols-5 gap-2">
              {days.map((day) => (
                <div key={day.key} className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{day.label}</span>
                  <Input 
                    type="number" 
                    min="0" 
                    max="24"
                    className="h-8 text-center px-1"
                    value={schedule[day.key]}
                    onChange={(e) => handleScheduleChange(day.key, e.target.value)}
                    onBlur={saveSchedule}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <div className="text-xs text-muted-foreground">
              Total: <span className="font-bold text-foreground">
                {Object.values(schedule).reduce((a, b) => a + b, 0)}h
              </span> / sem
            </div>
          </div>

          {/* ✅ NUEVA SECCIÓN: BOTÓN DESPLEGABLE DE PROYECTOS */}
          <div className="pt-2 border-t">
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-9 text-xs font-normal border-dashed">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-3.5 w-3.5" />
                            {employeeProjectStats.length} Proyectos Asignados
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-2">
                        <h4 className="font-medium text-xs text-muted-foreground px-2">Resumen de Carga</h4>
                        {employeeProjectStats.length > 0 ? (
                            <div className="space-y-1">
                                {employeeProjectStats.map(proj => (
                                    <div key={proj.id} className="flex items-center justify-between text-xs p-2 hover:bg-muted rounded-md transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{proj.name}</span>
                                            <span className="text-[10px] text-muted-foreground capitalize">{proj.status}</span>
                                        </div>
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            {proj.hours}h
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-center text-muted-foreground py-4 italic">
                                Sin proyectos activos.
                            </div>
                        )}
                    </div>
                </PopoverContent>
             </Popover>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-[10px] h-8 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200" onClick={() => setShowGoals(true)}>
              <Trophy className="h-3 w-3" />
              Proyección
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-[10px] h-8 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200" onClick={() => setShowAbsences(true)}>
              <Palmtree className="h-3 w-3" />
              Ausencias
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0" onClick={() => deleteEmployee(employee.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showGoals && <ProfessionalGoalsSheet open={showGoals} onOpenChange={setShowGoals} employeeId={employee.id} />}
      {showAbsences && <AbsencesSheet open={showAbsences} onOpenChange={setShowAbsences} employeeId={employee.id} />}
    </>
  );
}
