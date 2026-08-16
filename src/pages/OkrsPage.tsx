import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { normalizeDepartments, employeeBelongsToDepartment } from '@/utils/departmentUtils';
import { useGoals } from '@/contexts/GoalsContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Trophy, TrendingUp, AlertCircle, CheckCircle2, Search, Filter, Plus, User, Briefcase, ChevronRight, ChevronDown, Edit, Trash2, CheckSquare, X, Users as UsersIcon, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { startOfMonth } from 'date-fns';
import { filterEmployeesForOperationalMonthDate } from '@/utils/employeeAssignmentVisibility';

interface KeyResultItem {
    id: string;
    text: string;
    completed: boolean;
    type?: 'check' | 'numeric';
    currentValue?: number;
    targetValue?: number;
    unit?: string;
}

export default function OkrsPage() {
    const { projects, clients, updateProject, currentUser, employees, allocations } = useApp();
    const { currentAgency } = useAgency();
    const { selectedDepartmentId } = useDepartmentView();
    const { professionalGoals, addProfessionalGoal, updateProfessionalGoal, deleteProfessionalGoal } = useGoals();
    const { hasPermission } = usePermissions();
    const { formatName: formatProjectName } = useProjectAliasing();
    const { t } = useAppTranslation();

    const departments = useMemo(() => normalizeDepartments(currentAgency?.settings?.departments), [currentAgency?.settings?.departments]);
    const employeesForView = useMemo(() => {
        if (!selectedDepartmentId || !departments.length) return employees ?? [];
        const dept = departments.find(d => d.id === selectedDepartmentId || d.name === selectedDepartmentId);
        if (!dept) return employees ?? [];
        return (employees ?? []).filter(e => employeeBelongsToDepartment(e.department, dept.id, dept.name));
    }, [employees, selectedDepartmentId, departments]);

    const employeesForOkrsSelectors = useMemo(
        () =>
            filterEmployeesForOperationalMonthDate(employeesForView, startOfMonth(new Date()), {
                allocations: allocations ?? [],
                deadlines: [],
                globalAssignments: [],
            }),
        [employeesForView, allocations]
    );

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('projects');

    // Admin View State
    const [adminSelectedEmployeeId, setAdminSelectedEmployeeId] = useState<string>('');

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<any>(null); // If null, creating new
    const [goalType, setGoalType] = useState<'project' | 'personal'>('project');
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        projectId: '',
        progress: 0,
        keyResults: [] as KeyResultItem[],
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        trainingLink: ''
    });

    // New Key Result State
    const [newKrType, setNewKrType] = useState<'check' | 'numeric'>('check');
    const [newKrText, setNewKrText] = useState('');
    const [newKrTarget, setNewKrTarget] = useState(10);
    const [newKrUnit, setNewKrUnit] = useState('');
    const [openFormProject, setOpenFormProject] = useState(false);
    const [openNewKrType, setOpenNewKrType] = useState(false);

    // Initialize Admin Selection
    useEffect(() => {
        if (currentUser && !adminSelectedEmployeeId) {
            setAdminSelectedEmployeeId(currentUser.id);
        }
    }, [currentUser, adminSelectedEmployeeId]);

    const isAdminOrManager = hasPermission('can_access_agency_settings') || hasPermission('can_access_team');

    // --- COMPUTED DATA ---

    // 1. PROJECT OKRs
    const projectData = useMemo(() => {
        let data = projects.filter(p => p.status === 'active' && !p.isHidden);
        data = data.filter(p => p.okrs && p.okrs.length > 0);

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                clients.find(c => c.id === p.clientId)?.name.toLowerCase().includes(lower) ||
                p.okrs?.some(okr => okr.title.toLowerCase().includes(lower))
            );
        }
        return data;
    }, [projects, searchTerm, clients]);

    // Helper to calculate Employee Progress per Project
    const getProjectTeamStats = (projectId: string) => {
        const projectAllocations = allocations.filter(a => a.projectId === projectId);
        const stats = new Map<string, { assigned: number, completed: number, name: string }>();

        projectAllocations.forEach(a => {
            if (!stats.has(a.employeeId)) {
                const emp = employees.find(e => e.id === a.employeeId);
                stats.set(a.employeeId, { assigned: 0, completed: 0, name: emp?.name || 'Unknown' });
            }
            const record = stats.get(a.employeeId)!;
            record.assigned += a.hoursAssigned;
            if (a.status === 'completed') {
                record.completed += (a.hoursActual || a.hoursAssigned);
            }
        });

        return Array.from(stats.entries()).map(([id, stat]) => {
            const progress = stat.assigned > 0 ? (stat.completed / stat.assigned) * 100 : 0;
            return { id, name: stat.name, progress: Math.min(100, Math.round(progress)) };
        }).filter(s => s.progress > 0 || s.name !== 'Unknown');
    };

    // 2. PERSONAL OKRs
    const personalData = useMemo(() => {
        const targetEmployeeId = adminSelectedEmployeeId || currentUser?.id;
        if (!targetEmployeeId) return [];

        let goals = professionalGoals.filter(g => g.employeeId === targetEmployeeId);

        if (searchTerm) {
            goals = goals.filter(g => g.title.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return goals;
    }, [professionalGoals, adminSelectedEmployeeId, currentUser, searchTerm]);

    // --- FORM HANDLERS ---
    const openCreateDialog = (type: 'project' | 'personal') => {
        setGoalType(type);
        setEditingGoal(null);
        setFormData({
            title: '',
            description: '',
            projectId: '',
            progress: 0,
            keyResults: [],
            startDate: new Date().toISOString().split('T')[0],
            dueDate: '',
            trainingLink: ''
        });
        setNewKrText('');
        setNewKrTarget(10);
        setIsDialogOpen(true);
    };

    const openEditDialog = (goal: any, type: 'project' | 'personal', projectId?: string) => {
        setGoalType(type);
        setEditingGoal(goal);
        let krs: KeyResultItem[] = [];
        try {
            if (typeof goal.keyResults === 'string' && goal.keyResults.startsWith('[')) {
                krs = JSON.parse(goal.keyResults);
            } else if (goal.keyResults) {
                krs = [{ id: crypto.randomUUID(), text: goal.keyResults, completed: goal.progress === 100, type: 'check' }];
            }
        } catch (e) { krs = []; }

        setFormData({
            title: goal.title,
            description: goal.description || '',
            projectId: projectId || '',
            progress: goal.progress || 0,
            keyResults: krs,
            startDate: goal.startDate ? goal.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: goal.dueDate ? goal.dueDate.split('T')[0] : '',
            trainingLink: goal.trainingUrl || ''
        });
        setNewKrText('');
        setNewKrTarget(10);
        setIsDialogOpen(true);
    };

    const handleAddKeyResult = () => {
        if (!newKrText.trim()) return;

        const newKr: KeyResultItem = {
            id: crypto.randomUUID(),
            text: newKrText,
            completed: false,
            type: newKrType,
            currentValue: 0,
            targetValue: newKrType === 'numeric' ? newKrTarget : undefined,
            unit: newKrType === 'numeric' ? newKrUnit : undefined
        };

        setFormData(prev => {
            const nextKrs = [...prev.keyResults, newKr];
            return { ...prev, keyResults: nextKrs, progress: calculateProgress(nextKrs) };
        });
        setNewKrText('');
    };

    const handleUpdateKeyResult = (id: string, updates: Partial<KeyResultItem>) => {
        setFormData(prev => {
            const nextKrs = prev.keyResults.map(kr => kr.id === id ? { ...kr, ...updates } : kr);
            // Auto-update completed status for numeric
            const finalKrs = nextKrs.map(kr => {
                if (kr.type === 'numeric' && kr.targetValue && updates.currentValue !== undefined) {
                    const isCompleted = (updates.currentValue >= kr.targetValue);
                    return { ...kr, completed: isCompleted };
                }
                return kr;
            });
            return { ...prev, keyResults: finalKrs, progress: calculateProgress(finalKrs) };
        });
    };

    const handleDeleteKeyResult = (id: string) => {
        setFormData(prev => {
            const nextKrs = prev.keyResults.filter(kr => kr.id !== id);
            return { ...prev, keyResults: nextKrs, progress: calculateProgress(nextKrs) };
        });
    };

    const calculateProgress = (krs: KeyResultItem[]) => {
        if (krs.length === 0) return 0;
        const total = krs.reduce((sum, kr) => {
            if (kr.type === 'numeric' && kr.targetValue && kr.targetValue > 0) {
                // Cap at 100% per item
                const val = Math.min(1, (kr.currentValue || 0) / kr.targetValue);
                return sum + val;
            }
            return sum + (kr.completed ? 1 : 0);
        }, 0);
        return Math.round((total / krs.length) * 100);
    };


    const handleSave = async () => {
        if (!formData.title) return;
        const keyResultsString = JSON.stringify(formData.keyResults);

        if (goalType === 'project') {
            const targetProjectId = editingGoal ? formData.projectId : formData.projectId;
            const projectToUpdate = projects.find(p => p.id === targetProjectId);
            if (!projectToUpdate) return;
            let updatedOkrs = projectToUpdate.okrs || [];
            if (editingGoal) {
                updatedOkrs = updatedOkrs.map(okr => okr.id === editingGoal.id ? { ...okr, title: formData.title, progress: formData.progress, keyResults: keyResultsString } : okr);
            } else {
                updatedOkrs.push({ id: crypto.randomUUID(), title: formData.title, progress: formData.progress, keyResults: keyResultsString });
            }
            // Note: Project OKRs don't officially support 'trainingLink' in generic interface but we save it locally in component usage context if extended? 
            // Actually, we can't save 'trainingLink' to Project OKR easily without DB change. We will skip it for Project OKRs or stash it in description if available.
            // But for Personal Goals (ProfessionalGoal), it is supported.
            await updateProject({ ...projectToUpdate, okrs: updatedOkrs });
        } else {
            const goalData = {
                title: formData.title,
                keyResults: keyResultsString,
                progress: formData.progress,
                startDate: formData.startDate,
                dueDate: formData.dueDate,
                trainingUrl: formData.trainingLink,
                employeeId: editingGoal ? editingGoal.employeeId : (adminSelectedEmployeeId || currentUser?.id)
            };
            if (editingGoal) await updateProfessionalGoal({ ...editingGoal, ...goalData });
            else await addProfessionalGoal(goalData);
        }
        setIsDialogOpen(false);
    };

    const handleDeleteClick = () => {
        if (!editingGoal) return;
        setShowDeleteAlert(true);
    };

    const confirmDelete = async () => {
        if (!editingGoal) return;

        if (goalType === 'project') {
            const project = projects.find(p => p.id === formData.projectId);
            if (project && project.okrs) {
                const updatedOkrs = project.okrs.filter(o => o.id !== editingGoal.id);
                await updateProject({ ...project, okrs: updatedOkrs });
            }
        } else {
            await deleteProfessionalGoal(editingGoal.id);
        }
        setShowDeleteAlert(false);
        setIsDialogOpen(false);
    };

    const renderKeyResultsList = (goal: any) => {
        let krs: KeyResultItem[] = [];
        try {
            if (goal.keyResults?.startsWith('[')) krs = JSON.parse(goal.keyResults);
        } catch {
          // keyResults no es JSON válido
        }
        if (krs.length === 0) return null;
        return (
            <div className="mt-4 space-y-3">
                {krs.map(kr => (
                    <div key={kr.id} className="flex items-start gap-3 text-sm text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-100">
                        <div className={cn("mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", kr.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white")}>
                            {kr.completed && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1">
                            <div className={cn("leading-tight pt-0.5", kr.completed && "text-slate-400 line-through")}>
                                {kr.text || "Ítem sin texto"}
                            </div>
                            {kr.type === 'numeric' && (
                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                    {kr.currentValue} / {kr.targetValue} {kr.unit}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const getOkrStatus = (progress: number) => {
        if (progress >= 100) return { label: t('okrs.status.completed', 'Completado'), color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        if (progress >= 60) return { label: t('okrs.status.onTrack', 'En buen camino'), color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
        if (progress >= 30) return { label: t('okrs.status.inProgress', 'En progreso'), color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
        return { label: t('okrs.status.started', 'Iniciado'), color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
    };

    return (
        <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <Target className="h-8 w-8 text-primary" />
                        {t('okrs.title', 'Objetivos y resultados clave (OKRs)')}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t('okrs.description', 'Gestiona y monitoriza los objetivos estratégicos y el rendimiento del equipo.')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={() => openCreateDialog(activeTab === 'projects' ? 'project' : 'personal')} className="gap-2 shadow-sm bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4" />
                        {t('okrs.newGoal', 'Nuevo objetivo')}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-1 rounded-xl border shadow-sm sticky top-0 z-10">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                    <TabsList className="h-10 bg-slate-100/50">
                        <TabsTrigger value="projects" className="gap-2 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Briefcase className="h-4 w-4" />
                            {t('okrs.tabs.projects', 'Proyectos')}
                        </TabsTrigger>
                        <TabsTrigger value="personal" className="gap-2 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <User className="h-4 w-4" />
                            {t('okrs.tabs.personal', 'Mis objetivos')}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 w-full md:w-auto px-2 pb-2 md:pb-0">
                    {activeTab === 'personal' && isAdminOrManager && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-[200px] justify-between h-9 bg-slate-50 border-slate-200">
                                    {employees.find((e) => e.id === adminSelectedEmployeeId)?.name || t('okrs.selectEmployee', "Seleccionar empleado...")}
                                    <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                                <Command>
                                    <CommandInput placeholder={t('okrs.searchEmployee', "Buscar empleado...")} />
                                    <CommandList>
                                        <CommandGroup>
                                            {employeesForOkrsSelectors.map((employee) => (
                                                <CommandItem key={employee.id} value={employee.name} onSelect={() => setAdminSelectedEmployeeId(employee.id)}>
                                                    <Check className={cn("mr-2 h-4 w-4", adminSelectedEmployeeId === employee.id ? "opacity-100" : "opacity-0")} />
                                                    {employee.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    )}

                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder={t('okrs.search', "Buscar...")}
                            className="pl-9 h-9 w-full md:w-[250px] bg-slate-50 border-slate-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {activeTab === 'projects' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
                    {projectData.map(project => {
                        const client = clients.find(c => c.id === project.clientId);
                        const activeOkrs = project.okrs || [];
                        const totalProgress = activeOkrs.length > 0
                            ? activeOkrs.reduce((sum, okr) => sum + okr.progress, 0) / activeOkrs.length
                            : 0;
                        const teamStats = getProjectTeamStats(project.id);

                        return (
                            <Card key={project.id} className="flex flex-col h-full hover:shadow-lg transition-all duration-300 border-slate-200 overflow-hidden group">
                                <CardHeader className="pb-4 border-b bg-gradient-to-br from-slate-50 to-white">
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <Badge variant="outline" className="bg-white text-[10px] font-medium text-slate-500 shadow-sm mb-2 rounded-md">
                                                {client ? (
                                                    <SensitiveText kind="account" id={client.id}>{client.name}</SensitiveText>
                                                ) : (
                                                    t('okrs.internal', 'Interno')
                                                )}
                                            </Badge>
                                            <CardTitle className="text-xl font-bold text-slate-900 leading-tight">
                                                <SensitiveText kind="project" id={project.id}>{formatProjectName(project.name)}</SensitiveText>
                                            </CardTitle>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className={cn("text-3xl font-black tracking-tight", totalProgress >= 100 ? "text-emerald-600" : "text-slate-900")}>
                                                {Math.round(totalProgress)}%
                                            </div>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t('okrs.global', 'Global')}</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 pt-6 space-y-6 bg-white">
                                    {/* STRATEGIC OBJECTIVES */}
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="h-3 w-3" /> {t('okrs.strategicObjectives', 'Objetivos estratégicos')}
                                        </h5>
                                        {activeOkrs.map(okr => {
                                            const status = getOkrStatus(okr.progress);
                                            return (
                                                <div key={okr.id} className="space-y-2 group/okr relative pl-3 border-l-2 border-slate-100 hover:border-blue-500 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-semibold text-slate-800 leading-snug pr-8">
                                                            {okr.title}
                                                        </h4>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 absolute right-0 top-0 opacity-0 group-hover/okr:opacity-100 transition-opacity" onClick={() => openEditDialog(okr, 'project', project.id)}>
                                                            <Edit className="h-3 w-3 text-slate-400" />
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px] text-slate-400">
                                                            <span>{status.label}</span>
                                                            <span>{okr.progress}%</span>
                                                        </div>
                                                        <Progress value={okr.progress} className={cn("h-1.5", status.bg)} />
                                                    </div>
                                                    {/* Render sub-objectives for Project OKRs */}
                                                    {renderKeyResultsList(okr)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                    {personalData.map(goal => {
                        const status = getOkrStatus(goal.progress);
                        return (
                            <Card key={goal.id} className="hover:shadow-lg transition-all duration-300 border-slate-200 group relative overflow-hidden">
                                <div className={cn("absolute top-0 left-0 w-1 h-full", status.bg.replace('50', '500'))} />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 shadow-sm h-8 w-8 hover:bg-slate-50"
                                    onClick={() => openEditDialog(goal, 'personal')}
                                >
                                    <Edit className="h-4 w-4 text-slate-500" />
                                </Button>

                                <CardHeader className="pb-3 border-b bg-slate-50/30 pl-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", status.color, status.border, status.bg)}>
                                            {status.label}
                                        </Badge>
                                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {goal.dueDate ? new Date(goal.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : t('okrs.noDate', 'Sin fecha')}
                                        </span>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-900 leading-snug">
                                        {goal.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-5 space-y-5 pl-6">
                                    {goal.description && (
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100/50 italic">
                                            "{goal.description}"
                                        </p>
                                    )}

                                    <div>
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <CheckSquare className="h-3 w-3" /> {t('okrs.keyResults', 'Resultados clave')}
                                        </h5>
                                        {renderKeyResultsList(goal)}
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between items-end text-xs text-slate-500">
                                            <span>{t('okrs.generalProgress', 'Progreso General')}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold text-slate-900">{goal.progress}</span>
                                                <span className="text-xs">%</span>
                                            </div>
                                        </div>
                                        <Progress value={goal.progress} className="h-2.5" />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ... DIALOG COMPONENT (Kept simplified in this view but in real code contains the form) ... */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingGoal ? t('okrs.dialog.editTitle', 'Editar objetivo') : t('okrs.dialog.createTitle', 'Crear nuevo objetivo')}</DialogTitle>
                        <DialogDescription>
                            {goalType === 'project' ? t('okrs.dialog.projectDesc', 'Objetivo asociado a un proyecto activo.') : t('okrs.dialog.personalDesc', 'Objetivo de desarrollo profesional.')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {goalType === 'project' && !editingGoal && (
                            <div className="space-y-2">
                                <Label>{t('okrs.dialog.projectLabel', 'Proyecto')}</Label>
                                <Popover open={openFormProject} onOpenChange={setOpenFormProject}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal">
                                            <span className="truncate">
                                                {formData.projectId ? (
                                                    <SensitiveText kind="project" id={formData.projectId}>
                                                        {formatProjectName(projects.find(p => p.id === formData.projectId)?.name || '')}
                                                    </SensitiveText>
                                                ) : (
                                                    t('okrs.dialog.selectProject', 'seleccionar proyecto...')
                                                )}
                                            </span>
                                            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                            <CommandList className="max-h-[280px]">
                                                {projects.filter(p => p.status === 'active').map(p => (
                                                    <CommandItem key={p.id} value={formatProjectName(p.name)} onSelect={() => { setFormData(prev => ({ ...prev, projectId: p.id })); setOpenFormProject(false); }}>
                                                        <Check className={cn('mr-2 h-4 w-4 shrink-0', formData.projectId === p.id ? 'opacity-100' : 'opacity-0')} />
                                                        <SensitiveText kind="project" id={p.id}>{formatProjectName(p.name)}</SensitiveText>
                                                    </CommandItem>
                                                ))}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t('okrs.dialog.mainObjective', 'Objetivo principal')}</Label>
                            <Input
                                placeholder={t('okrs.dialog.objectivePlaceholder', 'Ej: mejorar skills de React...')}
                                value={formData.title}
                                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('okrs.dialog.deadline', 'Fecha límite')}</Label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        value={formData.dueDate || ''}
                                        onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                                        className="pl-9"
                                    />
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('okrs.dialog.trainingLink', 'Enlace formación (opcional)')}</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="https://..."
                                        value={formData.trainingLink}
                                        onChange={e => setFormData(p => ({ ...p, trainingLink: e.target.value }))}
                                        className="pl-9"
                                    />
                                    <ExternalLink className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {goalType === 'personal' && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2 text-primary font-medium">
                                            <Target className="h-4 w-4" />
                                            {t('okrs.keyResults', 'Resultados clave')}
                                        </div>
                                        <span className="font-bold text-slate-900">{formData.progress}% {t('okrs.dialog.completedPrefix', 'completado')}</span>
                                    </div>
                                    <Progress value={formData.progress} className="h-2" />
                                </div>

                                <div className="space-y-2">
                                    {formData.keyResults.map((kr) => (
                                        <div key={kr.id} className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50/50 border-emerald-100 group">
                                            {kr.type === 'numeric' ? (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Input
                                                        type="number"
                                                        className="w-16 h-8 bg-white text-center p-1"
                                                        value={kr.currentValue || 0}
                                                        onChange={(e) => handleUpdateKeyResult(kr.id, { currentValue: Number(e.target.value) })}
                                                    />
                                                    <span className="text-slate-500 text-sm">/ {kr.targetValue}</span>
                                                </div>
                                            ) : (
                                                <Checkbox
                                                    checked={kr.completed}
                                                    onCheckedChange={(checked) => handleUpdateKeyResult(kr.id, { completed: checked as boolean })}
                                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                />
                                            )}

                                            <div className="flex-1">
                                                <Input
                                                    value={kr.text}
                                                    onChange={(e) => handleUpdateKeyResult(kr.id, { text: e.target.value })}
                                                    className="bg-transparent border-0 h-auto p-0 focus-visible:ring-0 shadow-none font-medium text-slate-700 placeholder:text-slate-400"
                                                    placeholder={t('okrs.dialog.descPlaceholder', "descripción del resultado...")}
                                                />
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-50"
                                                onClick={() => handleDeleteKeyResult(kr.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}

                                    {/* Add New Item Row */}
                                    <div className="flex gap-2 items-center p-1 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                                        <div className="shrink-0">
                                            <Popover open={openNewKrType} onOpenChange={setOpenNewKrType}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-[100px] h-9 border-0 bg-white shadow-sm justify-between font-normal">
                                                        <span>{newKrType === 'check' ? t('okrs.dialog.check', 'Check') : t('okrs.dialog.numeric', 'Numérico')}</span>
                                                        <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                    <Command>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                <CommandItem value="Check" onSelect={() => { setNewKrType('check'); setOpenNewKrType(false); }}>
                                                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', newKrType === 'check' ? 'opacity-100' : 'opacity-0')} />
                                                                    {t('okrs.dialog.check', 'Check')}
                                                                </CommandItem>
                                                                <CommandItem value="Numérico" onSelect={() => { setNewKrType('numeric'); setOpenNewKrType(false); }}>
                                                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', newKrType === 'numeric' ? 'opacity-100' : 'opacity-0')} />
                                                                    {t('okrs.dialog.numeric', 'Numérico')}
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {newKrType === 'numeric' && (
                                            <Input
                                                type="number"
                                                placeholder="max"
                                                className="w-16 h-9 bg-white border-0 shadow-sm"
                                                value={newKrTarget}
                                                onChange={(e) => setNewKrTarget(Number(e.target.value))}
                                            />
                                        )}

                                        <Input
                                            placeholder={newKrType === 'numeric' ? t('okrs.dialog.numericPlaceholder', "Ej: Completar módulos de curso...") : t('okrs.dialog.checkPlaceholder', "Ej: Completar curso...")}
                                            value={newKrText}
                                            onChange={e => setNewKrText(e.target.value)}
                                            className="flex-1 h-9 bg-white border-0 shadow-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyResult()}
                                        />

                                        <Button size="icon" className="h-9 w-9 shrink-0 shadow-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200" onClick={handleAddKeyResult}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between">
                        {editingGoal ? (
                            <Button variant="destructive" size="sm" onClick={handleDeleteClick} className="gap-2">
                                <Trash2 className="h-4 w-4" /> {t('okrs.delete', 'Eliminar')}
                            </Button>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('okrs.cancel', 'Cancelar')}</Button>
                            <Button onClick={handleSave}>{t('okrs.save', 'Guardar')}</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('okrs.alert.title', '¿Estás completamente seguro?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('okrs.alert.description', 'Esta acción no se puede deshacer. Se eliminará el objetivo permanentemente.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('okrs.cancel', 'Cancelar')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            {t('okrs.delete', 'Eliminar')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
