import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppAllocationActions, useAppAllocations, useAppEmployees, useAppProjects } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useDepartmentView } from '@/contexts/DepartmentViewContext';
import { normalizeDepartments } from '@/utils/departmentUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO, addDays } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Users, ChevronLeft, ChevronRight, CalendarDays, Check, ChevronDown, Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadPercentageTone } from '@/components/planner/allocation/allocationWeekMetricsUtils';
import { getStorageKey, getWeeksForMonth } from '@/utils/dateUtils';
import { useWeeklyCloseDay } from '@/hooks/useWeeklyCloseDay';
import { ActivityLogSection } from '@/components/shared/ActivityLogSection';
import { useProjectAliasing } from '@/hooks/useProjectAliasing';
import { useWeeklyForecastMonthData } from '@/hooks/useWeeklyForecastMonthData';
import { useWeeklyForecastFilters } from '@/hooks/useWeeklyForecastFilters';
import { useWeeklyForecastRedistribution } from '@/hooks/useWeeklyForecastRedistribution';

export default function WeeklyForecastPage() {
  const { t } = useTranslation('app');
  const dateLocale = useDateLocale();
  const { projects, clients } = useAppProjects();
  const { allocations, getEmployeeLoadForWeek } = useAppAllocations();
  const { employees } = useAppEmployees();
  const { addAllocation, updateAllocation } = useAppAllocationActions();
  const { currentAgency } = useAgency();
  const { selectedDepartmentId } = useDepartmentView();

  const departments = useMemo(() => normalizeDepartments(currentAgency?.settings?.departments), [currentAgency?.settings?.departments]);

  const {
    currentMonth,
    handlePrevMonth,
    handleNextMonth,
    handleToday,
    isLoadingMonth,
  } = useWeeklyForecastMonthData();

  const { employeesForView, employeesForOperationalMonth, filteredProjectsForView } = useWeeklyForecastFilters({
    selectedDepartmentId,
    departments,
    employees: employees ?? [],
    projects: projects ?? [],
    allocations: allocations ?? [],
    currentMonth,
  });

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [redistributeSelectedTasks, setRedistributeSelectedTasks] = useState<Set<string>>(new Set());
  const [redistributeToEmployee, setRedistributeToEmployee] = useState('');
  const [redistributeWeek, setRedistributeWeek] = useState('');
  const weeklyCloseDay = useWeeklyCloseDay();
  const [openRedistributeEmployee, setOpenRedistributeEmployee] = useState(false);
  const [openRedistributeWeek, setOpenRedistributeWeek] = useState(false);
  const [openRedistributeProject, setOpenRedistributeProject] = useState(false);
  const { formatName: formatProjectName } = useProjectAliasing();

  const weeks = getWeeksForMonth(currentMonth);

  const redistributeProjectOptions = useMemo(
    () =>
      (filteredProjectsForView ?? [])
        .filter(p => p.status === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [filteredProjectsForView],
  );

  const futureWeeks = useMemo(() => {
    const today = new Date();
    return weeks.filter(week => {
      try {
        const weekDate = parseISO(getStorageKey(week.weekStart, currentMonth));
        const weekEnd = addDays(weekDate, 4);
        return weekEnd >= today;
      } catch {
        return false;
      }
    });
  }, [weeks, currentMonth]);

  const { delayedTasksByEmployee, handleRedistribute } = useWeeklyForecastRedistribution({
    selectedProject,
    allocations: allocations ?? [],
    currentMonth,
    employees: employees ?? [],
    selectedDepartmentId,
    employeesForView,
    weeklyCloseDay,
    redistributeToEmployee,
    redistributeWeek,
    redistributeSelectedTasks,
    addAllocation,
    updateAllocation,
    setRedistributeSelectedTasks,
    setRedistributeToEmployee,
    setRedistributeWeek,
    setSelectedProject,
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('weeklyForecast.title', 'Previsión mensual')}</h1>
        <p className="text-slate-500 mt-1">{t('weeklyForecast.subtitle', 'Historial de cambios en tareas y redistribución de carga')}</p>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm w-fit">
        <h2 className="text-lg font-bold capitalize text-slate-900 flex items-center gap-2 ml-2">
          {isLoadingMonth && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
        </h2>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-2">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            {t('weeklyForecast.monthCurrent', 'Mes actual')}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('weeklyForecast.tabs.activity', 'Historial')}
          </TabsTrigger>
          <TabsTrigger value="redistribute" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('weeklyForecast.tabs.redistribute', 'Redistribución')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <ActivityLogSection currentMonth={currentMonth} />
        </TabsContent>

        <TabsContent value="redistribute" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('weeklyForecast.redistributeCardTitle', 'Redistribución de horas')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('weeklyForecast.redistributeCardDesc', 'Selecciona un proyecto y redistribuye horas entre compañeros')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">{t('weeklyForecast.projectLabel', 'Proyecto')}</Label>
                <Popover open={openRedistributeProject} onOpenChange={setOpenRedistributeProject}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full h-10 justify-between">
                      <span className="truncate">
                        {selectedProject
                          ? formatProjectName(projects?.find(p => p.id === selectedProject)?.name || '')
                          : t('weeklyForecast.selectProject', 'Seleccionar proyecto...')}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(400px,calc(100vw-2rem))] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('weeklyForecast.searchProjectPlaceholder', 'Buscar proyecto...')} />
                      <CommandList>
                        <CommandEmpty>{t('weeklyForecast.noProjects', 'No hay proyectos')}</CommandEmpty>
                        <CommandGroup>
                          {redistributeProjectOptions.map(proj => {
                            const client = clients?.find(c => c.id === proj.clientId);
                            const displayName = formatProjectName(proj.name || '');
                            // value: nombre para buscar + id al final para unicidad en cmdk si hay homónimos
                            const commandValue = `${displayName} ${proj.id}`;
                            return (
                              <CommandItem
                                key={proj.id}
                                value={commandValue}
                                onSelect={() => {
                                  setSelectedProject(proj.id);
                                  setOpenRedistributeProject(false);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', selectedProject === proj.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: client?.color || '#94a3b8' }} />
                                  <span className="truncate" title={client?.name ? `${client.name} · ${displayName}` : displayName}>
                                    {displayName}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedProject && (
                <div className="space-y-6 pt-4 border-t">
                  {delayedTasksByEmployee.length > 0 ? (
                    <div className="space-y-4">
                      <Label className="text-sm font-medium">{t('weeklyForecast.delayedTasks', 'Tareas retrasadas')}</Label>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto border rounded-lg p-3">
                        {delayedTasksByEmployee.map(group => (
                          <div key={group.employeeId} className="space-y-2">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={group.employeeAvatar} alt={group.employeeName} />
                                <AvatarFallback className="bg-primary/100 text-white text-[10px]">
                                  {group.employeeName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-sm text-slate-900">{group.employeeName}</span>
                              <Badge variant="outline" className="ml-auto text-xs bg-slate-50">
                                {group.tasks?.length || 0} {t('weeklyForecast.tasksCount', 'tarea(s)')}
                              </Badge>
                            </div>

                            <div className="space-y-2 pl-8">
                              {(group.tasks || []).map(task => {
                                const remainingHours = task.hoursAssigned - (task.hoursActual || 0);
                                const isSelected = redistributeSelectedTasks.has(task.id);

                                return (
                                  <div
                                    key={task.id}
                                    className={cn(
                                      'flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors',
                                      isSelected ? 'bg-primary/10 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50',
                                    )}
                                    onClick={() => {
                                      setRedistributeSelectedTasks(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(task.id)) newSet.delete(task.id);
                                        else newSet.add(task.id);
                                        return newSet;
                                      });
                                    }}
                                  >
                                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="h-4 w-4" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{task.taskName || t('weeklyForecast.unnamedTask', 'Sin nombre')}</p>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span>
                                          {t('weeklyForecast.assigned', 'Asignadas')}: {task.hoursAssigned}h
                                        </span>
                                        <span>
                                          {t('weeklyForecast.done', 'Realizadas')}: {task.hoursActual || 0}h
                                        </span>
                                        {remainingHours > 0 && (
                                          <span className="text-amber-600 font-medium">
                                            {t('weeklyForecast.remaining', 'Restantes')}: {remainingHours}h
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {remainingHours > 0 && (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        {remainingHours}h
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {redistributeSelectedTasks.size > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{t('weeklyForecast.targetColleague', 'Compañero destino')}</Label>
                          <Popover open={openRedistributeEmployee} onOpenChange={setOpenRedistributeEmployee}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between font-normal">
                                <span className="truncate">
                                  {redistributeToEmployee
                                    ? employees?.find(e => e.id === redistributeToEmployee)?.name ?? t('weeklyForecast.select', 'Seleccionar')
                                    : t('weeklyForecast.selectColleague', 'Seleccionar compañero destino')}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command>
                                <CommandList className="max-h-[280px]">
                                  {employeesForOperationalMonth.map(emp => (
                                    <CommandItem
                                      key={emp.id}
                                      value={emp.name || ''}
                                      onSelect={() => {
                                        setRedistributeToEmployee(emp.id);
                                        setOpenRedistributeEmployee(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4 shrink-0',
                                          redistributeToEmployee === emp.id ? 'opacity-100' : 'opacity-0',
                                        )}
                                      />
                                      {emp.name}
                                    </CommandItem>
                                  ))}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {redistributeToEmployee && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{t('weeklyForecast.targetWeek', 'Semana destino')}</Label>
                          <Popover open={openRedistributeWeek} onOpenChange={setOpenRedistributeWeek}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between font-normal">
                                <span className="truncate">
                                  {redistributeWeek
                                    ? (() => {
                                        const idx = futureWeeks.findIndex(w => getStorageKey(w.weekStart, currentMonth) === redistributeWeek);
                                        return idx >= 0
                                          ? t('weeklyForecast.weekPick', {
                                              n: idx + 1,
                                              date: format(futureWeeks[idx].weekStart, 'd MMM', { locale: dateLocale }),
                                              defaultValue: 'Sem {{n}} ({{date}})',
                                            })
                                          : t('weeklyForecast.selectWeek', { defaultValue: 'Seleccionar semana' });
                                      })()
                                    : t('weeklyForecast.selectWeek', { defaultValue: 'Seleccionar semana' })}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command>
                                <CommandList className="max-h-[280px]">
                                  {futureWeeks.map((week, idx) => {
                                    const storageKey = getStorageKey(week.weekStart, currentMonth);
                                    return (
                                      <CommandItem
                                        key={storageKey}
                                        value={storageKey}
                                        onSelect={() => {
                                          setRedistributeWeek(storageKey);
                                          setOpenRedistributeWeek(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4 shrink-0',
                                            redistributeWeek === storageKey ? 'opacity-100' : 'opacity-0',
                                          )}
                                        />
                                        {t('weeklyForecast.weekPick', {
                                          n: idx + 1,
                                          date: format(week.weekStart, 'd MMM', { locale: dateLocale }),
                                          defaultValue: 'Sem {{n}} ({{date}})',
                                        })}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {redistributeToEmployee &&
                        redistributeWeek &&
                        (() => {
                          const allDelayedTasks = delayedTasksByEmployee.flatMap(g => g.tasks || []);
                          const selectedTasks = allDelayedTasks.filter(ta => redistributeSelectedTasks.has(ta.id));
                          let totalTransfer = 0;
                          selectedTasks.forEach(task => {
                            const remainingHours = task.hoursAssigned - (task.hoursActual || 0);
                            if (remainingHours > 0) totalTransfer += remainingHours;
                          });

                          const weekData = futureWeeks.find(w => getStorageKey(w.weekStart, currentMonth) === redistributeWeek);

                          if (weekData) {
                            const weekLoad = getEmployeeLoadForWeek(
                              redistributeToEmployee,
                              redistributeWeek,
                              weekData.effectiveStart,
                              weekData.effectiveEnd,
                            );

                            const newTotal = weekLoad.hours + totalTransfer;
                            const exceeds = newTotal > weekLoad.capacity;
                            const { text: loadTone } = loadPercentageTone(weekLoad.status);

                            return (
                              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                                <Label className="text-sm font-medium">
                                  {t('weeklyForecast.destLoadTitle', 'Carga del compañero destino')}
                                </Label>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between p-2 bg-white rounded text-xs">
                                    <span>{format(weekData.weekStart, 'd MMM', { locale: dateLocale })}</span>
                                    <span
                                      className={cn(
                                        'font-semibold',
                                        loadTone,
                                      )}
                                    >
                                      {weekLoad.hours}h / {weekLoad.capacity}h ({weekLoad.percentage}%)
                                    </span>
                                  </div>
                                  {totalTransfer > 0 && (
                                    <div
                                      className={cn(
                                        'p-3 rounded border',
                                        exceeds ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200',
                                      )}
                                    >
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{t('weeklyForecast.totalToMove', 'Total a transferir:')}</span>
                                        <span className="font-bold">{totalTransfer.toFixed(1)}h</span>
                                      </div>
                                      <div className="mt-2 text-xs">
                                        <div className="flex items-center justify-between">
                                          <span>{t('weeklyForecast.currentLoad', 'Carga actual:')}</span>
                                          <span>
                                            {weekLoad.hours}h / {weekLoad.capacity}h
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            'flex items-center justify-between mt-1 font-medium',
                                            exceeds ? 'text-red-600' : 'text-emerald-600',
                                          )}
                                        >
                                          <span>{t('weeklyForecast.newLoad', 'Nueva carga:')}</span>
                                          <span>
                                            {newTotal.toFixed(1)}h / {weekLoad.capacity}h
                                            {exceeds &&
                                              ` (+${(newTotal - weekLoad.capacity).toFixed(1)}h ${t('weeklyForecast.excess', 'exceso')})`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      <Button
                        onClick={handleRedistribute}
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={redistributeSelectedTasks.size === 0 || !redistributeToEmployee || !redistributeWeek}
                      >
                        {t('weeklyForecast.redistributeButton', 'Redistribuir horas')}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-700">{t('weeklyForecast.noDelayedTasks', 'No hay tareas retrasadas en este proyecto.')}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
