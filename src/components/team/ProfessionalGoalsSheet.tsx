import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { ProfessionalGoal } from '@/types';
import { Plus, Trash2, Target, Pencil, ExternalLink, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfessionalGoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

type KeyResult = {
  id: string;
  title: string;
  type: 'boolean' | 'numeric';
  completed: boolean;
  current?: number;
  target?: number;
};

const parseKeyResults = (keyResults: any): KeyResult[] => {
  if (!keyResults) return [];
  
  try {
    let parsed = keyResults;
    if (typeof keyResults === 'string') {
      parsed = JSON.parse(keyResults);
    }
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map(kr => ({
      id: kr.id || crypto.randomUUID(),
      title: kr.title || '',
      type: kr.type || 'boolean',
      completed: Boolean(kr.completed),
      current: Number(kr.current) || 0,
      target: Number(kr.target) || 10
    }));
  } catch (e) {
    console.warn('Error parsing keyResults:', e);
    return [];
  }
};

const calculateProgress = (krs: KeyResult[]): number => {
  if (!krs || krs.length === 0) return 0;
  
  let totalPercentage = 0;
  krs.forEach(kr => {
    if (kr.type === 'boolean') {
      totalPercentage += kr.completed ? 100 : 0;
    } else {
      const current = kr.current || 0;
      const target = kr.target || 1;
      totalPercentage += Math.min((current / target) * 100, 100);
    }
  });

  return Math.round(totalPercentage / krs.length);
};

export function ProfessionalGoalsSheet({ open, onOpenChange, employeeId }: ProfessionalGoalsSheetProps) {
  const { employees, professionalGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  const employeeGoals = professionalGoals.filter(g => g.employeeId === employeeId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [trainingUrl, setTrainingUrl] = useState('');
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  
  const [newKrTitle, setNewKrTitle] = useState('');
  const [newKrType, setNewKrType] = useState<'boolean' | 'numeric'>('boolean');
  const [newKrTarget, setNewKrTarget] = useState('10');

  const currentProgress = calculateProgress(keyResults);

  const resetForm = () => {
    setTitle('');
    setDueDate('');
    setTrainingUrl('');
    setKeyResults([]);
    setEditingId(null);
    setIsAdding(false);
    setNewKrTitle('');
    setNewKrType('boolean');
    setNewKrTarget('10');
  };

  const handleEdit = (goal: ProfessionalGoal) => {
    setTitle(goal.title);
    setDueDate(goal.dueDate ? goal.dueDate.toString() : '');
    setTrainingUrl(goal.trainingUrl || '');
    setKeyResults(parseKeyResults(goal.keyResults));
    setEditingId(goal.id);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    setIsSaving(true);

    try {
      // CRÍTICO: Serializar keyResults como JSON string para Supabase JSONB
      const keyResultsJson = JSON.stringify(keyResults);

      const goalData = {
        title: title.trim(),
        keyResults: keyResultsJson,
        trainingUrl: trainingUrl.trim() || undefined,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: dueDate || undefined,
        progress: currentProgress
      };

      if (editingId) {
        await updateProfessionalGoal({ ...goalData, id: editingId, employeeId } as any);
        toast.success("Objetivo actualizado");
      } else {
        await addProfessionalGoal({ ...goalData, employeeId } as any);
        toast.success("Objetivo creado");
      }
      
      resetForm();
    } catch (error) {
      console.error('Error guardando objetivo:', error);
      toast.error("Error al guardar el objetivo");
    } finally {
      setIsSaving(false);
    }
  };

  const addKeyResult = () => {
    if (!newKrTitle.trim()) return;
    const newKr: KeyResult = {
      id: crypto.randomUUID(),
      title: newKrTitle.trim(),
      type: newKrType,
      completed: false,
      current: 0,
      target: newKrType === 'numeric' ? Number(newKrTarget) : undefined
    };
    setKeyResults([...keyResults, newKr]);
    setNewKrTitle('');
    setNewKrTarget('10');
  };

  const toggleKrBoolean = (id: string) => {
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, completed: !kr.completed } : kr));
  };

  const updateKrNumeric = (id: string, value: string) => {
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, current: Number(value) || 0 } : kr));
  };

  const removeKeyResult = (id: string) => {
    setKeyResults(prev => prev.filter(kr => kr.id !== id));
  };

  const toggleGoalKr = async (goal: ProfessionalGoal, krId: string) => {
    const krs = parseKeyResults(goal.keyResults);
    const updatedKrs = krs.map(kr => kr.id === krId ? { ...kr, completed: !kr.completed } : kr);
    const newProgress = calculateProgress(updatedKrs);
    
    await updateProfessionalGoal({
      ...goal,
      keyResults: JSON.stringify(updatedKrs),
      progress: newProgress
    } as any);
  };

  const updateGoalKrNumeric = async (goal: ProfessionalGoal, krId: string, value: number) => {
    const krs = parseKeyResults(goal.keyResults);
    const updatedKrs = krs.map(kr => kr.id === krId ? { ...kr, current: value } : kr);
    const newProgress = calculateProgress(updatedKrs);
    
    await updateProfessionalGoal({
      ...goal,
      keyResults: JSON.stringify(updatedKrs),
      progress: newProgress
    } as any);
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Objetivos: {employee.name}</SheetTitle>
          <SheetDescription>Gestión de OKRs y objetivos profesionales.</SheetDescription>
        </SheetHeader>

        {isAdding ? (
          <div className="space-y-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Objetivo principal</Label>
                <Input placeholder="Ej: Mejorar skills de liderazgo" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha límite</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Enlace formación (opcional)</Label>
                  <Input placeholder="https://..." value={trainingUrl} onChange={e => setTrainingUrl(e.target.value)} />
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-indigo-600 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Resultados clave
                  </Label>
                  <span className="text-xs font-mono font-bold">{currentProgress}% completado</span>
                </div>
                
                <Progress value={currentProgress} className="h-2" />

                <div className="space-y-2">
                  {keyResults.map(kr => (
                    <div key={kr.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                      {kr.type === 'boolean' ? (
                        <Checkbox checked={kr.completed} onCheckedChange={() => toggleKrBoolean(kr.id)} />
                      ) : (
                        <div className="flex flex-col items-center w-16">
                          <Input type="number" className="h-7 text-xs text-center px-1" value={kr.current || 0} onChange={(e) => updateKrNumeric(kr.id, e.target.value)} />
                          <span className="text-[10px] text-muted-foreground">/ {kr.target}</span>
                        </div>
                      )}
                      <span className={cn("flex-1 text-sm", kr.completed && "line-through text-muted-foreground")}>{kr.title}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeKeyResult(kr.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 items-end pt-2 border-t mt-2">
                  <div className="w-24">
                    <Select value={newKrType} onValueChange={(v: any) => setNewKrType(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boolean">Check</SelectItem>
                        <SelectItem value="numeric">Numérico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Input placeholder={newKrType === 'boolean' ? "Ej: Completar curso..." : "Ej: Ventas conseguidas"} className="h-8 text-xs" value={newKrTitle} onChange={e => setNewKrTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyResult()} />
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
              <Button variant="outline" onClick={resetForm} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                {isSaving ? 'Guardando...' : 'Guardar objetivo'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsAdding(true)}>
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
                          {goal.dueDate && <span>Vence: {format(new Date(goal.dueDate), 'd MMM yyyy', { locale: es })}</span>}
                          {goal.trainingUrl && (
                            <a href={goal.trainingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                              <ExternalLink className="h-3 w-3" /> Formación
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
                        <span className={cn("font-bold", goalProgress === 100 ? "text-emerald-600" : "text-indigo-600")}>{goalProgress}%</span>
                      </div>
                      <Progress value={goalProgress} className={cn("h-2", goalProgress === 100 && "[&>div]:bg-emerald-500")} />
                    </div>

                    {goalKrs.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">Resultados clave:</p>
                        {goalKrs.map(kr => (
                          <div key={kr.id} className={cn("flex items-center gap-3 p-2 rounded-md border transition-colors", kr.completed ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                            {kr.type === 'boolean' ? (
                              <Checkbox checked={kr.completed} onCheckedChange={() => toggleGoalKr(goal, kr.id)} />
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-6 w-12 text-xs text-center px-1" value={kr.current || 0} onChange={(e) => updateGoalKrNumeric(goal, kr.id, Number(e.target.value))} />
                                <span className="text-[10px] text-muted-foreground">/{kr.target}</span>
                              </div>
                            )}
                            <span className={cn("flex-1 text-sm", kr.completed && "line-through text-muted-foreground")}>{kr.title}</span>
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
