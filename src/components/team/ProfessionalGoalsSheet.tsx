import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { ProfessionalGoal } from '@/types';
import { Plus, Trash2, Target, CheckSquare, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface ProfessionalGoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

// Definimos la estructura de un Resultado Clave (Key Result)
type KeyResult = {
  id: string;
  title: string;
  type: 'boolean' | 'numeric'; // Checklist o Numérico
  completed: boolean;          // Para tipo boolean
  current?: number;            // Para tipo numeric
  target?: number;             // Para tipo numeric
};

export function ProfessionalGoalsSheet({ open, onOpenChange, employeeId }: ProfessionalGoalsSheetProps) {
  const { employees, professionalGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  
  const employeeGoals = professionalGoals.filter(g => g.employeeId === employeeId);

  // Estados del formulario
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [trainingUrl, setTrainingUrl] = useState('');
  
  // Estado para los Key Results (Checklist inteligente)
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  
  // Estado temporal para añadir un nuevo KR
  const [newKrTitle, setNewKrTitle] = useState('');
  const [newKrType, setNewKrType] = useState<'boolean' | 'numeric'>('boolean');
  const [newKrTarget, setNewKrTarget] = useState('10');

  // Calcular progreso total basado en los Key Results
  const calculateTotalProgress = (krs: KeyResult[]) => {
    if (krs.length === 0) return 0;
    
    let totalPercentage = 0;
    
    krs.forEach(kr => {
      if (kr.type === 'boolean') {
        totalPercentage += kr.completed ? 100 : 0;
      } else {
        const current = kr.current || 0;
        const target = kr.target || 1;
        // Limitamos al 100% por item
        totalPercentage += Math.min((current / target) * 100, 100);
      }
    });

    return Math.round(totalPercentage / krs.length);
  };

  const currentProgress = calculateTotalProgress(keyResults);

  const resetForm = () => {
    setTitle('');
    setDueDate('');
    setTrainingUrl('');
    setKeyResults([]);
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (goal: ProfessionalGoal) => {
    setTitle(goal.title);
    setDueDate(goal.dueDate ? goal.dueDate.toString() : '');
    setTrainingUrl(goal.trainingUrl || '');
    
    // Parseamos el JSONB de key_results. Si es string antiguo, lo intentamos adaptar o resetear
    try {
        const parsedKR = typeof goal.keyResults === 'string' 
            ? JSON.parse(goal.keyResults) 
            : (goal.keyResults as any) || [];
        // Pequeña validación por si acaso viene formato antiguo
        setKeyResults(Array.isArray(parsedKR) ? parsedKR : []);
    } catch (e) {
        setKeyResults([]);
    }

    setEditingId(goal.id);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!title) return;

    const goalData = {
      title,
      // Guardamos el array de objetos directamente (Supabase lo maneja como JSONB)
      keyResults: keyResults as any, 
      trainingUrl,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate || undefined,
      progress: currentProgress // Guardamos el progreso calculado automáticamente
    };

    if (editingId) {
      await updateProfessionalGoal({ ...goalData, id: editingId, employeeId } as any);
    } else {
      await addProfessionalGoal({ ...goalData, employeeId } as any);
    }
    
    resetForm();
  };

  // --- GESTIÓN DE KEY RESULTS ---

  const addKeyResult = () => {
    if (!newKrTitle) return;
    const newKr: KeyResult = {
      id: crypto.randomUUID(),
      title: newKrTitle,
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
    setKeyResults(prev => prev.map(kr => 
      kr.id === id ? { ...kr, completed: !kr.completed } : kr
    ));
  };

  const updateKrNumeric = (id: string, value: string) => {
    setKeyResults(prev => prev.map(kr => 
      kr.id === id ? { ...kr, current: Number(value) } : kr
    ));
  };

  const removeKeyResult = (id: string) => {
    setKeyResults(prev => prev.filter(kr => kr.id !== id));
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Proyección: {employee.name}</SheetTitle>
          <SheetDescription>Gestión de OKRs y objetivos profesionales.</SheetDescription>
        </SheetHeader>

        {isAdding ? (
          <div className="space-y-6 py-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Objetivo Principal</Label>
                    <Input placeholder="Ej: Mejorar skills de liderazgo" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Fecha Límite</Label>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Enlace Formación (Opcional)</Label>
                        <Input placeholder="https://..." value={trainingUrl} onChange={e => setTrainingUrl(e.target.value)} />
                    </div>
                </div>

                {/* --- SECCIÓN KEY RESULTS (Checklist Inteligente) --- */}
                <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-indigo-600 flex items-center gap-2">
                            <Target className="h-4 w-4" /> Resultados Clave (Checklist)
                        </Label>
                        <span className="text-xs font-mono font-bold">{currentProgress}% Completado</span>
                    </div>
                    
                    {/* Barra de progreso visual */}
                    <Progress value={currentProgress} className="h-2" />

                    {/* Lista de KRs */}
                    <div className="space-y-2">
                        {keyResults.map(kr => (
                            <div key={kr.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded border">
                                {kr.type === 'boolean' ? (
                                    <Checkbox checked={kr.completed} onCheckedChange={() => toggleKrBoolean(kr.id)} />
                                ) : (
                                    <div className="flex flex-col items-center w-16">
                                        <Input 
                                            type="number" 
                                            className="h-7 text-xs text-center px-1" 
                                            value={kr.current} 
                                            onChange={(e) => updateKrNumeric(kr.id, e.target.value)}
                                        />
                                        <span className="text-[10px] text-muted-foreground">/ {kr.target}</span>
                                    </div>
                                )}
                                
                                <span className={`flex-1 text-sm ${kr.completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {kr.title}
                                </span>
                                
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeKeyResult(kr.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Añadir nuevo KR */}
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
                        
                        <div className="flex-1 space-y-1">
                            <Input 
                                placeholder={newKrType === 'boolean' ? "Ej: Completar curso..." : "Ej: Ventas conseguidas"} 
                                className="h-8 text-xs" 
                                value={newKrTitle} 
                                onChange={e => setNewKrTitle(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addKeyResult()}
                            />
                        </div>

                        {newKrType === 'numeric' && (
                            <div className="w-16">
                                <Input 
                                    type="number" 
                                    placeholder="Meta" 
                                    className="h-8 text-xs" 
                                    value={newKrTarget} 
                                    onChange={e => setNewKrTarget(e.target.value)} 
                                />
                            </div>
                        )}

                        <Button size="sm" variant="secondary" className="h-8" onClick={addKeyResult}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar Objetivo</Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsAdding(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo Objetivo (OKR)
            </Button>

            <div className="space-y-4 mt-4">
                {employeeGoals.length === 0 && <p className="text-center text-muted-foreground text-sm">No hay objetivos definidos.</p>}
                
                {employeeGoals.map(goal => (
                    <div key={goal.id} className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-base">{goal.title}</h3>
                                {goal.dueDate && <p className="text-xs text-muted-foreground">Vence: {goal.dueDate.toString()}</p>}
                            </div>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(goal)}><div className="h-3 w-3 bg-slate-400 rounded-full" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteProfessionalGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        {/* Visualización rápida de KRs en modo lectura */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs mb-1">
                                <span>Progreso</span>
                                <span className="font-bold">{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className={`h-2 ${goal.progress === 100 ? 'bg-green-100 [&>div]:bg-green-500' : ''}`} />
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
