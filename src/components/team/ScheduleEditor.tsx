import { WorkSchedule } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ScheduleEditorProps {
  schedule: WorkSchedule;
  onChange?: (schedule: WorkSchedule) => void;
  readOnly?: boolean; // Nueva prop
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

export function ScheduleEditor({ schedule, onChange, readOnly = false }: ScheduleEditorProps) {
  const handleDayChange = (day: keyof WorkSchedule, value: string) => {
    if (readOnly || !onChange) return;
    
    const hours = parseFloat(value) || 0;
    onChange({
      ...schedule,
      [day]: Math.max(0, Math.min(24, hours)),
    });
  };

  // Aseguramos que schedule exista para evitar el error "Cannot convert undefined to object"
  const safeSchedule = schedule || { monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:0 };
  const totalHours = Object.values(safeSchedule).reduce((sum, h) => sum + (Number(h) || 0), 0);

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
              value={safeSchedule[key]}
              onChange={(e) => handleDayChange(key, e.target.value)}
              className={cn(
                "h-9 text-center p-1",
                readOnly && "bg-slate-50 text-slate-500 cursor-default focus-visible:ring-0 border-slate-100"
              )}
              disabled={readOnly} // Bloqueo real del input
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
