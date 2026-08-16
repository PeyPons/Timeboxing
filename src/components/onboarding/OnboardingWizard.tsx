import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAgency } from '@/contexts/AgencyContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/notify';
import { INPUT_LIMITS } from '@/constants/inputLimits';
import {
  Users,
  UserCircle,
  FolderKanban,
  Check,
  Circle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
  Plus,
  Layers,
  UserPlus,
  Trash2,
  Loader2,
  ShieldCheck,
  Clock,
  Building2,
  Calendar,
  Sun,
  Plug,
  Settings,
  Crown,
  AlertTriangle,
  ChevronDown,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_PERMISSIONS } from '@/types/permissions';
import type { AgencyModules, AgencySettings, DepartmentDefinition, ViewMode, WorkSchedule } from '@/types';
import { PLAN_MODULES, type PlanId } from '@/config/plans';
import { AVAILABLE_INTEGRATIONS } from '@/config/integrations';
import {
  numberToPositiveDecimalInputString,
  parsePositiveDecimalInput,
  sanitizePositiveDecimalInput,
} from '@/utils/positiveDecimalInput';
import { PROJECT_TYPE_PRESET_VALUES, PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';
import { parseDeliverableContractFeeInput } from '@/utils/deliverableProjectFields';
import { PhaseDatePickerButton } from '@/components/projects/PhaseDatePickerButton';
import { parseISO } from 'date-fns';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OnboardingCallout } from '@/components/onboarding/OnboardingCallout';
import {
  buildRecommendedAgencySettings,
  quickChecklistStorageKey,
  ONBOARDING_WIZARD_ALLOWED_KEY,
} from '@/utils/onboardingDefaults';

const ONBOARDING_STEP_KEY = 'onboarding_wizard_step_v2';

/** Sugerencia mostrada como placeholder si el usuario no escribe nada en EHR (€/h). */
const DEFAULT_EHR_SUGGESTION = 75;

/** Bloques con borde y sombra para separar secciones del onboarding. */
const obPanel = 'rounded-xl border border-slate-200/90 bg-white shadow-sm';
const obModuleRow = 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm';

function HoursModeMiniVisual({ mode, selected }: { mode: 'computed' | 'actual'; selected: boolean }) {
  const { t } = useAppTranslation();
  const barActive = selected ? 'bg-indigo-500' : 'bg-indigo-400/90';
  const barMuted = selected ? 'bg-slate-500' : 'bg-slate-400';

  if (mode === 'computed') {
    return (
      <div
        className={cn(
          'rounded-lg border p-3 space-y-2.5 transition-colors',
          selected ? 'border-indigo-200/90 bg-white/90' : 'border-slate-200/90 bg-slate-50/80'
        )}
        aria-hidden
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <span>{t('onboarding.hours.vizDedicated', 'Dedicadas')}</span>
            <span className="tabular-nums normal-case text-slate-700">1,5 h</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/90">
            <div className={cn('h-full w-[58%] rounded-full transition-colors', barMuted)} />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
            <span>{t('onboarding.hours.vizComputed', 'Computadas')}</span>
            <span className="tabular-nums normal-case font-semibold">2 h</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
            <div className={cn('h-full w-[78%] rounded-full transition-colors', barActive)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors',
        selected ? 'border-indigo-200/90 bg-white/90' : 'border-slate-200/90 bg-slate-50/80'
      )}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <span>{t('onboarding.hours.vizActual', 'Tiempo registrado')}</span>
        <span className="tabular-nums normal-case font-semibold text-slate-800">2 h</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90">
        <div className={cn('h-full w-full rounded-full transition-colors', barActive)} />
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">
        {t('onboarding.hours.vizActualHint', 'Una sola cifra: lo imputado = lo trabajado')}
      </p>
    </div>
  );
}

function OnboardingHoursModeCard({
  selected,
  onSelect,
  title,
  bullets,
  icon: Icon,
  mode,
  recommended,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  bullets: string[];
  icon: LucideIcon;
  mode: 'computed' | 'actual';
  recommended?: boolean;
}) {
  const { t } = useAppTranslation();

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border text-left transition-all duration-200',
        'outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
        selected
          ? 'border-indigo-400 bg-gradient-to-b from-indigo-50/95 via-white to-white shadow-lg shadow-indigo-100/60'
          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
      )}
    >
      {selected ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400"
          aria-hidden
        />
      ) : null}

      <div className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-colors',
            selected
              ? 'border-indigo-200/80 bg-gradient-to-br from-indigo-100 to-white text-indigo-600'
              : 'border-slate-200 bg-slate-50 text-slate-600 group-hover:border-slate-300'
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        </div>
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            selected
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
          )}
          aria-hidden
        >
          {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Circle className="h-2 w-2 text-slate-200" />}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="space-y-1 pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">{title}</span>
            {recommended ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                {t('onboarding.hours.badgeCommon', 'Habitual')}
              </span>
            ) : null}
          </div>
        </div>

        <HoursModeMiniVisual mode={mode} selected={selected} />

        <ul className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          {bullets.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <Check
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  selected ? 'text-indigo-500' : 'text-slate-400'
                )}
                strokeWidth={2.5}
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

/** Tarjeta de módulo: resumen siempre visible; detalle opcional colapsado por defecto. */
function OnboardingModuleCard({
  title,
  summary,
  detail,
  checked,
  onCheckedChange,
  disabled,
  footer,
  showSwitch = true,
}: {
  title: string;
  summary: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  footer?: React.ReactNode;
  showSwitch?: boolean;
}) {
  const { t } = useAppTranslation();
  const hasDetail = Boolean(detail?.trim());
  return (
    <div className={cn(obModuleRow, 'flex flex-col gap-1.5')}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('min-w-0', showSwitch && 'pr-1')}>
          <p className="text-sm font-medium leading-snug">{title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-snug">{summary}</p>
        </div>
        {showSwitch ? (
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            className="shrink-0 mt-0.5"
          />
        ) : null}
      </div>
      {hasDetail ? (
        <Collapsible defaultOpen={false} className="group w-full">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-2">
            <span>{t('onboarding.common.moreDetails', 'Más detalles')}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-1 border-t border-slate-100/90 pt-1.5 text-xs text-slate-600 leading-relaxed">{detail}</p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {footer}
    </div>
  );
}

type WizardStep =
  | 'agencyProfile'
  | 'integrations'
  | 'departments'
  | 'roles'
  | 'employees'
  | 'client'
  | 'project';

const WIZARD_STEP_IDS: WizardStep[] = [
  'agencyProfile',
  'integrations',
  'departments',
  'roles',
  'employees',
  'client',
  'project',
];

type DeptDraft = DepartmentDefinition & {
  defaultView: ViewMode;
  isViewStrict: boolean;
};

interface PendingMember {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentName: string;
  departmentId: string;
  workSchedule: WorkSchedule;
}

const DEFAULT_WORK: WorkSchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
};

const DEPT_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
];

function moduleAllowed(planId: PlanId, key: keyof AgencyModules): boolean {
  const m = PLAN_MODULES[planId] ?? PLAN_MODULES.starter;
  return m[key as keyof typeof m] === true;
}

function parseDepartmentsFromSettings(raw: AgencySettings['departments']): DeptDraft[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((d) => {
    if (typeof d === 'string') {
      return {
        id: crypto.randomUUID(),
        name: d,
        color: DEPT_COLORS[0],
        defaultView: 'weekly',
        isViewStrict: false,
      };
    }
    return {
      id: d.id || crypto.randomUUID(),
      name: d.name,
      color: d.color || DEPT_COLORS[0],
      defaultView: 'weekly',
      isViewStrict: false,
    };
  });
}

const clientSchema = z.object({
  name: z.string().min(2, 'El nombre del cliente es obligatorio').max(INPUT_LIMITS.clientName),
  color: z.string().min(1, 'Selecciona un color'),
});

