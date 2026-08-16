import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useApp } from '@/contexts/AppContext';
import { useGoals } from '@/contexts/GoalsContext';
import { ProfessionalGoal } from '@/types';
import { Plus, Trash2, Target, Pencil, ExternalLink, CheckCircle2, Check, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/notify';
import { INPUT_LIMITS } from '@/constants/inputLimits';

interface ProfessionalGoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

type KeyResult = {
  id: string;
  text: string;
  type: 'check' | 'numeric';
  completed: boolean;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
};

const parseKeyResults = (keyResults: string | unknown | null): KeyResult[] => {
  if (!keyResults) return [];

  try {
    let parsed = keyResults;
    if (typeof keyResults === 'string') {
      parsed = JSON.parse(keyResults);
    }
    if (!Array.isArray(parsed)) return [];

    return parsed.map(kr => ({
      id: kr.id || crypto.randomUUID(),
      text: kr.text || kr.title || '', // Soporte para ambos nombres durante transición
      type: (kr.type === 'boolean' || kr.type === 'check') ? 'check' : 'numeric',
      completed: Boolean(kr.completed),
      currentValue: Number(kr.currentValue !== undefined ? kr.currentValue : kr.current) || 0,
      targetValue: Number(kr.targetValue !== undefined ? kr.targetValue : kr.target) || 10,
      unit: kr.unit || ''
    }));
  } catch (e) {
    console.warn('Error parsing keyResults:', e);
    return [];
  }
};

const calculateProgress = (krs: Partial<KeyResult>[] = []): number => {
  if (!krs || krs.length === 0) return 0;

  let totalPercentage = 0;
  krs.forEach(kr => {
    if (kr.type === 'check') {
      totalPercentage += kr.completed ? 100 : 0;
    } else {
      const current = kr.currentValue || 0;
      const target = kr.targetValue || 1;
      totalPercentage += Math.min((current / target) * 100, 100);
    }
  });

  return Math.round(totalPercentage / krs.length);
};

const goalFormSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(INPUT_LIMITS.goalTitle),
  dueDate: z.string().optional(),
  trainingUrl: z.string().url('URL inválida').max(INPUT_LIMITS.goalTrainingUrl).optional().or(z.literal('')),
  keyResults: z.array(z.object({
    id: z.string(),
    text: z.string().max(INPUT_LIMITS.goalKeyResultText),
    type: z.enum(['check', 'numeric']),
    completed: z.boolean(),
    currentValue: z.number(),
    targetValue: z.number().optional(),
    unit: z.string().optional()
  })).default([]),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

export function ProfessionalGoalsSheet({ open, onOpenChange, employeeId }: ProfessionalGoalsSheetProps) {
  const { t } = useAppTranslation();
  const dateLocale = useDateLocale();
  const { employees } = useApp();
  const { professionalGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal } = useGoals();
  const employee = employees.find(e => e.id === employeeId);
  const employeeGoals = professionalGoals.filter(g => g.employeeId === employeeId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newKrText, setNewKrText] = useState('');
  const [newKrType, setNewKrType] = useState<'check' | 'numeric'>('check');
  const [openNewKrType, setOpenNewKrType] = useState(false);
  const [newKrTarget, setNewKrTarget] = useState('10');

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: '',
      dueDate: '',
      trainingUrl: '',
      keyResults: [],
    },
  });

  const keyResults = form.watch('keyResults');
  const currentProgress = calculateProgress(keyResults);

  const resetForm = () => {
    form.reset({
      title: '',
      dueDate: '',
      trainingUrl: '',
      keyResults: [],
    });
    setEditingId(null);
    setIsAdding(false);
    setNewKrText('');
    setNewKrType('check');
    setNewKrTarget('10');
  };

  const handleEdit = (goal: ProfessionalGoal) => {
    form.reset({
      title: goal.title,
      dueDate: goal.dueDate ? goal.dueDate.toString() : '',
      trainingUrl: goal.trainingUrl || '',
      keyResults: parseKeyResults(goal.keyResults),
    });
    setEditingId(goal.id);
    setIsAdding(true);
  };

  const onSubmit = async (data: GoalFormValues) => {
    try {
      // Serializar keyResults como JSON string
      const keyResultsJson = JSON.stringify(data.keyResults);
      const calculatedProgressValue = calculateProgress(data.keyResults);

      const goalData = {
        title: data.title.trim(),
        keyResults: keyResultsJson,
        trainingUrl: data.trainingUrl?.trim() || undefined,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: data.dueDate || undefined,
        progress: calculatedProgressValue
      };

      if (editingId) {
        await updateProfessionalGoal({ ...goalData, id: editingId, employeeId } as ProfessionalGoal);
        toast.success(t('team.professionalGoals.goalUpdated'));
      } else {
        await addProfessionalGoal({ ...goalData, employeeId } as Omit<ProfessionalGoal, 'id'>);
        toast.success(t('team.professionalGoals.goalCreated'));
      }

      resetForm();
    } catch (error) {
      console.error('Error guardando objetivo:', error);
      const errorMessage = (error as Error)?.message || t('team.professionalGoals.saveError');
      toast.error(errorMessage);
    }
  };

  const addKeyResult = () => {
    if (!newKrText.trim()) return;
    const newKr: KeyResult = {
      id: crypto.randomUUID(),
      text: newKrText.trim(),
      type: newKrType,
      completed: false,
      currentValue: 0,
      targetValue: newKrType === 'numeric' ? Number(newKrTarget) : undefined
    };
    const currentKrs = form.getValues('keyResults') || [];
    form.setValue('keyResults', [...currentKrs, newKr]);
    setNewKrText('');
    setNewKrTarget('10');
  };

  const toggleKrBoolean = (id: string) => {
    const currentKrs = form.getValues('keyResults') || [];
    form.setValue('keyResults', currentKrs.map(kr => kr.id === id ? { ...kr, completed: !kr.completed } : kr));
  };

  const updateKrNumeric = (id: string, value: string) => {
    const currentKrs = form.getValues('keyResults') || [];
    form.setValue('keyResults', currentKrs.map(kr => kr.id === id ? { ...kr, currentValue: Number(value) || 0 } : kr));
  };

  const removeKeyResult = (id: string) => {
    const currentKrs = form.getValues('keyResults') || [];
    form.setValue('keyResults', currentKrs.filter(kr => kr.id !== id));
  };

  const toggleGoalKr = async (goal: ProfessionalGoal, krId: string) => {
    const krs = parseKeyResults(goal.keyResults);
    const updatedKrs = krs.map(kr => kr.id === krId ? { ...kr, completed: !kr.completed } : kr);
    const newProgress = calculateProgress(updatedKrs);

    await updateProfessionalGoal({
      ...goal,
      keyResults: JSON.stringify(updatedKrs),
      progress: newProgress
    } as ProfessionalGoal);
  };

  const updateGoalKrNumeric = async (goal: ProfessionalGoal, krId: string, value: number) => {
    const krs = parseKeyResults(goal.keyResults);
    const updatedKrs = krs.map(kr => kr.id === krId ? { ...kr, currentValue: value } : kr);
    const newProgress = calculateProgress(updatedKrs);

    await updateProfessionalGoal({
      ...goal,
      keyResults: JSON.stringify(updatedKrs),
      progress: newProgress
    } as ProfessionalGoal);
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{t('team.professionalGoals.sheetTitle', { name: employee.name })}</SheetTitle>
          <SheetDescription>{t('team.professionalGoals.sheetDescription')}</SheetDescription>
        </SheetHeader>

        {isAdding ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objetivo principal</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Mejorar skills de liderazgo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('team.professionalGoals.dueDateLabel')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trainingUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('team.professionalGoals.trainingUrlLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-primary flex items-center gap-2">
                      <Target className="h-4 w-4" /> Resultados clave
                    </Label>
                    <span className="text-xs font-mono font-bold">{currentProgress}% completado</span>
                  </div>

                  <Progress value={currentProgress} className="h-2" />

                  <div className="space-y-2">
                    {keyResults.map(kr => (
                      <div key={kr.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                        {kr.type === 'check' ? (
                          <Checkbox checked={kr.completed} onCheckedChange={() => toggleKrBoolean(kr.id)} />
                        ) : (
                          <div className="flex flex-col items-center w-16">
                            <Input type="number" className="h-7 text-xs text-center px-1" value={kr.currentValue || 0} onChange={(e) => updateKrNumeric(kr.id, e.target.value)} />
                            <span className="text-[10px] text-muted-foreground">/ {kr.targetValue}</span>
                          </div>
                        )}
                        <span className={cn("flex-1 text-sm", kr.completed && "line-through text-muted-foreground")}>{kr.text}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeKeyResult(kr.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 items-end pt-2 border-t mt-2">
                    <div className="w-24">
                      <Popover open={openNewKrType} onOpenChange={setOpenNewKrType}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-8 text-xs w-full justify-between font-normal">
                            <span>{newKrType === 'check' ? 'Check' : 'Numérico'}</span>
                            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandList>
                              <CommandGroup>
                                <CommandItem value="Check" onSelect={() => { setNewKrType('check'); setOpenNewKrType(false); }}>
                                  <Check className={cn('mr-2 h-4 w-4 shrink-0', newKrType === 'check' ? 'opacity-100' : 'opacity-0')} />
                                  Check
                                </CommandItem>
                                <CommandItem value="Numérico" onSelect={() => { setNewKrType('numeric'); setOpenNewKrType(false); }}>
                                  <Check className={cn('mr-2 h-4 w-4 shrink-0', newKrType === 'numeric' ? 'opacity-100' : 'opacity-0')} />
                                  Numérico
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1">
                      <Input placeholder={newKrType === 'check' ? "Ej: Completar curso..." : "Ej: Ventas conseguidas"} className="h-8 text-xs" value={newKrText} onChange={e => setNewKrText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyResult()} />
                    </div>
                    {newKrType === 'numeric' && (
                      <div className="w-16">
                        <Input type="number" placeholder="Meta" className="h-8 text-xs" value={newKrTarget} onChange={e => setNewKrTarget(e.target.value)} />
                      </div>
                    )}
                    <Button size="sm" variant="secondary" className="h-8" onClick={addKeyResult}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={form.formState.isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary hover:bg-primary/90">
                  {form.formState.isSubmitting ? 'Guardando...' : 'Guardar objetivo'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="py-6 space-y-4">
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo objetivo (OKR)
            </Button>

            <div className="space-y-4 mt-4">
              {employeeGoals.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No hay objetivos definidos.</p>
              )}

              {employeeGoals.map(goal => {
                const goalKrs = parseKeyResults(goal.keyResults);
                const goalProgress = goalKrs.length > 0 ? calculateProgress(goalKrs) : goal.progress;

                return (
                  <div key={goal.id} className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-bold text-base">{goal.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {goal.dueDate && (
                            <span>
                              {t('team.professionalGoals.due', 'Vence: {{date}}', {
                                date: format(new Date(goal.dueDate), 'd MMM yyyy', { locale: dateLocale }),
                              })}
                            </span>
                          )}
                          {goal.trainingUrl && (
                            <a href={goal.trainingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> {t('team.professionalGoals.training', 'Formación')}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(goal)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteProfessionalGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progreso general</span>
                        <span className={cn("font-bold", goalProgress === 100 ? "text-emerald-600" : "text-primary")}>{goalProgress}%</span>
                      </div>
                      <Progress value={goalProgress} className={cn("h-2", goalProgress === 100 && "[&>div]:bg-emerald-500")} />
                    </div>

                    {goalKrs.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">Resultados clave:</p>
                        {goalKrs.map(kr => (
                          <div key={kr.id} className={cn("flex items-center gap-3 p-2 rounded-md border transition-colors", kr.completed ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                            {kr.type === 'check' ? (
                              <Checkbox checked={kr.completed} onCheckedChange={() => toggleGoalKr(goal, kr.id)} />
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-6 w-12 text-xs text-center px-1" value={kr.currentValue || 0} onChange={(e) => updateGoalKrNumeric(goal, kr.id, Number(e.target.value))} />
                                <span className="text-[10px] text-muted-foreground">/{kr.targetValue}</span>
                              </div>
                            )}
                            <span className={cn("flex-1 text-sm", kr.completed && "line-through text-muted-foreground")}>{kr.text}</span>
                            {kr.completed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
