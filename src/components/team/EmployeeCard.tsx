import { useState, useEffect } from 'react';
import { Employee, WorkSchedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

interface EmployeeCardProps {
  employee: Employee;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { updateEmployee, deleteEmployee, toggleEmployeeActive } = useApp();
  const [schedule, setSchedule] = useState<WorkSchedule>(employee.workSchedule);

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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
            onClick={() => deleteEmployee(employee.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