const projectSchema = z
  .object({
    name: z.string().min(2, 'El nombre del proyecto es obligatorio').max(INPUT_LIMITS.projectName),
    budgetHours: z.number().min(1, 'El budget debe ser mayor a 0'),
    minHours: z.number().min(0).optional(),
    monthlyFee: z.number().min(0).optional(),
    responsibleDepartmentId: z.string().optional(),
    projectType: z.string().max(INPUT_LIMITS.projectType).optional(),
    deliverableContractFee: z.string().optional().default(''),
    deliverableStartDate: z.string().optional().default(''),
    deliverableDueDate: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    const pt = data.projectType === '__none__' || !data.projectType ? '' : data.projectType;
    if (pt !== PROJECT_TYPE_ENTREGABLE) return;
    if (data.deliverableContractFee?.trim()) {
      const parsed = parseDeliverableContractFeeInput(data.deliverableContractFee);
      if (parsed == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Importe total del contrato no válido',
          path: ['deliverableContractFee'],
        });
      }
    }
    const s = data.deliverableStartDate?.trim();
    const e = data.deliverableDueDate?.trim();
    if (s && e) {
      try {
        const ds = parseISO(s);
        const de = parseISO(e);
        if (!Number.isNaN(ds.getTime()) && !Number.isNaN(de.getTime()) && de < ds) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La fecha fin debe ser posterior o igual al inicio',
            path: ['deliverableDueDate'],
          });
        }
      } catch {
        /* ignore */
      }
    }
  });

