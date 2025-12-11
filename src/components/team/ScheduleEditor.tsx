import { Employee, WorkSchedule } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ScheduleEditorProps {
  schedule: WorkSchedule;
  onChange: (schedule: WorkSchedule) => void;
}

const dayLabels: { key: keyof WorkSchedule; label: string }[] = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mié' },
  { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

export function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  const handleDayChange = (day: keyof WorkSchedule, value: string) => {
    const hours = parseFloat(value) || 0;
    onChange({
      ...schedule,
      [day]: Math.max(0, Math.min(24, hours)),
    });
  };

  const totalHours = Object.values(schedule).reduce((sum, h) => sum + h, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {dayLabels.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={schedule[key]}
              onChange={(e) => handleDayChange(key, e.target.value)}
              className="h-9 text-center"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-accent/50 px-3 py-2">
        <span className="text-sm text-muted-foreground">Total semanal</span>
        <span className="text-lg font-bold text-primary">{totalHours}h</span>
      </div>
    </div>
  );
}
