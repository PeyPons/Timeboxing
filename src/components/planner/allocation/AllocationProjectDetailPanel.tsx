import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SensitiveText } from '@/components/privacy/SensitiveText';
import { cn } from '@/lib/utils';
import { AlertOctagon, AlertTriangle, Users, X } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import type { ProjectBudgetStatus } from '@/hooks/useAllocationSheet';

interface AllocationProjectDetailPanelProps {
  projectId: string;
  projectName: string;
  budgetStatus: ProjectBudgetStatus;
  viewerEmployeeId: string;
  employees: { id: string; name: string; avatarUrl?: string | null }[];
  onClose: () => void;
}

export function AllocationProjectDetailPanel({
  projectId,
  projectName,
  budgetStatus,
  viewerEmployeeId,
  employees,
  onClose,
}: AllocationProjectDetailPanelProps) {
  const { t } = useAppTranslation();
  const { totalComputed, totalPlanned, budgetMax, budgetMin, percentage, status, breakdown = [] } = budgetStatus;
  const exceededBy = totalComputed > budgetMax ? totalComputed - budgetMax : 0;
  const isExact100 = budgetMax > 0 && Math.abs(totalComputed - budgetMax) < 0.1;
  const isAtMinimum = budgetMin > 0 && totalComputed >= budgetMin && (budgetMax === 0 || totalComputed <= budgetMax);
  const statusConfig = {
    healthy: { color: 'bg-emerald-500', textColor: 'text-emerald-700', label: t('planner.allocationSheet.budgetStatus.healthy', 'Saludable') },
    warning: { color: 'bg-amber-500', textColor: 'text-amber-700', label: t('planner.allocationSheet.budgetStatus.warning', 'Cerca del límite') },
    overload: { color: 'bg-red-500', textColor: 'text-red-700', label: t('planner.allocationSheet.budgetStatus.overload', 'Excedido') },
    under: { color: 'bg-blue-500', textColor: 'text-blue-700', label: t('planner.allocationSheet.budgetStatus.under', 'Por debajo') },
  };
  const config = statusConfig[status];
  const projection = totalPlanned + totalComputed;

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-800 truncate flex-1" title={projectName}>
          <SensitiveText kind="project" id={projectId}>
            {projectName}
          </SensitiveText>
        </h3>
        <Button variant="ghost" size="sm" className="h-9 w-9 min-h-[44px] min-w-[44px] p-0 hover:bg-indigo-100 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
        {budgetMax > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">{t('planner.allocationSheet.projectDetail.clientTotal')}</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('planner.allocationSheet.projectDetail.assigned')}</span>
                <span className="font-medium">{budgetMin > 0 ? `${budgetMin}-` : ''}{budgetMax}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('planner.allocationSheet.projectDetail.planned')}</span>
                <span className="text-blue-600">{totalPlanned.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('planner.allocationSheet.projectDetail.computed')}</span>
                <span className={cn('font-bold', status === 'overload' ? 'text-red-600' : 'text-emerald-600')}>
                  {totalComputed.toFixed(1)}h
                </span>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full', isExact100 || isAtMinimum ? 'bg-emerald-500' : config.color)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className={cn('text-[10px] font-medium', isExact100 || isAtMinimum ? 'text-emerald-700' : config.textColor)}>
                  {t('planner.allocationSheet.projectDetail.usedPct', { percent: Math.round(percentage) })}
                </span>
                {exceededBy > 0 && (
                  <span className="text-[10px] font-bold text-red-600">
                    {t('planner.allocationSheet.projectDetail.excess', { hours: exceededBy.toFixed(1) })}
                  </span>
                )}
              </div>
            </div>
            {status === 'overload' && (
              <div className="bg-red-50 text-red-700 text-[11px] p-2 rounded border border-red-200 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 flex-shrink-0" />
                <span>{t('planner.allocationSheet.projectDetail.overloadWarning')}</span>
              </div>
            )}
            {status === 'warning' && (
              <div className="bg-amber-50 text-amber-700 text-[11px] p-2 rounded border border-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {projection > budgetMax ? (
                  <span>
                    {t('planner.allocationSheet.projectDetail.projectionOverLimit', {
                      projection: projection.toFixed(1),
                    })}
                  </span>
                ) : (
                  <span>
                    {t('planner.allocationSheet.projectDetail.hoursRemaining', {
                      hours: (budgetMax - totalComputed).toFixed(1),
                    })}
                  </span>
                )}
              </div>
            )}
            {projection > budgetMax && status !== 'overload' && status !== 'warning' && (
              <div className="bg-orange-50 text-orange-700 text-[11px] p-2 rounded border border-orange-200 flex items-center gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  {t('planner.allocationSheet.projectDetail.projectionOverBudget', {
                    projection: projection.toFixed(1),
                  })}
                </span>
              </div>
            )}
            {breakdown.length > 1 && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase mb-2">
                  <Users className="w-3 h-3" /> {t('planner.allocationSheet.projectDetail.team', { count: breakdown.length })}
                </div>
                <div className="space-y-1.5">
                  {breakdown.map(({ employeeId: empId, employeeName, computed, planned }) => {
                    const isMe = empId === viewerEmployeeId;
                    const emp = employees.find((e) => e.id === empId);
                    return (
                      <div
                        key={empId}
                        className={cn(
                          'text-xs px-2 py-1.5 rounded flex items-center gap-2',
                          isMe ? 'bg-primary/10 border border-indigo-100' : 'bg-slate-50',
                        )}
                      >
                        <Avatar className="h-6 w-6 border border-slate-200">
                          <AvatarImage src={emp?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-slate-100">
                            {employeeName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className={cn('font-medium truncate', isMe ? 'text-indigo-700' : 'text-slate-600')}>
                            <SensitiveText kind="employee" id={empId}>{employeeName}</SensitiveText>{' '}
                            {isMe && t('planner.allocationSheet.you', '(you)')}
                          </div>
                          <div className="flex gap-3 text-[10px] mt-0.5">
                            <span className="text-blue-600">
                              {t('planner.allocationSheet.projectDetail.planShort')} {planned.toFixed(1)}h
                            </span>
                            <span className="text-emerald-600">
                              {t('planner.allocationSheet.projectDetail.compShort')} {computed.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