const CLIENT_COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#FFB533',
  '#33FFF5', '#8B33FF', '#FF3333', '#33FF8B', '#3399FF',
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGuidedMode = searchParams.get('mode') !== 'quick';
  const { t } = useAppTranslation();
  const { perHourSuffix, inCurrencyParens } = useFormatMoney();
  const currencyLabels = { perHourSuffix, currencyParens: inCurrencyParens };
  const { planId } = useSubscriptionLimits();
  const {
    currentAgency,
    updateSettings,
    completeSetup,
    isLoading: isAgencyLoading,
    refreshAgency,
    updateUserAgencyRole,
    inviteUserToAgency,
  } = useAgency();
  const { addClient, addProject, clients, currentUser, updateEmployee, refreshData } = useApp();

  const ADMIN_ROLE_NAME = 'Administrador';

  const STEPS: { id: WizardStep; title: string; description: string; icon: React.ReactNode }[] = useMemo(
    () => [
      {
        id: 'agencyProfile',
        title: t('onboarding.steps.agencyProfile.title', 'Cómo trabaja tu agencia'),
        description: t(
          'onboarding.steps.agencyProfile.desc',
          'Define tu referencia económica, cómo contáis el tiempo y qué partes de Taimbox queréis usar.'
        ),
        icon: <Settings className="h-5 w-5" />,
      },
      {
        id: 'integrations',
        title: t('onboarding.steps.integrations.title', 'IDs externos (opcional)'),
        description: t(
          'onboarding.steps.integrations.desc',
          'Opcional: asigna identificadores en perfiles y proyectos y exporta la planificación a CSV.'
        ),
        icon: <Plug className="h-5 w-5" />,
      },
      {
        id: 'departments',
        title: t('onboarding.steps.departments.title', 'Departamentos'),
        description: t(
          'onboarding.steps.departments.desc',
          'Equipos o áreas (diseño, cuentas, creatividad…). Sirven para filtrar el planificador y asignar responsables.'
        ),
        icon: <Layers className="h-5 w-5" />,
      },
      {
        id: 'roles',
        title: t('onboarding.steps.roles.title', 'Roles'),
        description: t(
          'onboarding.steps.roles.desc',
          'Etiquetas como “Account”, “Diseñador” o “Junior”. Luego podrás afinar permisos en la gestión de agencia.'
        ),
        icon: <Users className="h-5 w-5" />,
      },
      {
        id: 'employees',
        title: t('onboarding.steps.employees.title', 'Equipo'),
        description: t(
          'onboarding.steps.employees.desc',
          'Invita por email (sin contraseña aquí): recibirán un enlace para entrar. Puedes saltarte este paso.'
        ),
        icon: <UserPlus className="h-5 w-5" />,
      },
      {
        id: 'client',
        title: t('onboarding.steps.client.title', 'Primer cliente'),
        description: t(
          'onboarding.steps.client.desc',
          'La empresa o marca a la que facturáis. Los proyectos van “dentro” de un cliente.'
        ),
        icon: <UserCircle className="h-5 w-5" />,
      },
      {
        id: 'project',
        title: t('onboarding.steps.project.title', 'Primer proyecto'),
        description: t(
          'onboarding.steps.project.desc',
          'Un encargo concreto (campaña, retainer, web…). Aquí defines horas previstas y fee mensual.'
        ),
        icon: <FolderKanban className="h-5 w-5" />,
      },
    ],
    [t]
  );

  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    const saved = localStorage.getItem(ONBOARDING_STEP_KEY) as WizardStep | null;
    if (saved && WIZARD_STEP_IDS.includes(saved)) return saved;
    return 'agencyProfile';
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEP_KEY, currentStep);
  }, [currentStep]);

  const s = currentAgency?.settings;
  const [ehrInput, setEhrInput] = useState('');
  const [hoursPref, setHoursPref] = useState<'computed' | 'actual'>(() => s?.hoursTrackingPreference ?? 'computed');
  const [modGoals, setModGoals] = useState(() => s?.modules?.professionalGoals ?? false);
  const [modDeadlines, setModDeadlines] = useState(() => s?.modules?.deadlines ?? true);
  const [modTracker, setModTracker] = useState(() => s?.modules?.timeTracker ?? true);
  const [modWeekly, setModWeekly] = useState(() => {
    const stored = s?.modules?.weeklyFeedback;
    if (stored === true || stored === false) return stored;
    return moduleAllowed(planId, 'weeklyFeedback');
  });
  const [timeTrackerMaxHours, setTimeTrackerMaxHours] = useState(() => s?.timeTrackerMaxHours ?? 12);

  const [enabledIntegrations, setEnabledIntegrations] = useState<AgencySettings['enabledIntegrations']>(
    () => ({ ...(s?.enabledIntegrations ?? {}) })
  );
  const [weeklyCloseDay, setWeeklyCloseDay] = useState(() => s?.weeklyCloseDay ?? 4);

  const integrationsSnapRef = useRef<{
    enabledIntegrations: NonNullable<AgencySettings['enabledIntegrations']>;
  } | null>(null);

  useEffect(() => {
    const v = currentAgency?.settings?.ehrTarget;
    if (v == null || v <= 0) return;
    setEhrInput((prev) =>
      prev === '' ? numberToPositiveDecimalInputString(v, DEFAULT_EHR_SUGGESTION) : prev
    );
  }, [currentAgency?.id, currentAgency?.settings?.ehrTarget]);

  useEffect(() => {
    if (currentStep !== 'integrations' || !currentAgency?.id) return;
    const en = { ...(currentAgency.settings?.enabledIntegrations ?? {}) };
    integrationsSnapRef.current = { enabledIntegrations: en };
    setEnabledIntegrations(en);
  }, [currentStep, currentAgency?.id]);

  const [deptDrafts, setDeptDrafts] = useState<DeptDraft[]>(() => {
    const parsed = parseDepartmentsFromSettings(currentAgency?.settings?.departments);
    return parsed.length > 0
      ? parsed
      : [];
  });
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState(DEPT_COLORS[0]);

  const [roles, setRoles] = useState<string[]>(() => {
    const agencyRoles = currentAgency?.settings?.roles;
    if (agencyRoles && agencyRoles.length > 0) {
      if (typeof (agencyRoles as { name?: string }[])[0] === 'string') {
        const arr = agencyRoles as unknown as string[];
        return arr.includes(ADMIN_ROLE_NAME) ? arr : [ADMIN_ROLE_NAME, ...arr];
      }
      const names = (agencyRoles as { name: string }[]).map((r) => r.name);
      return names.includes(ADMIN_ROLE_NAME) ? names : [ADMIN_ROLE_NAME, ...names];
    }
    return [ADMIN_ROLE_NAME];
  });
  const [newRole, setNewRole] = useState('');

  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: '',
    departmentName: '',
    departmentId: '',
    workSchedule: { ...DEFAULT_WORK } as WorkSchedule,
  });

  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const clientForm = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', color: CLIENT_COLORS[0] },
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      budgetHours: 20,
      minHours: 0,
      monthlyFee: 0,
      responsibleDepartmentId: '__none__',
      projectType: '__none__',
      deliverableContractFee: '',
      deliverableStartDate: '',
      deliverableDueDate: '',
    },
  });

  useEffect(() => {
    const first = deptDrafts[0];
    setNewMember((prev) => ({
      ...prev,
      role: prev.role || roles[0] || '',
      departmentName: first?.name ?? prev.departmentName,
      departmentId: first?.id ?? prev.departmentId,
    }));
  }, [roles, deptDrafts]);

  const currentStepIndex = STEPS.findIndex((x) => x.id === currentStep);

  const resolveClientIdForProject = useCallback(
    () => createdClientId ?? clients[0]?.id ?? null,
    [createdClientId, clients]
  );

  const goToNextStep = () => {
    const i = currentStepIndex + 1;
    if (i < STEPS.length) setCurrentStep(STEPS[i].id);
  };

  const goToPrevStep = () => {
    const i = currentStepIndex - 1;
    if (i >= 0) setCurrentStep(STEPS[i].id);
  };

  const upsertDepartmentConfigsAndResolveIds = useCallback(
    async (drafts: DeptDraft[]): Promise<DeptDraft[]> => {
      if (!currentAgency?.id) return drafts;
      for (const d of drafts) {
        const { error } = await supabase.from('department_config').upsert(
          {
            agency_id: currentAgency.id,
            department_name: d.name,
            default_view: d.defaultView,
            is_view_strict: d.isViewStrict,
          },
          { onConflict: 'agency_id,department_name' }
        );
        if (error) console.error('[Onboarding] department_config', error);
      }
      const { data: rows } = await supabase
        .from('department_config')
        .select('id, department_name')
        .eq('agency_id', currentAgency.id);
      const byName = new Map((rows ?? []).map((r: { id: string; department_name: string }) => [r.department_name, r.id]));
      return drafts.map((d) => ({
        ...d,
        id: byName.get(d.name) ?? d.id,
      }));
    },
    [currentAgency?.id]
  );

  const persistAgencyProfileSettings = async (recommended: boolean) => {
    if (recommended) {
      const rec = buildRecommendedAgencySettings(planId);
      const modules = rec.modules ?? {};
      await updateSettings({
        ...rec,
        modules,
      });
      return;
    }
    const ehrTarget = parsePositiveDecimalInput(ehrInput, DEFAULT_EHR_SUGGESTION, 1);
    const weeklyOn = modWeekly && moduleAllowed(planId, 'weeklyFeedback');
    const modules: AgencyModules = {
      ppc: moduleAllowed(planId, 'ppc') ? (currentAgency?.settings?.modules?.ppc ?? false) : false,
      weeklyFeedback: weeklyOn,
      professionalGoals: modGoals && moduleAllowed(planId, 'professionalGoals'),
      deadlines: modDeadlines && moduleAllowed(planId, 'deadlines'),
      timeTracker: modTracker && moduleAllowed(planId, 'timeTracker'),
    };
    await updateSettings({
      ehrTarget,
      hoursTrackingPreference: hoursPref,
      modules,
      weeklyCloseDay: weeklyOn ? weeklyCloseDay : undefined,
      timeTrackerMaxHours: modTracker ? timeTrackerMaxHours : undefined,
    });
  };

  const handleAgencyProfileSubmit = async () => {
    setIsProcessing(true);
    try {
      await persistAgencyProfileSettings(false);
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAgencyProfileRecommended = async () => {
    setIsProcessing(true);
    try {
      await persistAgencyProfileSettings(true);
      toast.success(t('onboarding.profile.recommendedApplied', 'Valores por defecto aplicados.'));
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleIntegration = (id: string, checked: boolean) => {
    const def = AVAILABLE_INTEGRATIONS[id];
    if (!def) return;
    if (checked && def.dependencies?.length) {
      const missing = def.dependencies.filter((dep) => !(enabledIntegrations?.[dep as keyof typeof enabledIntegrations] ?? false));
      if (missing.length) {
        toast.warning(
          t('onboarding.integrations.needsDeps', {
            defaultValue: 'Activa antes: {{list}}',
            list: missing.join(', '),
          })
        );
        return;
      }
    }
    setEnabledIntegrations((prev) => ({ ...(prev ?? {}), [id]: checked }));
  };

  const handleIntegrationsSubmit = async () => {
    setIsProcessing(true);
    try {
      await updateSettings({
        enabledIntegrations,
      });
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIntegrationsSkip = async () => {
    setIsProcessing(true);
    try {
      const snap = integrationsSnapRef.current;
      const en = { ...(snap?.enabledIntegrations ?? {}) };
      await updateSettings({
        enabledIntegrations: en,
      });
      setEnabledIntegrations(en);
      toast.info(t('onboarding.integrations.skipToast', 'Podrás configurar esto en Conexiones cuando quieras.'));
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const addDept = () => {
    if (!newDeptName.trim()) return;
    if (deptDrafts.length >= 5) {
      toast.error(t('onboarding.departments.max', 'Máximo 5 departamentos'));
      return;
    }
    if (deptDrafts.some((d) => d.name.toLowerCase() === newDeptName.trim().toLowerCase())) {
      toast.error(t('onboarding.departments.duplicate', 'Ese nombre ya existe'));
      return;
    }
    setDeptDrafts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newDeptName.trim(),
        color: newDeptColor,
        defaultView: 'weekly',
        isViewStrict: false,
      },
    ]);
    setNewDeptName('');
  };

  const removeDept = (id: string) => setDeptDrafts((prev) => prev.filter((d) => d.id !== id));

  const updateDept = (id: string, patch: Partial<DeptDraft>) => {
    setDeptDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleDepartmentsSubmit = async () => {
    if (deptDrafts.length === 0) {
      toast.error(t('onboarding.departments.needOne', 'Añade al menos un departamento'));
      return;
    }
    setIsProcessing(true);
    try {
      const synced = await upsertDepartmentConfigsAndResolveIds(deptDrafts);
      setDeptDrafts(synced);
      const defs: DepartmentDefinition[] = synced.map(({ id, name, color }) => ({ id, name, color }));
      await updateSettings({ departments: defs });
      const firstName = synced[0].name;
      const firstId = synced[0].id;
      if (currentUser && currentAgency?.id) {
        try {
          await updateEmployee({
            ...currentUser,
            department: firstName,
            departmentId: firstId,
          });
          if (currentUser.user_id) {
            await updateUserAgencyRole(currentUser.user_id, currentAgency.id, currentUser.role || ADMIN_ROLE_NAME, firstName);
          }
          await refreshAgency();
        } catch (err) {
          console.warn(err);
        }
      }
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRolesSubmit = async () => {
    if (roles.length === 0) {
      toast.error(t('onboarding.roles.needOne', 'Define al menos un rol'));
      return;
    }
    setIsProcessing(true);
    try {
      const rolesToSave = roles.map((r) => ({
        name: r,
        permissions:
          r === ADMIN_ROLE_NAME
            ? DEFAULT_PERMISSIONS
            : { ...DEFAULT_PERMISSIONS, can_access_team: false, can_access_agency_settings: false },
      }));
      await updateSettings({ roles: rolesToSave });
      if (currentUser && currentAgency?.id) {
        try {
          const dept = currentUser.department || deptDrafts[0]?.name || 'General';
          await updateEmployee({
            ...currentUser,
            role: ADMIN_ROLE_NAME,
            department: dept,
          });
          if (currentUser.user_id) {
            await updateUserAgencyRole(currentUser.user_id, currentAgency.id, ADMIN_ROLE_NAME, dept);
          }
          await refreshAgency();
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          console.warn(err);
        }
      }
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const addRole = () => {
    if (roles.length >= 10) {
      toast.error(t('onboarding.roles.max', 'Máximo 10 roles'));
      return;
    }
    const r = newRole.trim();
    if (!r || roles.includes(r)) return;
    if (r === ADMIN_ROLE_NAME) {
      toast.error(t('onboarding.roles.reserved', 'Nombre reservado'));
      return;
    }
    setRoles([...roles, r]);
    setNewRole('');
  };

  const removeRole = (r: string) => {
    if (r === ADMIN_ROLE_NAME) return;
    setRoles(roles.filter((x) => x !== r));
  };

  const weeklyCapacity = (ws: WorkSchedule) =>
    ws.monday + ws.tuesday + ws.wednesday + ws.thursday + ws.friday + ws.saturday + ws.sunday;

  const addPendingMember = () => {
    if (!newMember.name.trim() || !newMember.email.trim()) {
      toast.error(t('onboarding.team.nameEmail', 'Nombre y email obligatorios'));
      return;
    }
    const cleanEmail = newMember.email.trim().toLowerCase();
    if (pendingMembers.some((m) => m.email === cleanEmail)) {
      toast.error(t('onboarding.team.duplicateEmail', 'Ese email ya está en la lista'));
      return;
    }
    if (cleanEmail === currentUser?.email?.toLowerCase()) {
      toast.error(t('onboarding.team.selfEmail', 'No puedes invitarte a ti mismo aquí'));
      return;
    }
    setPendingMembers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newMember.name.trim(),
        email: cleanEmail,
        role: newMember.role || roles[0] || ADMIN_ROLE_NAME,
        departmentName: newMember.departmentName || deptDrafts[0]?.name || '',
        departmentId: newMember.departmentId || deptDrafts[0]?.id || '',
        workSchedule: { ...newMember.workSchedule },
      },
    ]);
    setNewMember({
      name: '',
      email: '',
      role: roles[0] || '',
      departmentName: deptDrafts[0]?.name || '',
      departmentId: deptDrafts[0]?.id || '',
      workSchedule: { ...DEFAULT_WORK },
    });
  };

  const handleEmployeesSubmit = async () => {
    setIsProcessing(true);
    try {
      for (const m of pendingMembers) {
        try {
          const res = await inviteUserToAgency(m.email, m.role, m.departmentName);
          const empId = res?.employeeId;
          if (!empId) continue;
          let deptUuid: string | null = m.departmentId || null;
          if (currentAgency?.id && m.departmentName) {
            const { data: dcRow } = await supabase
              .from('department_config')
              .select('id')
              .eq('agency_id', currentAgency.id)
              .eq('department_name', m.departmentName)
              .maybeSingle();
            if (dcRow?.id) deptUuid = dcRow.id;
          }
          const cap = weeklyCapacity(m.workSchedule);
          await supabase
            .from('employees')
            .update({
              name: m.name,
              work_schedule: m.workSchedule,
              department: m.departmentName,
              department_id: deptUuid,
              default_weekly_capacity: Math.min(Math.max(cap, 1), 60),
            })
            .eq('id', empId);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(msg);
        }
      }
      if (pendingMembers.length > 0) {
        await refreshData(true);
        toast.success(t('onboarding.team.invited', 'Invitaciones enviadas'));
      }
      goToNextStep();
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.errors.team', 'Error al procesar el equipo'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClientSubmit = async (data: z.infer<typeof clientSchema>) => {
    setIsProcessing(true);
    try {
      const created = await addClient({
        name: data.name,
        color: data.color,
        agencyId: currentAgency?.id || '',
      });
      if (created) setCreatedClientId(created.id);
      goToNextStep();
    } catch {
      toast.error(t('onboarding.errors.client', 'Error al crear el cliente'));
    } finally {
      setIsProcessing(false);
    }
  };

  const finishOnboarding = async (showQuickChecklist = false) => {
    await completeSetup();
    if (showQuickChecklist && currentAgency?.id && typeof window !== 'undefined') {
      localStorage.setItem(quickChecklistStorageKey(currentAgency.id), '1');
    }
    toast.success(t('onboarding.done', '¡Configuración completada!'));
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    localStorage.removeItem('onboarding_step');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ONBOARDING_WIZARD_ALLOWED_KEY);
    }
    navigate('/planner', { replace: true });
  };

  const handleClientSkip = async () => {
    setIsProcessing(true);
    try {
      if (!resolveClientIdForProject()) {
        toast.info(
          t(
            'onboarding.client.skipFinishes',
            'Sin cliente no hace falta crear un proyecto. Podrás añadir ambos después en Clientes y proyectos.'
          )
        );
        await finishOnboarding(true);
        return;
      }
      goToNextStep();
    } catch {
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProjectSkip = async () => {
    setIsProcessing(true);
    try {
      await finishOnboarding(true);
    } catch {
      toast.error(t('onboarding.errors.save', 'Error al guardar'));
    } finally {
      setIsProcessing(false);
    }
  };

  const autoFinishProjectWithoutClient = useRef(false);

  // Reanudación guardada en paso «proyecto» sin ningún cliente
  useEffect(() => {
    if (currentStep !== 'project' || isAgencyLoading) return;
    if (resolveClientIdForProject()) return;
    if (autoFinishProjectWithoutClient.current) return;
    autoFinishProjectWithoutClient.current = true;
    void finishOnboarding(true);
  }, [currentStep, isAgencyLoading, resolveClientIdForProject]);

  const handleProjectSubmit = async (data: z.infer<typeof projectSchema>) => {
    setIsProcessing(true);
    try {
      const clientId = resolveClientIdForProject();
      if (!clientId) {
        toast.error(t('onboarding.errors.noClient', 'No hay cliente'));
        return;
      }
      const pt =
        data.projectType && data.projectType !== '__none__' ? data.projectType : undefined;
      const isEnt = pt === PROJECT_TYPE_ENTREGABLE;
      const deliverableContractFee = isEnt ? parseDeliverableContractFeeInput(data.deliverableContractFee) : null;
      const deliverableStartDate =
        isEnt && data.deliverableStartDate?.trim() ? data.deliverableStartDate.trim() : null;
      const deliverableDueDate =
        isEnt && data.deliverableDueDate?.trim() ? data.deliverableDueDate.trim() : null;

      await addProject({
        name: data.name,
        clientId,
        budgetHours: data.budgetHours,
        minimumHours: data.minHours,
        monthlyFee: data.monthlyFee ?? 0,
        status: 'active',
        agencyId: currentAgency?.id || '',
        responsibleDepartmentId:
          data.responsibleDepartmentId && data.responsibleDepartmentId !== '__none__'
            ? data.responsibleDepartmentId
            : undefined,
        projectType: pt,
        deliverableContractFee,
        deliverableStartDate: deliverableStartDate ?? undefined,
        deliverableDueDate: deliverableDueDate ?? undefined,
      });
      await finishOnboarding();
    } catch {
      toast.error(t('onboarding.errors.project', 'Error al crear el proyecto'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAgencyLoading && !currentAgency) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400">{t('onboarding.loading', 'Cargando configuración...')}</p>
        </div>
      </div>
    );
  }

  const dayKeys: (keyof WorkSchedule)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ];
  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const onboardingContentMax =
    currentStep === 'agencyProfile'
      ? 'max-w-5xl'
      : currentStep === 'client' || currentStep === 'project'
        ? 'max-w-3xl'
        : 'max-w-2xl';

  const ehrCalloutBullets = t('onboarding.ehr.calloutBullets', { returnObjects: true }) as unknown;
  const integrationsCalloutBullets = t('onboarding.integrations.calloutBullets', { returnObjects: true }) as unknown;
  const departmentsCalloutBullets = t('onboarding.departments.calloutBullets', { returnObjects: true }) as unknown;
  const rolesCalloutBullets = t('onboarding.roles.calloutBullets', { returnObjects: true }) as unknown;
  const teamCalloutBullets = t('onboarding.team.calloutBullets', { returnObjects: true }) as unknown;
  const clientCalloutBullets = t('onboarding.client.calloutBullets', { returnObjects: true }) as unknown;
  const projectCalloutBullets = t('onboarding.project.calloutBullets', { returnObjects: true }) as unknown;
  const hoursComputedBullets = t('onboarding.hours.computedBullets', { returnObjects: true }) as unknown;
  const hoursActualBullets = t('onboarding.hours.actualBullets', { returnObjects: true }) as unknown;

  return (
    <div className="h-svh min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <div className="shrink-0 flex justify-center px-3 sm:px-6 pt-3 pb-2">
        <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center max-w-full overflow-x-auto pb-1 [scrollbar-width:thin]">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all',
                    idx < currentStepIndex
                      ? 'bg-emerald-500 text-white'
                      : idx === currentStepIndex
                        ? 'bg-primary text-white ring-4 ring-primary/30'
                        : 'bg-slate-700 text-slate-400'
                  )}
                >
                  {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn('w-4 h-0.5 mx-0.5 rounded', idx < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-700')} />
                )}
              </div>
            ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-6 pb-3">
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden w-full max-w-5xl mx-auto bg-white/95 backdrop-blur shadow-2xl border border-slate-200/80">
          <CardHeader className="shrink-0 border-b border-slate-100/90 bg-slate-50/40 px-3 py-2 text-center sm:px-6 sm:py-2.5">
            <div className="mb-0.5 flex justify-center sm:mb-1">
              <div className="rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 p-2 sm:p-2.5">
                {STEPS[currentStepIndex]?.icon}
              </div>
            </div>
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
              <CardTitle className="text-base leading-snug sm:text-lg md:text-xl">
                {STEPS[currentStepIndex]?.title}
              </CardTitle>
              <span
                className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-indigo-700/90 sm:text-xs"
                aria-label={t('onboarding.wizard.stepProgressAria', {
                  current: currentStepIndex + 1,
                  total: STEPS.length,
                })}
              >
                {t('onboarding.wizard.stepProgress', {
                  current: currentStepIndex + 1,
                  total: STEPS.length,
                })}
              </span>
            </div>
            <CardDescription className="mx-auto mt-0.5 max-w-2xl text-[11px] leading-snug text-slate-600 sm:text-xs line-clamp-2 sm:line-clamp-3">
              {STEPS[currentStepIndex]?.description}
            </CardDescription>
            {currentStep === 'agencyProfile' && isGuidedMode ? (
              <p className="mx-auto mt-1 max-w-xl text-[11px] leading-snug text-slate-500 sm:text-xs">
                {t(
                  'onboarding.wizard.guidedDuration',
                  'Unos 8–12 min. Si cerráis, guardamos el paso y podéis seguir después.'
                )}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden p-0">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(99,102,241,0.35)_transparent]">
              <div className={cn('space-y-6 w-full mx-auto', onboardingContentMax)}>
            {currentStep === 'agencyProfile' && (
              <div className="flex flex-col gap-5 min-h-0">
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-700 leading-snug">
                    {t(
                      'onboarding.profile.recommendedLead',
                      '¿Quieres ir más rápido? Dejamos unos valores por defecto sensatos; podrás cambiarlos cuando quieras en Configuración de agencia.'
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={isProcessing}
                    onClick={handleAgencyProfileRecommended}
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('onboarding.profile.useRecommended', 'Usar valores por defecto')}
                  </Button>
                </div>
                <div className="space-y-5 min-w-0">
                  <div className="space-y-3 min-w-0">
                    <div className={cn(obPanel, 'p-3 sm:p-4 space-y-2')}>
                      <Label className="text-sm">{t('onboarding.ehr.label', currencyLabels)}</Label>
                      <OnboardingCallout
                        title={t('onboarding.ehr.calloutTitle', 'Qué es este valor')}
                        bullets={Array.isArray(ehrCalloutBullets) ? (ehrCalloutBullets as string[]) : []}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={ehrInput}
                        onChange={(e) => setEhrInput(sanitizePositiveDecimalInput(e.target.value))}
                        onBlur={() => {
                          const v = parsePositiveDecimalInput(
                            ehrInput,
                            DEFAULT_EHR_SUGGESTION,
                            1
                          );
                          setEhrInput(numberToPositiveDecimalInputString(v, DEFAULT_EHR_SUGGESTION));
                        }}
                        placeholder={String(DEFAULT_EHR_SUGGESTION)}
                        className="max-w-xs"
                      />
                      <p className="text-xs text-slate-500">{t('onboarding.ehr.placeholderHint', 'Revisa o ajusta el valor; si lo dejas vacío usaremos la sugerencia.')}</p>
                    </div>

                    <div className={cn(obPanel, 'p-3 sm:p-4 space-y-3')}>
                      <Label id="onboarding-hours-mode-label" className="text-sm sm:text-base">
                        {t('onboarding.hours.label', '¿Cómo tratáis las horas en Taimbox?')}
                      </Label>
                      <p className="text-xs text-slate-500 leading-snug -mt-1">
                        {t(
                          'onboarding.hours.labelHint',
                          'Elige cómo se registran las horas en planificación e informes. Puedes cambiarlo después.'
                        )}
                      </p>
                      <div
                        role="radiogroup"
                        aria-labelledby="onboarding-hours-mode-label"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                      >
                        <OnboardingHoursModeCard
                          mode="computed"
                          recommended
                          selected={hoursPref === 'computed'}
                          onSelect={() => setHoursPref('computed')}
                          title={t('onboarding.hours.computed', 'Horas computadas frente a reales')}
                          bullets={
                            Array.isArray(hoursComputedBullets)
                              ? (hoursComputedBullets as string[])
                              : []
                          }
                          icon={Layers}
                        />
                        <OnboardingHoursModeCard
                          mode="actual"
                          selected={hoursPref === 'actual'}
                          onSelect={() => setHoursPref('actual')}
                          title={t('onboarding.hours.actual', 'Solo horas reales')}
                          bullets={
                            Array.isArray(hoursActualBullets) ? (hoursActualBullets as string[]) : []
                          }
                          icon={Clock}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 min-w-0 border-t border-slate-100 pt-5">
                    <OnboardingCallout title={t('onboarding.modules.title', 'Funciones del producto')}>
                      <p>{t('onboarding.modules.sectionIntroShort')}</p>
                    </OnboardingCallout>

                    <div className="space-y-3">
                      <OnboardingModuleCard
                        title={t('agency.modules.weeklyFeedback', 'Weekly')}
                        summary={t(
                          'onboarding.modules.weeklySummary',
                          'Cierre semanal: bloquea retoques manuales en semanas ya cerradas en el planificador.'
                        )}
                        detail={t(
                          'onboarding.modules.weeklyHelp',
                          'Con Weekly activo, las semanas pasadas no se reescriben a mano en el calendario: los cambios pasan por el flujo Weekly (completar horas, posponer, transferir…). Si preferís libertad total, déjalo apagado.'
                        )}
                        checked={modWeekly && moduleAllowed(planId, 'weeklyFeedback')}
                        disabled={!moduleAllowed(planId, 'weeklyFeedback')}
                        onCheckedChange={(c) => moduleAllowed(planId, 'weeklyFeedback') && setModWeekly(c)}
                        footer={
                          modWeekly && moduleAllowed(planId, 'weeklyFeedback') ? (
                            <div className="mt-1 space-y-2 border-t border-slate-200/80 pt-2">
                              <Label className="text-xs font-normal text-slate-700">
                                {t('agency.integrations.weeklyCloseDay', 'Día de cierre semanal')}
                              </Label>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                {t('onboarding.integrations.weeklyCloseHelpShort')}
                              </p>
                              <Select value={String(weeklyCloseDay)} onValueChange={(v) => setWeeklyCloseDay(Number(v))}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[
                                    { v: 1, l: 'Lunes' },
                                    { v: 2, l: 'Martes' },
                                    { v: 3, l: 'Miércoles' },
                                    { v: 4, l: 'Jueves' },
                                    { v: 5, l: 'Viernes' },
                                    { v: 6, l: 'Sábado' },
                                    { v: 0, l: 'Domingo' },
                                  ].map((d) => (
                                    <SelectItem key={d.v} value={String(d.v)}>
                                      {d.l}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : undefined
                        }
                      />
                      <OnboardingModuleCard
                        title={t('onboarding.modules.deadlinesTitle', 'Deadlines (entregas con fecha)')}
                        summary={t(
                          'onboarding.modules.deadlinesSummary',
                          'Tareas con fecha límite y seguimiento por cliente o proyecto (en paralelo al planificador).'
                        )}
                        detail={t(
                          'onboarding.modules.deadlinesHelp',
                          'Listas de tareas con fecha límite: ver qué vence, reordenar y hacer seguimiento del trabajo por cliente o proyecto. No sustituye al planificador de horas, va en paralelo.'
                        )}
                        checked={modDeadlines && moduleAllowed(planId, 'deadlines')}
                        disabled={!moduleAllowed(planId, 'deadlines')}
                        onCheckedChange={(c) => moduleAllowed(planId, 'deadlines') && setModDeadlines(c)}
                      />
                      <OnboardingModuleCard
                        title={t('agency.modules.timeTracker', 'Cronómetro')}
                        summary={t(
                          'onboarding.modules.trackerSummary',
                          'Cronómetro por tarea para registrar tiempo real frente a lo planificado.'
                        )}
                        detail={t(
                          'onboarding.modules.trackerHelp',
                          'Cada persona puede iniciar y parar un contador por tarea para registrar tiempo real. Útil si facturáis o analizáis horas reales frente a lo planificado.'
                        )}
                        checked={modTracker && moduleAllowed(planId, 'timeTracker')}
                        disabled={!moduleAllowed(planId, 'timeTracker')}
                        onCheckedChange={(c) => moduleAllowed(planId, 'timeTracker') && setModTracker(c)}
                        footer={
                          modTracker && moduleAllowed(planId, 'timeTracker') ? (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200/80 pt-2">
                              <Label
                                htmlFor="onboarding-tracker-max"
                                className="text-xs font-normal text-slate-700"
                              >
                                {t('onboarding.tracker.maxShort', 'Máx. por sesión')}
                              </Label>
                              <div className="flex min-w-[8rem] flex-1 items-center justify-end gap-1.5 sm:flex-initial sm:justify-start">
                                <select
                                  id="onboarding-tracker-max"
                                  value={timeTrackerMaxHours}
                                  onChange={(e) => setTimeTrackerMaxHours(Number(e.target.value))}
                                  className="h-8 min-w-[4.5rem] rounded-md border border-input bg-background px-2 text-xs"
                                  aria-label={t('onboarding.tracker.max', 'Límite por tarea (cronómetro)')}
                                  aria-describedby="onboarding-tracker-max-sr"
                                >
                                  {[4, 6, 8, 10, 12, 16, 24].map((h) => (
                                    <option key={h} value={h}>
                                      {h}h
                                    </option>
                                  ))}
                                </select>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                      aria-label={t('onboarding.tracker.maxInfoLabel', 'Qué hace este límite')}
                                    >
                                      <Info className="h-4 w-4" aria-hidden />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                                    {t(
                                      'onboarding.tracker.maxHint',
                                      'Las sesiones de más de este tiempo se detienen solas para que no queden cronómetros olvidados encendidos.'
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <p id="onboarding-tracker-max-sr" className="sr-only">
                                {t(
                                  'onboarding.tracker.maxHint',
                                  'Las sesiones de más de este tiempo se detienen solas para que no queden cronómetros olvidados encendidos.'
                                )}
                              </p>
                            </div>
                          ) : undefined
                        }
                      />
                      <OnboardingModuleCard
                        title={t('onboarding.modules.okrsTitle', 'OKRs (objetivos del equipo)')}
                        summary={t(
                          'onboarding.modules.okrsSummary',
                          'Objetivos medibles por persona o equipo (marco OKR en el menú).'
                        )}
                        detail={t(
                          'onboarding.modules.okrsHelp',
                          'Objetivos y resultados medibles por persona o equipo (metas trimestrales, hitos, etc.). Es la sección “OKRs” del menú; si no trabajáis con ese marco, puedes dejarla apagada.'
                        )}
                        checked={modGoals && moduleAllowed(planId, 'professionalGoals')}
                        disabled={!moduleAllowed(planId, 'professionalGoals')}
                        onCheckedChange={(c) => moduleAllowed(planId, 'professionalGoals') && setModGoals(c)}
                      />
                    </div>

                    <div
                      className={cn(
                        'rounded-xl border-2 p-3 space-y-2 shadow-sm',
                        moduleAllowed(planId, 'ppc')
                          ? 'border-indigo-200/90 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/80'
                          : 'border-slate-200 bg-slate-50/90 opacity-90'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                          <Crown className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{t('agency.modules.ppc', 'PPC (Ads)')}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 border-indigo-200 bg-white/80 text-indigo-800 text-[11px] font-normal">
                          {t('onboarding.modules.ppcLater', 'Se activa después en agencia')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-700 leading-snug line-clamp-2">
                        {t(
                          'onboarding.modules.ppcLead',
                          'Informes y enlaces oficiales con Google Ads y Meta son una parte avanzada del producto, con coste e implicación técnica.'
                        )}
                      </p>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="ppc" className="border-0">
                          <AccordionTrigger className="py-1 text-xs font-medium text-indigo-700 hover:no-underline [&[data-state=open]]:pb-1">
                            {t('onboarding.modules.ppcDetailsTrigger', 'Detalles sobre PPC e integraciones')}
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 text-xs text-slate-600 leading-relaxed pb-2">
                            <p>
                              {t(
                                'onboarding.modules.ppcBody',
                                'Por eso no forma parte del alta inicial: cuando tu agencia lo necesite, lo habilitas con calma en Configuración de agencia → Conexiones, con la vinculación OAuth que exigen las plataformas.'
                              )}
                            </p>
                            <p className="text-indigo-900/85 font-medium">
                              {t(
                                'onboarding.modules.ppcReassurance',
                                'No tienes que decidir nada ahora: el planificador, clientes y el resto de módulos funcionan perfectamente sin PPC.'
                              )}
                            </p>
                            {!moduleAllowed(planId, 'ppc') && (
                              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                                {t('onboarding.modules.ppcPlanNote', 'Tu plan actual no incluye este módulo.')}
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end shrink-0 pt-2 border-t border-slate-100">
                  <Button onClick={handleAgencyProfileSubmit} disabled={isProcessing} className="gap-2">
                    {t('common.continue', 'Continuar')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'integrations' && (
              <div className="space-y-4">
                <OnboardingCallout
                  title={t('onboarding.integrations.calloutTitle', 'IDs externos (opcional)')}
                  bullets={
                    Array.isArray(integrationsCalloutBullets)
                      ? (integrationsCalloutBullets as string[])
                      : []
                  }
                />

                <div className={cn(obModuleRow, 'space-y-3 p-3 sm:p-4')}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {t('agency.integrations.externalLinksTitle', 'IDs externos y exportación')}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t('onboarding.integrations.crmGroup', 'IDs externos')}
                  </p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-sm">
                        {t('agency.integrations.crmPackTitle', 'IDs externos y exportación CSV')}
                      </p>
                      <p className="text-xs text-slate-600 leading-snug">{t('onboarding.integrations.crmPackShort')}</p>
                      {Boolean(enabledIntegrations?.crm_user_id) && !enabledIntegrations?.crm_export ? (
                        <p className="flex items-start gap-1 pt-0.5 text-[11px] text-amber-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            {t(
                              'agency.integrations.crmPackLegacyHint',
                              'Solo tenías activado el ID de usuario en perfiles. Activa el interruptor para completar la integración (exportación e ID de proyecto en fichas).'
                            )}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <Switch
                      checked={
                        Boolean(enabledIntegrations?.crm_user_id) &&
                        Boolean(enabledIntegrations?.crm_export)
                      }
                      onCheckedChange={(c) =>
                        setEnabledIntegrations((prev) => ({
                          ...(prev ?? {}),
                          crm_user_id: c,
                          crm_export: c,
                        }))
                      }
                      className="shrink-0"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={handleIntegrationsSkip}
                    disabled={isProcessing}
                  >
                    {t('onboarding.integrations.skip', 'Omitir y continuar sin cambios')}
                  </Button>
                  <div className="flex justify-between gap-2">
                    <Button type="button" variant="ghost" onClick={goToPrevStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                    </Button>
                    <Button onClick={handleIntegrationsSubmit} disabled={isProcessing} className="gap-2">
                      {t('common.continue', 'Continuar')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'departments' && (
              <div className="space-y-4">
                <OnboardingCallout
                  title={t('onboarding.departments.calloutTitle', 'Departamentos')}
                  bullets={
                    Array.isArray(departmentsCalloutBullets)
                      ? (departmentsCalloutBullets as string[])
                      : []
                  }
                />

                <div className={cn(obPanel, 'space-y-2 p-3 sm:p-4')}>
                  <p className="text-sm font-medium text-slate-800">
                    {t('onboarding.departments.addTitle', 'Añadir departamento')}
                  </p>
                  <p className="text-xs text-slate-600 leading-snug">
                    {t('onboarding.departments.addHintShort')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder={t('onboarding.departments.placeholder', 'Nombre del departamento')}
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="min-w-[12rem] max-w-full flex-1 sm:max-w-[220px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addDept();
                        }
                      }}
                    />
                    <input
                      type="color"
                      value={newDeptColor}
                      onChange={(e) => setNewDeptColor(e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded border"
                      title={t('common.color', 'Color')}
                    />
                    <Button type="button" variant="default" size="sm" onClick={addDept} className="gap-1">
                      <Plus className="h-4 w-4" />
                      {t('onboarding.departments.addButton', 'Añadir departamento')}
                    </Button>
                  </div>
                </div>

                {deptDrafts.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {t('onboarding.departments.mustCreate', 'Añade al menos un departamento para continuar.')}
                  </p>
                ) : null}

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t('onboarding.departments.listTitle', 'Tus departamentos')}
                  </p>
                  <div className="max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {deptDrafts.map((d) => (
                      <div key={d.id} className="space-y-3 rounded-lg border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                            <Input
                              value={d.name}
                              onChange={(e) => updateDept(d.id, { name: e.target.value })}
                              className="h-8 font-medium"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDept(d.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">
                            {t('onboarding.dept.viewExplainTitle', 'Vista por defecto en planificador')}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateDept(d.id, { defaultView: 'weekly' })}
                              className={cn(
                                'flex flex-col gap-1 rounded-lg border p-2 text-left text-xs',
                                d.defaultView === 'weekly' ? 'border-primary bg-primary/5' : 'border-slate-200'
                              )}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <Calendar className="h-4 w-4 shrink-0" />
                                {t('onboarding.dept.viewWeekly', 'Mi semana')}
                              </span>
                              <span className="pl-6 text-[11px] leading-snug text-slate-600">
                                {t(
                                  'onboarding.dept.viewWeeklyHelp',
                                  'Ves la carga por semanas en el calendario (planificación conjunta).'
                                )}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDept(d.id, { defaultView: 'daily' })}
                              className={cn(
                                'flex flex-col gap-1 rounded-lg border p-2 text-left text-xs',
                                d.defaultView === 'daily' ? 'border-primary bg-primary/5' : 'border-slate-200'
                              )}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <Sun className="h-4 w-4 shrink-0" />
                                {t('onboarding.dept.viewDaily', 'Mi día')}
                              </span>
                              <span className="pl-6 text-[11px] leading-snug text-slate-600">
                                {t(
                                  'onboarding.dept.viewDailyHelp',
                                  'Enfocado en un día: tareas y bloques del día actual.'
                                )}
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded border bg-slate-50/80 p-2">
                          <Label className="max-w-[85%] cursor-pointer text-xs leading-snug">
                            {t('onboarding.dept.strict', 'Vista estricta')}
                            <span className="mt-0.5 block font-normal text-slate-500">
                              {t(
                                'onboarding.dept.strictHelp',
                                'Si está activa, este departamento no puede cambiar libremente de vista en el planificador.'
                              )}
                            </span>
                          </Label>
                          <Switch
                            checked={d.isViewStrict}
                            onCheckedChange={(c) => updateDept(d.id, { isViewStrict: c })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <Button type="button" variant="ghost" onClick={goToPrevStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                  </Button>
                  <Button onClick={handleDepartmentsSubmit} disabled={isProcessing || deptDrafts.length === 0} className="gap-2">
                    {t('common.continue', 'Continuar')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'roles' && (
              <div className="space-y-4">
                <OnboardingCallout
                  title={t('onboarding.roles.calloutTitle', 'Roles')}
                  bullets={
                    Array.isArray(rolesCalloutBullets) ? (rolesCalloutBullets as string[]) : []
                  }
                />
                <div className={cn(obPanel, 'space-y-3 p-3 sm:p-4')}>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <Badge key={role} variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs sm:text-sm">
                        {role}
                        {role !== ADMIN_ROLE_NAME && (
                          <button type="button" onClick={() => removeRole(role)} className="hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {role === ADMIN_ROLE_NAME && <ShieldCheck className="h-3 w-3 text-slate-500" />}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder={t('onboarding.roles.newPlaceholder', 'Nombre del nuevo rol…')}
                      className="text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addRole} className="shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <Button type="button" variant="ghost" onClick={goToPrevStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                  </Button>
                  <Button onClick={handleRolesSubmit} disabled={isProcessing || roles.length === 0} className="gap-2">
                    {t('common.continue', 'Continuar')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'employees' && (
              <div className="space-y-4">
                <OnboardingCallout
                  title={t('onboarding.team.calloutTitle', 'Invitaciones')}
                  bullets={Array.isArray(teamCalloutBullets) ? (teamCalloutBullets as string[]) : []}
                />

                <div
                  className={cn(
                    'gap-6',
                    pendingMembers.length > 0 ? 'grid lg:grid-cols-2 lg:items-start' : 'flex flex-col'
                  )}
                >
                  {pendingMembers.length > 0 ? (
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t('onboarding.team.listLabel', 'Personas en la lista (invitación al pulsar Continuar)')}
                      </p>
                      <div className="max-h-[min(40vh,20rem)] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {pendingMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 text-sm shadow-sm"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="truncate font-medium text-slate-900">{m.name}</p>
                              <p className="truncate text-[11px] text-slate-600">
                                {m.email} · {m.role} · {m.departmentName}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingMembers((p) => p.filter((x) => x.id !== m.id))}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="min-w-0">
                <div className="space-y-3 rounded-xl border-2 border-indigo-200/70 bg-gradient-to-b from-indigo-50/35 to-white p-3 sm:p-4 shadow-md">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t('onboarding.team.formTitle', 'Datos de la nueva persona')}</p>
                    <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-700">
                      {t(
                        'onboarding.team.noPasswordShort',
                        'Solo email: cada persona crea su contraseña desde el enlace del correo.'
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">{t('onboarding.team.fullName', 'Nombre completo')}</Label>
                      <Input
                        placeholder={t('onboarding.team.namePh', 'Ej. Ana López')}
                        value={newMember.name}
                        onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">{t('onboarding.team.emailLabel', 'Email de trabajo')}</Label>
                      <Input
                        type="email"
                        placeholder={t('onboarding.team.emailPh', 'correo@empresa.com')}
                        value={newMember.email}
                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                        className="bg-white"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">{t('common.role', 'Rol')}</Label>
                      <Select value={newMember.role} onValueChange={(v) => setNewMember({ ...newMember, role: v })}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">{t('common.department', 'Departamento')}</Label>
                      <Select
                        value={newMember.departmentId}
                        onValueChange={(id) => {
                          const d = deptDrafts.find((x) => x.id === id);
                          setNewMember({
                            ...newMember,
                            departmentId: id,
                            departmentName: d?.name ?? '',
                          });
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {deptDrafts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
                    <Label className="text-xs mb-1 block text-slate-700">{t('onboarding.team.schedule', 'Horas disponibles por día')}</Label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-snug">
                      {t(
                        'onboarding.team.scheduleHelp',
                        'Cuántas horas suele trabajar esa persona cada día (no es el calendario de vacaciones). Se suman para la capacidad semanal.'
                      )}
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {dayKeys.map((k, i) => (
                        <div key={k} className="text-center">
                          <span className="text-[10px] text-slate-500">{dayLabels[i]}</span>
                          <Input
                            type="number"
                            min={0}
                            max={12}
                            className="h-8 px-1 text-center text-xs"
                            value={newMember.workSchedule[k]}
                            onChange={(e) =>
                              setNewMember({
                                ...newMember,
                                workSchedule: { ...newMember.workSchedule, [k]: Math.max(0, Number(e.target.value) || 0) },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <Button type="button" className="w-full gap-2 shadow-sm" onClick={addPendingMember}>
                      <UserPlus className="h-4 w-4" />
                      {t('onboarding.team.addCta', 'Añadir a la lista y preparar invitación')}
                    </Button>
                    <p className="text-[11px] text-center text-slate-600 leading-snug px-1">
                      {t(
                        'onboarding.team.addHelper',
                        'Si no pulsas este botón, los datos de arriba no se guardan: no se envía ningún email hasta que añadas a la lista y luego continúes.'
                      )}
                    </p>
                  </div>
                </div>
                  </div>
                </div>

                <div className={cn(obPanel, 'space-y-3 border-dashed border-slate-300 p-3 sm:p-4')}>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-snug text-center">
                    {t(
                      'onboarding.team.skipExplainer',
                      '«Omitir» significa seguir solo tú por ahora. Podrás invitar gente después desde Equipo. No se envía ningún email en este paso si no hay nadie en la lista.'
                    )}
                  </p>
                  <div className="flex justify-between gap-2 pt-1 border-t border-slate-200/80">
                    <Button type="button" variant="ghost" onClick={goToPrevStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                    </Button>
                    <Button onClick={handleEmployeesSubmit} disabled={isProcessing} className="gap-2 min-w-[8rem]">
                      {pendingMembers.length === 0 ? t('common.skip', 'Omitir') : t('onboarding.team.continue', 'Continuar')}{' '}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'client' && (
              <Form {...clientForm}>
                <form onSubmit={clientForm.handleSubmit(handleClientSubmit)} className="space-y-4">
                  <OnboardingCallout
                    title={t('onboarding.client.calloutTitle', 'Cliente')}
                    bullets={
                      Array.isArray(clientCalloutBullets) ? (clientCalloutBullets as string[]) : []
                    }
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                  <FormField
                    control={clientForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('onboarding.client.name', 'Nombre del cliente')}</FormLabel>
                        <FormDescription className="text-xs">
                          {t('onboarding.client.nameHelp', 'Nombre comercial o fiscal tal como lo reconoce el equipo.')}
                        </FormDescription>
                        <FormControl>
                          <Input {...field} placeholder={t('onboarding.client.namePh', 'Ej. Acme Retail')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.color', 'Color')}</FormLabel>
                        <FormDescription className="text-xs">
                          {t('onboarding.client.colorHelp', 'Solo visual: barras y etiquetas donde aparezca este cliente.')}
                        </FormDescription>
                        <div className="flex gap-2 flex-wrap">
                          {CLIENT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => field.onChange(color)}
                              className={cn(
                                'w-8 h-8 rounded-full transition-all',
                                field.value === color ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      disabled={isProcessing}
                      onClick={handleClientSkip}
                    >
                      {t('onboarding.client.skip', 'Omitir: añadiré clientes después')}
                    </Button>
                    <div className="flex justify-between gap-2">
                      <Button type="button" variant="ghost" onClick={goToPrevStep}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                      </Button>
                      <Button type="submit" disabled={isProcessing}>
                        {t('common.continue', 'Continuar')} <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            )}

            {currentStep === 'project' && (
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(handleProjectSubmit)} className="space-y-4">
                  <OnboardingCallout
                    title={t('onboarding.project.calloutTitle', 'Proyecto')}
                    bullets={
                      Array.isArray(projectCalloutBullets) ? (projectCalloutBullets as string[]) : []
                    }
                  />
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-2">
                    <div className="xl:col-span-2">
                      <FormField
                        control={projectForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('onboarding.project.name', 'Nombre del proyecto')}</FormLabel>
                            <FormDescription className="text-xs">
                              {t('onboarding.project.nameHelp', 'Un nombre que entienda todo el equipo; puede incluir cliente o mes si os ayuda.')}
                            </FormDescription>
                            <FormControl>
                              <Input {...field} placeholder={t('onboarding.project.namePh', 'Ej. Contenidos blog — marzo')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={projectForm.control}
                      name="responsibleDepartmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('onboarding.project.dept', 'Departamento responsable')}</FormLabel>
                          <FormDescription className="text-xs">
                            {t(
                              'onboarding.project.deptHelp',
                              'Qué área “lidera” el proyecto en informes y filtros. Podéis dejarlo sin asignar si aún no aplica.'
                            )}
                          </FormDescription>
                          <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('onboarding.project.deptPh', 'Seleccionar')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">{t('onboarding.project.deptNone', 'Sin asignar')}</SelectItem>
                              {deptDrafts.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={projectForm.control}
                      name="projectType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('onboarding.project.type', 'Tipo (opcional)')}</FormLabel>
                          <p className="text-xs text-slate-500 -mt-1 mb-1">
                            {t(
                              'onboarding.project.typeHint',
                              'Etiqueta interna del proyecto; la lista es común a todas las agencias (se puede ampliar en el futuro desde configuración).'
                            )}
                          </p>
                          <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">{t('onboarding.project.typeNone', 'Ninguno')}</SelectItem>
                              {PROJECT_TYPE_PRESET_VALUES.map((preset) => (
                                <SelectItem key={preset} value={preset}>
                                  {t(`onboarding.project.types.${preset}`, preset)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {projectForm.watch('projectType') === PROJECT_TYPE_ENTREGABLE && (
                      <div className="xl:col-span-2 space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t(
                            'clientsAndProjects.dialogs.newProject.deliverableBlockIntro',
                            'Importe total del contrato y fechas de la fase. El sistema lo prorratea entre meses para mostrar el ingreso correspondiente en Rentabilidad y el avance en Seguimiento Operativo.'
                          )}
                        </p>
                        <FormField
                          control={projectForm.control}
                          name="deliverableContractFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t('onboarding.project.deliverableTotal', { currencyParens: inCurrencyParens, defaultValue: `Importe total contrato ${inCurrencyParens}` })}
                              </FormLabel>
                              <FormControl>
                                <Input type="text" inputMode="decimal" placeholder="Ej: 12000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <FormField
                            control={projectForm.control}
                            name="deliverableStartDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('onboarding.project.deliverableStart', 'Inicio fase')}</FormLabel>
                                <FormControl>
                                  <PhaseDatePickerButton
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder={t('onboarding.project.pickStart', 'Elegir inicio')}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={projectForm.control}
                            name="deliverableDueDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('onboarding.project.deliverableDue', 'Fin previsto')}</FormLabel>
                                <FormControl>
                                  <PhaseDatePickerButton
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder={t('onboarding.project.pickDue', 'Elegir fin')}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                    <div className="xl:col-span-2">
                      <FormField
                        control={projectForm.control}
                        name="budgetHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('onboarding.project.budget', 'Horas mensuales (objetivo)')}</FormLabel>
                            <FormDescription className="text-xs">
                              {t(
                                'onboarding.project.budgetHelp',
                                'Horas que planeáis dedicar a este proyecto en un mes de media. Sirve para comparar con lo planificado y lo real en informes.'
                              )}
                            </FormDescription>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div
                      className={cn(
                        'xl:col-span-2 grid gap-3',
                        projectForm.watch('projectType') === PROJECT_TYPE_ENTREGABLE
                          ? 'grid-cols-1'
                          : 'grid-cols-1 sm:grid-cols-2'
                      )}
                    >
                      <FormField
                        control={projectForm.control}
                        name="minHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('onboarding.project.minH', 'Mínimo de horas (opcional)')}</FormLabel>
                            <FormDescription className="text-xs">
                              {t(
                                'onboarding.project.minHHelp',
                                'Suelo mínimo mensual que garantizáis al cliente; puede ser 0 si no aplica.'
                              )}
                            </FormDescription>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {projectForm.watch('projectType') !== PROJECT_TYPE_ENTREGABLE && (
                        <FormField
                          control={projectForm.control}
                          name="monthlyFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('onboarding.project.monthlyFee', currencyLabels)}</FormLabel>
                              <p className="text-xs text-slate-500 -mt-1 mb-1">
                                {t(
                                  'onboarding.project.monthlyFeeHint',
                                  'Importe total que paga el cliente por este proyecto al mes (no es precio por hora).'
                                )}
                              </p>
                              <FormControl>
                                <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      disabled={isProcessing}
                      onClick={handleProjectSkip}
                    >
                      {t('onboarding.project.skip', 'Omitir: crearé proyectos después')}
                    </Button>
                    <div className="flex justify-between gap-2">
                      <Button type="button" variant="ghost" onClick={goToPrevStep}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back', 'Atrás')}
                      </Button>
                      <Button type="submit" disabled={isProcessing} className="gap-2 bg-gradient-to-r from-primary to-indigo-600">
                        <Sparkles className="h-4 w-4" /> {t('onboarding.finish', 'Completar')}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            )}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="shrink-0 text-center text-slate-400 text-xs sm:text-sm pt-2 px-2">
          {t('onboarding.footer', 'Puedes cambiar todo esto después en Configuración de agencia')}
        </p>
      </div>
    </div>
  );
}
