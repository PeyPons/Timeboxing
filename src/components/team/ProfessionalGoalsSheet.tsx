import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useApp } from '@/contexts/AppContext';
import { ProfessionalGoal } from '@/types';
import { Plus, Trash2, Pencil, Trophy, Target, Calendar, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfessionalGoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function ProfessionalGoalsSheet({ open, onOpenChange, employeeId }: ProfessionalGoalsSheetProps) {
  const { employees, getEmployeeGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  const goals = getEmployeeGoals(employeeId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ProfessionalGoal | null>(null);

  // Form States
  const [title, setTitle] = useState('');
  const [keyResults, setKeyResults] = useState('');
  const [actions, setActions] = useState('');
  const [trainingUrl, setTrainingUrl] = useState('');
  const [dates, setDates] = useState({ start: '', due: '' });
  const [progress, setProgress] = useState([0]);

  if (!employee) return null;

  const resetForm = () => {
    setTitle('');
    setKeyResults('');
    setActions('');
    setTrainingUrl('');
    setDates({ start: '', due: '' });
    setProgress([0]);
    setEditingGoal(null);
  };

  const startAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const startEdit = (goal: ProfessionalGoal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setKeyResults(goal.keyResults || '');
    setActions(goal.actions || '');
    setTrainingUrl(goal.trainingUrl || '');
    setDates({ start: goal.startDate || '', due: goal.dueDate || '' });
    setProgress([goal.progress]);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!title) return;

    const goalData = {
      employeeId,
      title,
      keyResults,
      actions,
      trainingUrl,
      startDate: dates.start,
      dueDate: dates.due,
      progress: progress[0]
    };

    if (editingGoal) {
      updateProfessionalGoal({ ...goalData, id: editingGoal.id });
    } else {
      addProfessionalGoal(goalData);
    }
    setIsFormOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl">
          <SheetHeader className="pb-6 border-b mb-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold text-xl border border-yellow-200">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <SheetTitle className="text-2xl">Proyección Profesional</SheetTitle>
                <SheetDescription className="text-base">
                  Plan de carrera de <span className="font-medium text-foreground">{employee.name}</span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            <Button onClick={startAdd} className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Definir Nuevo Objetivo
            </Button>

            {goals.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                <Target className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-muted-foreground">No hay objetivos definidos aún.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {goals.map((goal) => (
                  <div key={goal.id} className="group relative bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                    {/* Header: Título y Progreso */}
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">
                        {goal.title}
                      </h3>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4 bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm border">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(goal)}>
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => deleteProfessionalGoal(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Barra de Progreso */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                        <span>Progreso</span>
                        <span className={cn(
                          goal.progress === 100 ? "text-green-600" : "text-blue-600"
                        )}>{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2.5 bg-slate-100" indicatorClassName={cn(
                        goal.progress === 100 ? "bg-green-500" : "bg-blue-600"
                      )} />
                    </div>

                    {/* Detalles (Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {goal.keyResults && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Resultados Clave</span>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{goal.keyResults}</p>
                        </div>
                      )}
                      
                      {goal.actions && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Acciones</span>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{goal.actions}</p>
                        </div>
                      )}
                    </div>

                    {/* Footer: Fechas y Link */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-slate-500">
                      {(goal.startDate || goal.dueDate) && (
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {goal.startDate ? new Date(goal.startDate).toLocaleDateString() : 'Inicio'} 
                            {' → '} 
                            {goal.dueDate ? new Date(goal.dueDate).toLocaleDateString() : 'Fin'}
                          </span>
                        </div>
                      )}
                      
                      {goal.trainingUrl && (
                        <a 
                          href={goal.trainingUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:underline ml-auto"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          Ver Formación <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* DIÁLOGO FORMULARIO */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Objetivo' : 'Nuevo Objetivo'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Objetivo Principal</Label>
              <Input 
                placeholder="Ej: Aprender Google Tag Manager" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input type="date" value={dates.start} onChange={e => setDates(prev => ({...prev, start: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha Límite</Label>
                <Input type="date" value={dates.due} onChange={e => setDates(prev => ({...prev, due: e.target.value}))} />
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
              <div className="flex justify-between">
                <Label>Porcentaje de Consecución</Label>
                <span className="font-bold text-blue-600">{progress[0]}%</span>
              </div>
              <Slider 
                value={progress} 
                onValueChange={setProgress} 
                max={100} 
                step={5} 
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label>Resultados Clave (KR)</Label>
              <Textarea 
                placeholder="Métricas para medir el éxito..." 
                value={keyResults} 
                onChange={e => setKeyResults(e.target.value)} 
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tareas o Acciones</Label>
              <Textarea 
                placeholder="Pasos concretos a realizar..." 
                value={actions} 
                onChange={e => setActions(e.target.value)} 
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Enlace Formación / Recursos</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9"
                  placeholder="https://cursos.cro.school..." 
                  value={trainingUrl} 
                  onChange={e => setTrainingUrl(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar Objetivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
