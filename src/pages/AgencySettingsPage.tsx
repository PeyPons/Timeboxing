import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunctionWithRetry } from '@/lib/invokeEdgeFunction';
import { cn } from '@/lib/utils';
import { useAgency } from '@/contexts/AgencyContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { toast } from '@/lib/notify';
import {
  Building2, Settings, Users, Palette, Save, Loader2,
  Filter, Plus, Trash2, HelpCircle, Info, X,
  Rocket, Facebook, Megaphone, PlusCircle, ShieldCheck, GitBranch, Database, AlertTriangle, Download,
  Eye, Lock, Unlock, Calendar, Check, ChevronDown, BarChart2, Layers, ExternalLink, Activity, CreditCard, LayoutGrid, LineChart, Bell
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AVAILABLE_INTEGRATIONS } from '@/config/integrations';
import { CustomProjectFilter, RolePermissions, ProjectAliasingRule, DepartmentDefinition } from '@/types';
import { normalizeDepartments } from '@/utils/departmentUtils';
import { DEFAULT_FILTERS } from '@/hooks/useProjectFilters';
import { UserPermissions, DEFAULT_PERMISSIONS } from '@/types/permissions';
import { normalizeRolesForSave } from '@/utils/agencySettingsPermissions';
import { sanitizeIntegrationsForSave } from '@/utils/agencyUtils';
import { normalizeMetaAccountId, syncAdAccountCurrenciesFromPlatform } from '@/utils/adAccountCurrencySync';
import { CurrencySelect } from '@/components/agency/CurrencySelect';
import { resolveAgencyCurrency } from '@/utils/currencyUtils';
import type { AgencyCurrencyCode } from '@/constants/currencies';
import { RolePermissionsEditor } from '@/components/agency/RolePermissionsEditor';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DepartmentViewConfigDialog } from '@/components/agencies/DepartmentViewConfigDialog';
import { AgencyBillingTab } from '@/components/agencies/AgencyBillingTab';
import {
  NotificationRulesSection,
  type NotificationRulesSectionHandle,
} from '@/components/agency/NotificationRulesSection';
import { useDepartmentConfigs } from '@/hooks/useDashboardView';
import { useApp } from '@/contexts/AppContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import React from 'react';

type GoogleAccountRow = { id: string; resourceName: string; descriptiveName?: string | null; currencyCode?: string | null };

/** Evita ráfagas: HMR de Vite remonta el componente y antes se disparaban decenas de POST al mismo endpoint. */
const googleAccountsListInflight = new Map<string, Promise<GoogleAccountRow[]>>();

function fetchGoogleAccountsDeduped(agencyId: string): Promise<GoogleAccountRow[]> {
  const existing = googleAccountsListInflight.get(agencyId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const response = await invokeEdgeFunctionWithRetry(
        'list-google-accounts',
        { agency_id: agencyId, sync_config: true },
        { retries: 2, baseDelayMs: 2000 }
      );
      const data = response.data as { error?: string; accounts?: GoogleAccountRow[] };
      const error = response.error;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.accounts ?? [];
    } finally {
      googleAccountsListInflight.delete(agencyId);
    }
  })();
  googleAccountsListInflight.set(agencyId, p);
  return p;
}

/** Selector de cuentas Google Ads: solo se monta cuando hay token, para no romper reglas de hooks al desvincular */
function GoogleAdsAccountSelect({
  agencyId,
  fetchEnabled,
}: {
  agencyId: string;
  /** Solo pide el listado cuando la pestaña Integraciones está visible (evita trabajo en segundo plano). */
  fetchEnabled: boolean;
}) {
  const { t } = useAppTranslation();
  const [accounts, setAccounts] = useState<GoogleAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!agencyId || !fetchEnabled) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const debounceMs = 400;
    const t = window.setTimeout(() => {
      const fetchAccounts = async () => {
        setLoading(true);
        setError(null);
        try {
          const list = await fetchGoogleAccountsDeduped(agencyId);
          if (cancelled) return;
          setAccounts(list);
        } catch (e: unknown) {
          if (cancelled) return;
          console.error('Error fetching Google accounts:', e);
          setError('No se pudo cargar el listado (servidor 503 o red). Revisa Edge Functions en el host.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      void fetchAccounts();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [agencyId, fetchEnabled, retryTick]);

  if (!fetchEnabled) {
    return (
      <SelectItem value="__idle__" disabled>
        {t('agency.integrations.googleAds.openTabToLoad', 'Abre la pestaña Integraciones para cargar cuentas')}
      </SelectItem>
    );
  }
  if (loading) {
    return (
      <SelectItem value="__loading__" disabled>
        {t('agency.integrations.googleAds.loadingAccounts', 'Cargando cuentas...')}
      </SelectItem>
    );
  }
  if (error) {
    return (
      <>
        <div
          className="px-2 py-2 border-b border-border"
          onPointerDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              setRetryTick((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{error}</p>
        </div>
        <SelectItem value="__error__" disabled>Error al cargar</SelectItem>
      </>
    );
  }
  if (accounts.length === 0) return <SelectItem value="__empty__" disabled>No se encontraron cuentas</SelectItem>;
  return (
    <>
      {accounts.map(acc => (
        <SelectItem key={acc.id} value={acc.id}>
          {acc.descriptiveName ? `${acc.descriptiveName} (${acc.id})` : `Cuenta ${acc.id}`}
          {acc.currencyCode ? ` · ${acc.currencyCode}` : ''}
        </SelectItem>
      ))}
    </>
  );
}

const META_OAUTH_SCOPES = 'ads_read';

const TAB_VALUES = ['general', 'departments', 'team', 'projects', 'modules', 'analytics', 'integrations', 'appearance', 'notifications', 'billing'] as const;
type AgencySettingsTab = typeof TAB_VALUES[number];

const TAB_CONFIG: Array<{
  value: AgencySettingsTab;
  icon: LucideIcon;
  labelKey: string;
  fallback: string;
}> = [
  { value: 'general', icon: Settings, labelKey: 'agency.tabs.general', fallback: 'General' },
  { value: 'departments', icon: Layers, labelKey: 'agency.tabs.organization', fallback: 'Organización' },
  { value: 'team', icon: Users, labelKey: 'agency.tabs.team', fallback: 'Equipo' },
  { value: 'projects', icon: Filter, labelKey: 'agency.tabs.projects', fallback: 'Proyectos' },
  { value: 'modules', icon: LayoutGrid, labelKey: 'agency.tabs.features', fallback: 'Funcionalidades' },
  { value: 'analytics', icon: LineChart, labelKey: 'agency.tabs.analytics', fallback: 'Analítica' },
  { value: 'integrations', icon: Rocket, labelKey: 'agency.tabs.connections', fallback: 'Conexiones' },
  { value: 'appearance', icon: Palette, labelKey: 'agency.tabs.appearance', fallback: 'Apariencia' },
  { value: 'notifications', icon: Bell, labelKey: 'agency.tabs.notifications', fallback: 'Notificaciones' },
  { value: 'billing', icon: CreditCard, labelKey: 'agency.tabs.billing', fallback: 'Plan y facturación' },
];

export default function AgencySettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') ?? 'general';
  const activeTab = TAB_VALUES.includes(tabParam as typeof TAB_VALUES[number]) ? tabParam : 'general';
  const { t } = useAppTranslation();

  const { currentAgency, refreshAgency, updateSettings, updateAgencyName, isLoading: isAgencyLoading } = useAgency();
  const { hasPermission } = usePermissions();
  const { canAccessRouteByPlan } = useSubscriptionLimits();
  const { projects, clients } = useApp();
  const [saving, setSaving] = useState(false);
  const notificationRulesRef = React.useRef<NotificationRulesSectionHandle | null>(null);

  // Estado local para edición
  const [agencyName, setAgencyName] = useState(currentAgency?.name || '');
  const [modules, setModules] = useState(currentAgency?.settings?.modules || {
    ppc: true,
    weeklyFeedback: true,
    professionalGoals: true,
    deadlines: true,
    timeTracker: false,
  });
  const [timeTrackerMaxHours, setTimeTrackerMaxHours] = useState(
    currentAgency?.settings?.timeTrackerMaxHours ?? 12
  );
  const [primaryColor, setPrimaryColor] = useState(
    currentAgency?.settings?.branding?.primaryColor || '#6366f1'
  );
  const [projectFilters, setProjectFilters] = useState<CustomProjectFilter[]>(
    currentAgency?.settings?.projectFilters || DEFAULT_FILTERS
  );
  // Project aliasing rules (e.g., Kit Digital renaming)
  const DEFAULT_ALIASING_RULE: ProjectAliasingRule = {
    id: 'kit-digital',
    name: 'kit-digital',
    displayPrefix: 'KD:',
    enabled: true,
    matchPatterns: ['(KD)', '[KD]', 'KD ', 'KD:', 'kit digital', 'kitdigital'],
    groupAsVirtualClient: true,
    virtualClientName: 'Kit Digital',
    virtualClientColor: '#8B5CF6'
  };
  const [projectAliasingRules, setProjectAliasingRules] = useState<ProjectAliasingRule[]>(
    currentAgency?.settings?.projectAliasingRules || [DEFAULT_ALIASING_RULE]
  );
  const [integrations, setIntegrations] = useState(currentAgency?.settings?.integrations || {
    googleAdsCustomerId: '',
    googleAdsDevToken: ''
  });
  const [newAccountId, setNewAccountId] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [syncingMetaAccounts, setSyncingMetaAccounts] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  // Roles and Departments state
  // Safely initialize roles handling legacy string[] data
  const [roles, setRoles] = useState<RolePermissions[]>(() => {
    const existingRoles = currentAgency?.settings?.roles;
    if (!existingRoles || existingRoles.length === 0) {
      // Sin roles predefinidos - cada agencia crea los suyos
      return [];
    }
    // Migration check: if elements are strings, convert them
    if (existingRoles.length > 0 && typeof existingRoles[0] === 'string') {
      return (existingRoles as unknown as string[]).map(r => ({
        name: r,
        permissions: DEFAULT_PERMISSIONS
      }));
    }
    return existingRoles as RolePermissions[];
  });

  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() =>
    normalizeDepartments(currentAgency?.settings?.departments)
  );
  const [expandedRoleIndex, setExpandedRoleIndex] = useState<number | null>(null);
  const [newDepartment, setNewDepartment] = useState('');
  const [newDepartmentColor, setNewDepartmentColor] = useState('#6366f1');
  const [enabledIntegrations, setEnabledIntegrations] = useState<Record<string, boolean>>(
    currentAgency?.settings?.enabledIntegrations || {}
  );
  const [weeklyCloseDay, setWeeklyCloseDay] = useState(
    currentAgency?.settings?.weeklyCloseDay ?? 4 // Default to Friday
  );
  const [openWeeklyCloseDay, setOpenWeeklyCloseDay] = useState(false);

  // Excluir proyectos/clientes del cálculo de precisión de planificación (índice de fiabilidad)
  const [planningPrecisionExclusions, setPlanningPrecisionExclusions] = useState<{ projectIds: string[]; clientIds: string[] }>({
    projectIds: currentAgency?.settings?.planningPrecisionExclusions?.projectIds ?? [],
    clientIds: currentAgency?.settings?.planningPrecisionExclusions?.clientIds ?? []
  });
  const [openExcludeProjects, setOpenExcludeProjects] = useState(false);
  const [openExcludeClients, setOpenExcludeClients] = useState(false);

  const [hoursTrackingPreference, setHoursTrackingPreference] = useState<'computed' | 'actual'>(
    currentAgency?.settings?.hoursTrackingPreference ?? 'computed'
  );
  const [agencyCurrency, setAgencyCurrency] = useState<AgencyCurrencyCode>(() =>
    resolveAgencyCurrency(currentAgency?.settings),
  );

  /** Palabras clave en nombre de proyecto que excluyen del riesgo "Poco avance" en Radar operativo. */
  const [radarLowProgressExcludeKeywords, setRadarLowProgressExcludeKeywords] = useState<string[]>(
    currentAgency?.settings?.radarLowProgressExcludeKeywords ?? []
  );
  const [radarKeywordInput, setRadarKeywordInput] = useState('');
  const [dependencyUnblockEmailsEnabled, setDependencyUnblockEmailsEnabled] = useState(
    currentAgency?.settings?.dependencyUnblockEmailsEnabled !== false,
  );

  // Department view configuration
  const [deptConfigDialogOpen, setDeptConfigDialogOpen] = useState(false);
  const [selectedDeptForConfig, setSelectedDeptForConfig] = useState<string>('');
  const { configs: departmentConfigs, getConfigForDepartment } = useDepartmentConfigs();

  const fetchConnectedAccounts = useCallback(async () => {
    if (!currentAgency?.id) return;
    const { data } = await supabase
      .from('ad_accounts_config')
      .select('*')
      .eq('agency_id', currentAgency.id)
      .eq('platform', 'meta')
      .eq('is_active', true);
    setConnectedAccounts(data || []);
  }, [currentAgency?.id]);

  // Sync state when agency loads (no pisar el formulario mientras guarda)
  useEffect(() => {
    if (!currentAgency || saving) return;

    setAgencyName(currentAgency.name || '');
      setModules({
        ppc: true,
        weeklyFeedback: true,
        professionalGoals: true,
        deadlines: true,
        timeTracker: false,
        ...currentAgency.settings?.modules,
      });
      setTimeTrackerMaxHours(currentAgency.settings?.timeTrackerMaxHours ?? 12);
      setPrimaryColor(currentAgency.settings?.branding?.primaryColor || '#6366f1');
      setProjectFilters(currentAgency.settings?.projectFilters || DEFAULT_FILTERS);
      setIntegrations(currentAgency.settings?.integrations || {
        googleAdsCustomerId: '',
        googleAdsDevToken: ''
      });

      // Safely set roles with migration check
      const existingRoles = currentAgency.settings?.roles;
      if (existingRoles && existingRoles.length > 0 && typeof existingRoles[0] === 'string') {
        const migratedRoles = (existingRoles as unknown as string[]).map(r => ({
          name: r,
          permissions: DEFAULT_PERMISSIONS
        }));
        setRoles(migratedRoles);
      } else {
        setRoles(currentAgency.settings?.roles || []);
      }

      setDepartments(normalizeDepartments(currentAgency.settings?.departments));
      setEnabledIntegrations(currentAgency.settings?.enabledIntegrations || {});
      setWeeklyCloseDay(currentAgency.settings?.weeklyCloseDay ?? 4);
      setPlanningPrecisionExclusions({
        projectIds: currentAgency.settings?.planningPrecisionExclusions?.projectIds ?? [],
        clientIds: currentAgency.settings?.planningPrecisionExclusions?.clientIds ?? []
      });
      setHoursTrackingPreference(currentAgency.settings?.hoursTrackingPreference ?? 'computed');
      setAgencyCurrency(resolveAgencyCurrency(currentAgency.settings));
      setRadarLowProgressExcludeKeywords(currentAgency.settings?.radarLowProgressExcludeKeywords ?? []);
      setDependencyUnblockEmailsEnabled(currentAgency.settings?.dependencyUnblockEmailsEnabled !== false);
      fetchConnectedAccounts();
  }, [currentAgency, saving, fetchConnectedAccounts]);

  // Role Management
  const isSystemRole = (roleName: string) => {
    const systemRoles = ['administrador', 'admin', 'administrator'];
    return systemRoles.some(sr => sr === roleName.toLowerCase());
  };

  const addNewRole = () => {
    setRoles([...roles, { name: 'Nuevo rol', permissions: { ...DEFAULT_PERMISSIONS, can_access_agency_settings: false } }]);
    setExpandedRoleIndex(roles.length); // Open the new role
  };

  const deleteRole = (index: number) => {
    const role = roles[index];
    if (role.is_system_role || isSystemRole(role.name)) {
      toast.error(t('agency.toasts.cannotDeleteAdminRole'));
      return;
    }
    const newRoles = [...roles];
    newRoles.splice(index, 1);
    setRoles(newRoles);
    if (expandedRoleIndex === index) setExpandedRoleIndex(null);
  };

  const updateRoleName = (index: number, name: string) => {
    const newRoles = [...roles];
    newRoles[index].name = name;
    setRoles(newRoles);
  };

  const toggleRolePermission = (roleIndex: number, permission: keyof UserPermissions, checked: boolean) => {
    const newRoles = [...roles];
    // Asegurarse de que permissions objeto existe
    if (!newRoles[roleIndex].permissions) {
      newRoles[roleIndex].permissions = { ...DEFAULT_PERMISSIONS };
    }
    newRoles[roleIndex].permissions[permission] = checked;
    setRoles(newRoles);
  };

  // Department Management
  const addNewDepartment = () => {
    const name = newDepartment.trim();
    if (!name) return;
    if (departments.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t('agency.toasts.departmentExists'));
      return;
    }
    const id = `dept-${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase().slice(0, 12)}`;
    setDepartments([...departments, { id, name, color: newDepartmentColor }]);
    setNewDepartment('');
    setNewDepartmentColor('#6366f1');
  };

  const deleteDepartment = (deptId: string) => {
    setDepartments(departments.filter(d => d.id !== deptId));
  };
  const updateDepartmentColor = (deptId: string, color: string) => {
    setDepartments(departments.map(d => d.id === deptId ? { ...d, color } : d));
  };
  const updateDepartmentName = (deptId: string, name: string) => {
    if (!name.trim()) return;
    setDepartments(departments.map(d => d.id === deptId ? { ...d, name: name.trim() } : d));
  };

  const handleSave = async () => {
    if (!currentAgency?.id) {
      toast.error(t('agency.toasts.noAgencySelected'));
      return;
    }

    setSaving(true);
    try {
      const rolesToSave = normalizeRolesForSave(roles);

      const weeklyOn = Boolean(modules.weeklyFeedback);

      await updateSettings({
        modules: { ...modules, weeklyFeedback: weeklyOn },
        roles: rolesToSave,
        departments,
        branding: {
          ...currentAgency.settings?.branding,
          primaryColor
        },
        projectFilters,
        projectAliasingRules,
        integrations: sanitizeIntegrationsForSave(integrations),
        enabledIntegrations,
        weeklyCloseDay: weeklyOn ? weeklyCloseDay : undefined,
        planningPrecisionExclusions,
        timeTrackerMaxHours,
        hoursTrackingPreference,
        currency: agencyCurrency,
        radarLowProgressExcludeKeywords,
        dependencyUnblockEmailsEnabled,
      });

      // Si el nombre ha cambiado, actualizarlo por separado
      if (agencyName !== currentAgency.name) {
        await updateAgencyName(agencyName);
      }

      const notificationsOk = await notificationRulesRef.current?.saveAllRules();
      if (notificationsOk === false) {
        toast.error(t('agency.toasts.savePartialNotificationsError'));
        return;
      }

      setRoles(rolesToSave);
      toast.success(t('agency.toasts.configSaved'));
    } catch (error) {
      console.error('Error guardando agencia:', error);
      toast.error(t('agency.toasts.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountId) return toast.error(t('agency.toasts.accountIdRequired'));
    if (!currentAgency?.id) return;

    setIsAddingAccount(true);
    const accountId = normalizeMetaAccountId(newAccountId);
    const { error } = await supabase.from('ad_accounts_config').insert({
      platform: 'meta',
      account_id: accountId,
      is_active: true,
      agency_id: currentAgency.id,
    });

    if (error) {
      console.error('Error guardando cuenta:', error);
      if (error.code === '23505') {
        toast.error(t('agency.toasts.accountAlreadyRegistered'));
      } else {
        toast.error(error.message || t('agency.toasts.accountSaveError'));
      }
    } else {
      try {
        await syncAdAccountCurrenciesFromPlatform(currentAgency.id, 'meta');
      } catch (e) {
        console.warn('sync meta currencies tras alta manual:', e);
      }
      toast.success(t('agency.toasts.accountAdded'));
      setNewAccountId('');
      fetchConnectedAccounts();
    }
    setIsAddingAccount(false);
  };

  const handleRemoveAccount = (id: string) => {
    setAccountToDelete(id);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    const { error } = await supabase
      .from('ad_accounts_config')
      .delete()
      .eq('id', accountToDelete);

    if (error) {
      toast.error(t('agency.toasts.accountDeleteError'));
      console.error(error);
    } else {
      toast.success(t('agency.toasts.accountDeleted'));
      fetchConnectedAccounts();
    }
    setAccountToDelete(null);
  };


  const toggleModule = (key: string) => {
    setModules(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }));
  };

  // Filter management functions
  const toggleFilter = (filterId: string) => {
    setProjectFilters(prev => prev.map(f =>
      f.id === filterId ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const updateFilterPatterns = (filterId: string, field: 'includePatterns' | 'excludePatterns', value: string) => {
    const patterns = value.split(',').map(p => p.trim()).filter(Boolean);
    setProjectFilters(prev => prev.map(f =>
      f.id === filterId ? { ...f, [field]: patterns } : f
    ));
  };

  const updateFilterName = (filterId: string, displayName: string) => {
    setProjectFilters(prev => prev.map(f =>
      f.id === filterId ? { ...f, displayName } : f
    ));
  };

  const updateFilterDescription = (filterId: string, description: string) => {
    setProjectFilters(prev => prev.map(f =>
      f.id === filterId ? { ...f, description } : f
    ));
  };

  const addNewFilter = () => {
    const newFilter: CustomProjectFilter = {
      id: `custom-${Date.now()}`,
      name: `custom-${projectFilters.length + 1}`,
      displayName: 'Nuevo filtro',
      enabled: true,
      includePatterns: [],
      excludePatterns: [],
      description: ''
    };
    setProjectFilters(prev => [...prev, newFilter]);
  };

  const removeFilter = (filterId: string) => {
    setProjectFilters(prev => prev.filter(f => f.id !== filterId));
  };

  const resetToDefaults = () => {
    setProjectFilters(DEFAULT_FILTERS);
    toast.info(t('agency.toasts.filtersReset'));
  };

  const updateAliasingRule = (ruleId: string, updates: Partial<ProjectAliasingRule>) => {
    setProjectAliasingRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, ...updates } : r
    ));
  };

  const addNewAliasingRule = () => {
    const newRule: ProjectAliasingRule = {
      id: `alias-${Date.now()}`,
      name: `custom-alias-${projectAliasingRules.length + 1}`,
      displayPrefix: 'NUEVO:',
      enabled: true,
      matchPatterns: [],
      groupAsVirtualClient: false
    };
    setProjectAliasingRules(prev => [...prev, newRule]);
  };

  const deleteAliasingRule = (ruleId: string) => {
    setProjectAliasingRules(prev => prev.filter(r => r.id !== ruleId));
  };

  if (isAgencyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!currentAgency) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <p className="text-amber-800">No se ha encontrado una agencia asociada a tu cuenta.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeTabMeta = TAB_CONFIG.find((tab) => tab.value === activeTab) ?? TAB_CONFIG[0];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {t('agency.title', 'Configuración de agencia')}
          </h1>
          <p className="text-slate-500 mt-1">{t('agency.subtitle', 'Elige una sección para ver y editar la configuración')}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t('agency.activeSection', 'Sección activa')}: {t(activeTabMeta.labelKey, activeTabMeta.fallback)}
          </p>
        </div>
        <Badge variant="outline" className="text-sm w-fit">
          {currentAgency.slug}
        </Badge>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', v);
            return next;
          });
        }}
        className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"
      >
        <TabsList className="grid grid-flow-col auto-cols-fr lg:grid-flow-row lg:auto-cols-auto lg:w-full h-auto p-2 rounded-xl bg-slate-100 border border-slate-200 lg:sticky lg:top-4 self-start w-full overflow-x-auto lg:overflow-visible">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="justify-start gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-0"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(tab.labelKey, tab.fallback)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-3 sm:p-4 lg:p-6">
          <TabsContent value="general" className="mt-0 space-y-6">
            {/* Información General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  {t('agency.general.title', 'Información general')}
                </CardTitle>
                <CardDescription>
                  {t('agency.general.description', 'Datos básicos de tu agencia')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agency-name">{t('agency.general.name', 'Nombre de la agencia')}</Label>
                    <Input
                      id="agency-name"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder={t('agency.general.placeholder', 'Nombre de tu agencia')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agency-slug">{t('agency.general.slug', 'Identificador (slug)')}</Label>
                    <Input
                      id="agency-slug"
                      value={currentAgency.slug}
                      disabled
                      className="bg-slate-50"
                    />
                    <p className="text-xs text-slate-500">{t('agency.general.slugNote', 'El slug no se puede modificar')}</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="agency-currency">{t('agency.general.currency', 'Moneda de la agencia')}</Label>
                    <CurrencySelect
                      id="agency-currency"
                      value={agencyCurrency}
                      onValueChange={setAgencyCurrency}
                      className="max-w-md"
                    />
                    <p className="text-xs text-slate-500">
                      {t(
                        'agency.general.currencyHint',
                        'Rentabilidad, fees, nóminas y gastos comunes se muestran en esta moneda. Las cuentas de Ads pueden usar otra divisa (se indica en Monitor PPC).',
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preferencias de Seguimiento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {t('agency.general.tracking', 'Preferencia de Seguimiento')}
                </CardTitle>
                <CardDescription>
                  {t('agency.general.trackingDesc', 'Decide qué horas se utilizarán para calcular los progresos y la rentabilidad.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-lg">
                  <Label>{t('agency.general.hoursToPrioritize', 'Tipo de horas a priorizar')}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={cn(
                        "relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none",
                        hoursTrackingPreference === 'computed' ? "border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/50" : "border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="hours-pref"
                        value="computed"
                        className="sr-only"
                        checked={hoursTrackingPreference === 'computed'}
                        onChange={() => setHoursTrackingPreference('computed')}
                      />
                      <span className="flex flex-1">
                        <span className="flex flex-col">
                          <span className="block text-sm font-medium text-slate-900">{t('agency.general.computed', 'Horas Computadas')}</span>
                          <span className="mt-1 flex items-center text-sm text-slate-500">
                            {t('agency.general.computedDesc', '(Recomendado) Validadas tras el Weekly.')}
                          </span>
                        </span>
                      </span>
                      {hoursTrackingPreference === 'computed' && (
                        <Check className="h-5 w-5 text-indigo-600 ml-3" aria-hidden="true" />
                      )}
                    </label>

                    <label
                      className={cn(
                        "relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none",
                        hoursTrackingPreference === 'actual' ? "border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/50" : "border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="hours-pref"
                        value="actual"
                        className="sr-only"
                        checked={hoursTrackingPreference === 'actual'}
                        onChange={() => setHoursTrackingPreference('actual')}
                      />
                      <span className="flex flex-1">
                        <span className="flex flex-col">
                          <span className="block text-sm font-medium text-slate-900">{t('agency.general.actual', 'Horas Reales')}</span>
                          <span className="mt-1 flex items-center text-sm text-slate-500">
                            {t('agency.general.actualDesc', 'Prioriza las horas del campo Real para progreso y rentabilidad: incluyen el tiempo imputado con el cronómetro y puedes editarlas para corregir si hace falta.')}
                          </span>
                        </span>
                      </span>
                      {hoursTrackingPreference === 'actual' && (
                        <Check className="h-5 w-5 text-indigo-600 ml-3" aria-hidden="true" />
                      )}
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-slate-600" />
                  {t('agency.general.dataExportTitle', 'Exportación para informes')}
                </CardTitle>
                <CardDescription>
                  {t('agency.general.dataExportDesc', 'Descarga JSON por mes (deadlines, planificación, coherencia, radar, rentabilidad, ausencias) para análisis o informes externos.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canAccessRouteByPlan('/exportacion-informes') ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/exportacion-informes" className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('agency.general.dataExportButton', 'Abrir hub de exportación')}
                  </Link>
                </Button>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-0 space-y-6">
            {hasPermission('can_access_agency_settings') && currentAgency && (
              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-slate-600">
                    {t('agency.team.manageDesc', 'Invitar usuarios, asignar roles y gestionar administradores de la agencia.')}
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/agencies/${currentAgency.id}/manage`} className="gap-2">
                      <Users className="h-4 w-4" />
                      {t('agency.team.manageButton', 'Gestionar miembros y administradores')}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {/* Roles y Departamentos */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Roles y Permisos */}
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        {t('agency.team.title', 'Gestión de Roles')}
                      </CardTitle>
                      <CardDescription>
                        {t('agency.team.description', 'Configura los permisos y accesos predeterminados para cada rol de tu agencia.')}
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={addNewRole}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500 -mt-2 mb-2">
                    {t('agency.team.permissionsSaveHint', 'Los cambios en permisos se aplican al guardar la configuración de la agencia.')}
                  </p>
                  {roles.map((role, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div
                        className={cn(
                          'p-3 flex items-center justify-between gap-2',
                          expandedRoleIndex === index ? 'bg-slate-50' : ''
                        )}
                      >
                        <Input
                          value={role.name}
                          onChange={(e) => updateRoleName(index, e.target.value)}
                          className="h-8 min-w-0 flex-1 max-w-[220px] font-medium"
                          placeholder={t('agency.team.roleName', 'Nombre del rol')}
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2"
                            aria-expanded={expandedRoleIndex === index}
                            onClick={() => setExpandedRoleIndex(expandedRoleIndex === index ? null : index)}
                          >
                            <ChevronDown
                              className={cn('h-4 w-4 transition-transform', expandedRoleIndex === index ? 'rotate-180' : '')}
                              aria-hidden
                            />
                            <span className="hidden sm:inline">{t('agency.team.permissions', 'Permisos')}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            onClick={() => deleteRole(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Permissions Area */}
                      {expandedRoleIndex === index && (
                        <RolePermissionsEditor
                          role={role}
                          roleIndex={index}
                          onToggle={toggleRolePermission}
                          t={t}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="h-full border-dashed">
                <CardContent className="py-6 flex flex-col gap-3">
                  <p className="text-sm text-slate-500">
                    {t('agency.team.organizationHint', 'Las áreas (nombre y color) se configuran en Organización, la pestaña anterior en este menú.')}
                  </p>
                  <Button variant="outline" size="sm" className="w-fit" asChild>
                    <Link to="/agency?tab=departments" replace>
                      {t('agency.team.goToOrganization', 'Ir a Organización')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  {t('agency.organization.cardTitle', 'Departamentos y áreas')}
                </CardTitle>
                <CardDescription>
                  {t('agency.organization.cardDescription', 'Define las áreas de tu equipo (ej: Marketing, Desarrollo). El color se usa en la barra de aviso al filtrar por departamento.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">{t('common.name', 'Nombre')}</Label>
                    <Input
                      placeholder={t('agency.departments.placeholder', 'Ej: Equipo Creativo, Ventas...')}
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNewDepartment()}
                      className="w-48"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">{t('common.color', 'Color')}</Label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={newDepartmentColor}
                        onChange={(e) => setNewDepartmentColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                      />
                      <Input
                        value={newDepartmentColor}
                        onChange={(e) => setNewDepartmentColor(e.target.value)}
                        className="w-24 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <Button onClick={addNewDepartment} disabled={!newDepartment.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('agency.departments.add', 'Añadir departamento')}
                  </Button>
                </div>

                <div className="space-y-2">
                  {departments.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-4">{t('agency.departments.empty', 'No hay departamentos. Añade uno para filtrar la vista por área.')}</p>
                  ) : (
                    departments.map((dept) => {
                      const config = getConfigForDepartment(dept.name);
                      return (
                        <div key={dept.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                              className="h-6 w-6 rounded shrink-0 border border-slate-200"
                              style={{ backgroundColor: dept.color }}
                              title={dept.color}
                            />
                            <Input
                              value={dept.name}
                              onChange={(e) => updateDepartmentName(dept.id, e.target.value)}
                              className="h-8 w-40 font-medium border-0 shadow-none focus-visible:ring-0"
                            />
                            <input
                              type="color"
                              value={dept.color}
                              onChange={(e) => updateDepartmentColor(dept.id, e.target.value)}
                              className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white shrink-0"
                            />
                            {config && (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{t('common.weekly', 'Semanal')}</Badge>
                                {config.isViewStrict && (
                                  <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                      <TooltipTrigger><Lock className="h-3 w-3 text-amber-600" /></TooltipTrigger>
                                      <TooltipContent><p className="text-xs">{t('agency.departments.strictView', 'Vista estricta')}</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10" onClick={() => { setSelectedDeptForConfig(dept.name); setDeptConfigDialogOpen(true); }}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{t('agency.departments.configTooltip', 'Configurar vista por defecto del dashboard')}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteDepartment(dept.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Department View Config Dialog - global */}
          <DepartmentViewConfigDialog
            open={deptConfigDialogOpen}
            onOpenChange={setDeptConfigDialogOpen}
            departmentName={selectedDeptForConfig}
          />

          <TabsContent value="modules" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-emerald-600" />
                  {t('agency.modules.title', 'Funcionalidades activas')}
                </CardTitle>
                <CardDescription>
                  {t('agency.modules.description', 'Activa o desactiva áreas del producto visibles en el menú. Las conexiones con terceros están en Conexiones.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="font-medium">{t('agency.modules.weeklyFeedback', 'Weekly')}</Label>
                      <p className="text-xs text-slate-500">{t('agency.modules.weeklyFeedbackDesc', 'Cierre semanal del equipo: bloquea la edición directa en el planificador cuando la semana ya ha cerrado; los pendientes se resuelven desde Weekly.')}</p>
                      <p className="text-xs text-slate-500 pt-0.5">{t('agency.modules.weeklyFeedbackEffect', 'Afecta a: botón Weekly en Mi espacio, bloqueo de semanas pasadas en el planificador y modal de cierre semanal.')}</p>
                    </div>
                    <Switch
                      checked={modules.weeklyFeedback ?? false}
                      onCheckedChange={() => toggleModule('weeklyFeedback')}
                      className="shrink-0"
                    />
                  </div>
                  {modules.weeklyFeedback && (
                    <div className="flex flex-col gap-3 p-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/30 ml-0 sm:ml-4">
                      <div className="space-y-2">
                        <Label htmlFor="weekly-close-day-modules" className="text-sm font-medium text-slate-800">
                          {t('agency.integrations.weeklyCloseDay', 'Día de cierre semanal')}
                        </Label>
                        <Popover open={openWeeklyCloseDay} onOpenChange={setOpenWeeklyCloseDay}>
                          <PopoverTrigger asChild>
                            <Button id="weekly-close-day-modules" variant="outline" className="h-9 text-sm bg-white justify-between font-normal w-full sm:max-w-xs">
                              <span className="truncate">
                                {[0, 1, 2, 3, 4, 5, 6].indexOf(weeklyCloseDay) >= 0
                                  ? t(`common.days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][weeklyCloseDay]}`,
                                    ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes (Recomendado)', 'Sábado'][weeklyCloseDay])
                                  : t('agency.integrations.selectDay', 'Selecciona un día')}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((dayKey, i) => {
                                    const dayIndex = (i + 1) % 7;
                                    const label = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes (Recomendado)', 'Sábado', 'Domingo'][i];
                                    return (
                                      <CommandItem key={dayIndex} value={label} onSelect={() => { setWeeklyCloseDay(dayIndex); setOpenWeeklyCloseDay(false); }}>
                                        <Check className={cn('mr-2 h-4 w-4 shrink-0', weeklyCloseDay === dayIndex ? 'opacity-100' : 'opacity-0')} />
                                        {t(`common.days.${dayKey}`, label)}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-slate-500">
                          {t('agency.integrations.weeklyCloseDayDesc', 'Último día de la semana operativa (desde el lunes de cada semana). Pasada esa fecha, esa semana queda cerrada para edición directa en el planificador.')}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="font-medium">{t('agency.modules.ppc', 'PPC (Ads)')}</Label>
                      <p className="text-xs text-slate-500">{t('agency.modules.ppcDesc', 'Google/Meta Ads e informes de inversión.')}</p>
                      <p className="text-xs text-slate-500 pt-0.5">{t('agency.modules.ppcEffect', 'Afecta a: entradas Google Ads / Meta Ads y rutas /ads, /meta-ads (además de permisos de rol).')}</p>
                    </div>
                    <Switch
                      checked={modules.ppc}
                      onCheckedChange={() => toggleModule('ppc')}
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="font-medium">{t('agency.modules.professionalGoals', 'Objetivos profesionales (OKRs)')}</Label>
                      <p className="text-xs text-slate-500">{t('agency.modules.professionalGoalsDesc', 'Metas por empleado en la vista Objetivos.')}</p>
                      <p className="text-xs text-slate-500 pt-0.5">{t('agency.modules.professionalGoalsEffect', 'Afecta a: entrada Objetivos y ruta /okrs (además del permiso de rol).')}</p>
                    </div>
                    <Switch
                      checked={modules.professionalGoals}
                      onCheckedChange={() => toggleModule('professionalGoals')}
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="font-medium">{t('agency.modules.deadlines', 'Deadlines mensuales')}</Label>
                      <p className="text-xs text-slate-500">{t('agency.modules.deadlinesDesc', 'Objetivos de horas por proyecto y persona cada mes, página Deadlines y coherencia con la planificación.')}</p>
                      <p className="text-xs text-slate-500 pt-0.5">{t('agency.modules.deadlinesEffect', 'Afecta a: entrada Deadlines y ruta /deadlines (además del permiso de rol).')}</p>
                    </div>
                    <Switch
                      checked={modules.deadlines}
                      onCheckedChange={() => toggleModule('deadlines')}
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="font-medium">{t('agency.modules.timeTracker', 'Cronómetro de tareas')}</Label>
                      <p className="text-xs text-slate-500">{t('agency.modules.timeTrackerDesc', 'Cronómetro en tiempo real para imputación exacta.')}</p>
                      <p className="text-xs text-slate-500 pt-0.5">{t('agency.modules.timeTrackerEffect', 'Afecta a: entrada Tiempos y ruta /tiempos (además del permiso de rol y plan).')}</p>
                    </div>
                    <Switch
                      checked={modules.timeTracker}
                      onCheckedChange={() => toggleModule('timeTracker')}
                      className="shrink-0"
                    />
                  </div>
                  {modules.timeTracker && (
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 rounded-lg border">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label className="font-medium text-sm">{t('agency.modules.maxHours', 'Máximo de horas por tarea')}</Label>
                        <p className="text-xs text-slate-500">{t('agency.modules.maxHoursDesc', 'Límite de seguridad para evitar errores al detener el tracker.')}</p>
                      </div>
                      <select
                        value={timeTrackerMaxHours}
                        onChange={(e) => setTimeTrackerMaxHours(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shrink-0"
                      >
                        {[4, 6, 8, 10, 12, 16, 24].map((h) => (
                          <option key={h} value={h}>{h}h</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-amber-600" />
                  {t('agency.analytics.planningPrecisionTitle', 'Precisión de planificación')}
                </CardTitle>
                <CardDescription>
                  {t('agency.analytics.planningPrecisionDesc', 'Excluye proyectos o clientes del índice de fiabilidad (precisión de planificación). Útil para gestiones internas que no quieras ponderar.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('agency.analytics.excludeProjects', 'Excluir proyectos')}</Label>
                    <Popover open={openExcludeProjects} onOpenChange={setOpenExcludeProjects}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-slate-50 font-normal" size="sm">
                          <span className="truncate">
                            {planningPrecisionExclusions.projectIds.length === 0
                              ? t('agency.analytics.noneSelected', 'Ninguno seleccionado')
                              : t('agency.analytics.nProjects', { count: planningPrecisionExclusions.projectIds.length })}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[360px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('agency.analytics.searchProject', 'Buscar proyecto...')} />
                          <CommandList className="max-h-[260px]">
                            <CommandEmpty>{t('agency.analytics.noProjectsMatch', 'No hay proyectos o no coincide la búsqueda')}</CommandEmpty>
                            <CommandGroup>
                              {(projects || []).map((p) => {
                                const selected = planningPrecisionExclusions.projectIds.includes(p.id);
                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={p.name}
                                    onSelect={() => {
                                      setPlanningPrecisionExclusions(prev => ({
                                        ...prev,
                                        projectIds: selected
                                          ? prev.projectIds.filter(id => id !== p.id)
                                          : [...prev.projectIds, p.id]
                                      }));
                                    }}
                                  >
                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                                    <span className="truncate">{p.name}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {planningPrecisionExclusions.projectIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {planningPrecisionExclusions.projectIds.map((id) => {
                          const p = (projects || []).find(pr => pr.id === id);
                          return p ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {p.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('agency.analytics.excludeClients', 'Excluir clientes')}</Label>
                    <Popover open={openExcludeClients} onOpenChange={setOpenExcludeClients}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-slate-50 font-normal" size="sm">
                          <span className="truncate">
                            {planningPrecisionExclusions.clientIds.length === 0
                              ? t('agency.analytics.noneSelected', 'Ninguno seleccionado')
                              : t('agency.analytics.nClients', { count: planningPrecisionExclusions.clientIds.length })}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[360px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('agency.analytics.searchClient', 'Buscar cliente...')} />
                          <CommandList className="max-h-[260px]">
                            <CommandEmpty>{t('agency.analytics.noClientsMatch', 'No hay clientes o no coincide la búsqueda')}</CommandEmpty>
                            <CommandGroup>
                              {(clients || []).map((c) => {
                                const selected = planningPrecisionExclusions.clientIds.includes(c.id);
                                return (
                                  <CommandItem
                                    key={c.id}
                                    value={c.name}
                                    onSelect={() => {
                                      setPlanningPrecisionExclusions(prev => ({
                                        ...prev,
                                        clientIds: selected
                                          ? prev.clientIds.filter(id => id !== c.id)
                                          : [...prev.clientIds, c.id]
                                      }));
                                    }}
                                  >
                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                                    <span className="truncate">{c.name}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {planningPrecisionExclusions.clientIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {planningPrecisionExclusions.clientIds.map((id) => {
                          const c = (clients || []).find(cl => cl.id === id);
                          return c ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {c.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-600" />
                  {t('agency.analytics.radarTitle', 'Radar operativo')}
                </CardTitle>
                <CardDescription>
                  {t('agency.analytics.radarDesc', 'Si el nombre del proyecto contiene alguna de estas palabras, no se marcará como riesgo «Poco avance» al final de mes. Ej.: off-page, linkbuilding.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder={t('agency.analytics.keywordPlaceholder', 'Añadir palabra clave (ej. off-page)')}
                    value={radarKeywordInput}
                    onChange={(e) => setRadarKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = radarKeywordInput.trim().toLowerCase();
                        if (v && !radarLowProgressExcludeKeywords.includes(v)) {
                          setRadarLowProgressExcludeKeywords([...radarLowProgressExcludeKeywords, v]);
                          setRadarKeywordInput('');
                        }
                      }
                    }}
                    className="max-w-[220px]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const v = radarKeywordInput.trim().toLowerCase();
                      if (v && !radarLowProgressExcludeKeywords.includes(v)) {
                        setRadarLowProgressExcludeKeywords([...radarLowProgressExcludeKeywords, v]);
                        setRadarKeywordInput('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('agency.analytics.addKeyword', 'Añadir')}
                  </Button>
                </div>
                {radarLowProgressExcludeKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {radarLowProgressExcludeKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs gap-1">
                        {kw}
                        <button
                          type="button"
                          onClick={() => setRadarLowProgressExcludeKeywords(radarLowProgressExcludeKeywords.filter((k) => k !== kw))}
                          className="rounded-full hover:bg-muted p-0.5"
                          aria-label={t('agency.analytics.removeKeywordAria', { kw })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="mt-0 space-y-6">
            {/* Filtros de Proyectos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-blue-600" />
                      {t('agency.projects.filtersTitle', 'Filtros de proyectos')}
                    </CardTitle>
                    <CardDescription>
                      {t('agency.projects.filtersDesc', 'Configura cómo se filtran los proyectos en las diferentes vistas')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetToDefaults}>
                      {t('common.reset', 'Restablecer')}
                    </Button>
                    <Button size="sm" onClick={addNewFilter}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('agency.projects.addFilter', 'Añadir filtro')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">{t('agency.projects.howItWorks', '¿Cómo funcionan los filtros?')}</p>
                    <ul className="space-y-1 text-blue-700">
                      <li>• <strong>{t('agency.projects.includePatterns', 'Patrones de inclusión')}:</strong> {t('agency.projects.includeNote', 'El nombre del proyecto debe contener AL MENOS UNO de estos términos')}</li>
                      <li>• <strong>{t('agency.projects.excludePatterns', 'Patrones de exclusión')}:</strong> {t('agency.projects.excludeNote', 'El nombre del proyecto NO puede contener NINGUNO de estos términos')}</li>
                      <li>• {t('agency.projects.emptyNote', 'Si dejas vacío "Patrones de inclusión", se incluyen todos los proyectos por defecto')}</li>
                    </ul>
                  </div>
                </div>

                {/* Filter list */}
                <div className="space-y-4">
                  {projectFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className={`border rounded-lg p-4 space-y-4 ${filter.enabled ? 'bg-white' : 'bg-slate-50 opacity-60'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={filter.enabled}
                            onCheckedChange={() => toggleFilter(filter.id)}
                          />
                          <Input
                            value={filter.displayName}
                            onChange={(e) => updateFilterName(filter.id, e.target.value)}
                            className="w-40 font-medium"
                            placeholder={t('agency.projects.filterName', 'Nombre del filtro')}
                          />
                          <Badge variant={filter.enabled ? 'default' : 'secondary'}>
                            {filter.enabled ? t('common.active', 'Activo') : t('common.inactive', 'Inactivo')}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFilter(filter.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{t('agency.projects.includePatterns', 'Patrones de inclusión')}</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{t('agency.projects.includeTooltip', 'Términos separados por coma. El proyecto debe contener AL MENOS UNO para aparecer.')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            value={filter.includePatterns.join(', ')}
                            onChange={(e) => updateFilterPatterns(filter.id, 'includePatterns', e.target.value)}
                            placeholder="Ej: SEM, PPC, DV360"
                            className="text-sm"
                          />
                          {filter.includePatterns.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {filter.includePatterns.map((p, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  + {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{t('agency.projects.excludePatterns', 'Patrones de exclusión')}</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{t('agency.projects.excludeTooltip', 'Términos separados por coma. El proyecto NO puede contener NINGUNO para aparecer.')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            value={filter.excludePatterns.join(', ')}
                            onChange={(e) => updateFilterPatterns(filter.id, 'excludePatterns', e.target.value)}
                            placeholder="Ej: RRSS, SOCIAL"
                            className="text-sm"
                          />
                          {filter.excludePatterns.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {filter.excludePatterns.map((p, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  - {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">{t('common.description', 'Descripción')} ({t('common.optional', 'opcional')})</Label>
                        <Input
                          value={filter.description || ''}
                          onChange={(e) => updateFilterDescription(filter.id, e.target.value)}
                          placeholder="Ej: Proyectos de posicionamiento orgánico"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  {projectFilters.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Filter className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>{t('agency.projects.noFilters', 'No hay filtros configurados')}</p>
                      <Button variant="link" onClick={addNewFilter}>
                        {t('agency.projects.addFirstFilter', 'Añadir el primer filtro')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Aliasing Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-600" />
                  {t('agency.projects.aliasingTitle', 'Aliasing de proyectos')}
                </CardTitle>
                <CardDescription>
                  {t('agency.projects.aliasingDesc', 'Configura reglas para renombrar proyectos automáticamente (ej: Kit Digital → KD:)')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {t('agency.projects.aliasingInstruction', 'Define patrones para detectar y renombrar proyectos especiales')}
                  </p>
                  <Button variant="outline" size="sm" onClick={addNewAliasingRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('agency.projects.newRule', 'Nueva regla')}
                  </Button>
                </div>

                <div className="space-y-4">
                  {projectAliasingRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-lg border space-y-3 ${rule.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => updateAliasingRule(rule.id, { enabled: checked })}
                          />
                          <Input
                            value={rule.name}
                            onChange={(e) => updateAliasingRule(rule.id, { name: e.target.value })}
                            className="w-48 font-medium h-8"
                            placeholder={t('agency.projects.ruleName', 'Nombre de la regla')}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAliasingRule(rule.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 pt-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-500 uppercase">{t('agency.projects.detectBy', 'Detectar por texto')}</Label>
                          <Input
                            value={rule.matchPatterns.join(', ')}
                            onChange={(e) => updateAliasingRule(rule.id, {
                              matchPatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            })}
                            placeholder="Ej: Kit Digital, KD"
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-slate-400">{t('agency.projects.matchNote', 'Si el proyecto contiene alguno de estos términos (insensible a mayúsculas)')}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-500 uppercase">{t('agency.projects.applyPrefix', 'Aplicar prefijo')}</Label>
                          <Input
                            value={rule.displayPrefix}
                            onChange={(e) => updateAliasingRule(rule.id, { displayPrefix: e.target.value })}
                            placeholder="Ej: KD:"
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-slate-400">{t('agency.projects.prefixNote', 'Texto que se añadirá al inicio del nombre del proyecto')}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`virtual-${rule.id}`}
                            checked={rule.groupAsVirtualClient}
                            onCheckedChange={(checked) => updateAliasingRule(rule.id, { groupAsVirtualClient: checked })}
                          />
                          <Label htmlFor={`virtual-${rule.id}`} className="text-sm font-normal cursor-pointer">
                            {t('agency.projects.groupAsClient', 'Agrupar bajo un cliente virtual')}
                          </Label>
                        </div>
                        {rule.groupAsVirtualClient && (
                          <div className="flex items-center gap-2">
                            <Input
                              value={rule.virtualClientName}
                              onChange={(e) => updateAliasingRule(rule.id, { virtualClientName: e.target.value })}
                              placeholder={t('agency.projects.clientName', 'Nombre del cliente')}
                              className="h-7 w-32 text-xs"
                            />
                            <input
                              type="color"
                              value={rule.virtualClientColor}
                              onChange={(e) => updateAliasingRule(rule.id, { virtualClientColor: e.target.value })}
                              className="h-6 w-6 rounded border border-slate-200 cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {projectAliasingRules.length === 0 && (
                    <div className="text-center py-10 border border-dashed rounded-xl bg-slate-50/30">
                      <GitBranch className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm text-slate-500 mb-4">{t('agency.projects.noRules', 'No hay reglas de aliasing configuradas')}</p>
                      <Button variant="outline" onClick={addNewAliasingRule}>
                        {t('agency.projects.addFirst', 'Añadir la primera regla')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-0 space-y-6">
            {/* Integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-blue-600" />
                  {t('agency.integrations.title', 'Integraciones')}
                </CardTitle>
                <CardDescription>
                  {t('agency.integrations.description', 'Enlaces con sistemas externos y cuentas publicitarias. El módulo PPC controla si se muestran las rutas de anuncios. Weekly está en Funcionalidades.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enlaces con sistemas externos */}
                <div className="space-y-3">
                  <div className="space-y-1 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold text-sm text-slate-800">{t('agency.integrations.externalLinksTitle', 'Enlaces con sistemas externos')}</h3>
                    </div>
                    <p className="text-xs text-slate-500 pl-6">{t('agency.integrations.externalLinksDesc', 'Exportación CSV e IDs en perfiles y proyectos para cruzar datos con tu CRM u otro sistema.')}</p>
                  </div>
                  <h4 className="font-medium text-xs text-slate-600 uppercase tracking-wide pl-1">{t('agency.integrations.crm', 'CRM')}</h4>
                  {(() => {
                    const crmPackOn =
                      Boolean(enabledIntegrations.crm_user_id) && Boolean(enabledIntegrations.crm_export);
                    const crmLegacyPartial =
                      Boolean(enabledIntegrations.crm_user_id) && !enabledIntegrations.crm_export;
                    return (
                      <div className="flex items-start justify-between p-4 rounded-lg border bg-white gap-4">
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label htmlFor="crm-pack-switch" className="font-medium text-slate-900">
                              {t('agency.integrations.crmPackTitle', 'Integración CRM (exportación CSV)')}
                            </Label>
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {t('agency.integrations.externalBadge', 'Externo')}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">
                            {t(
                              'agency.integrations.crmPackDescription',
                              'Activa el enlace con tu CRM u otro sistema: cada miembro puede indicar su ID de usuario en su perfil y, en cada proyecto, el ID externo del proyecto. Quien tenga permiso podrá exportar las tareas del mes a CSV (tarea, ID de usuario CRM, ID de proyecto externo y horas).'
                            )}
                          </p>
                          {crmLegacyPartial && (
                            <p className="text-xs text-amber-700 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>
                                {t(
                                  'agency.integrations.crmPackLegacyHint',
                                  'Solo tenías activado el ID de usuario en perfiles. Activa el interruptor para completar la integración (exportación e ID de proyecto en fichas).'
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                        <Switch
                          id="crm-pack-switch"
                          checked={crmPackOn}
                          onCheckedChange={(checked) => {
                            setEnabledIntegrations((prev) => ({
                              ...prev,
                              crm_user_id: checked,
                              crm_export: checked,
                            }));
                          }}
                          className="ml-0 shrink-0"
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Otras integraciones (modo demostración, etc.) */}
                {Object.values(AVAILABLE_INTEGRATIONS).filter(i => i.category === 'other').length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <h3 className="font-semibold text-sm text-slate-700 uppercase">{t('agency.integrations.other', 'Privacidad y demostración')}</h3>
                      </div>
                      {Object.values(AVAILABLE_INTEGRATIONS)
                        .filter(integration => integration.category === 'other')
                        .map(integration => {
                          const isEnabled = enabledIntegrations[integration.id] ?? false;
                          return (
                            <div key={integration.id} className="p-4 rounded-lg border bg-white">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Label className="font-medium text-slate-900">
                                      {t(`agency.integrations.items.${integration.id}.name`, integration.name)}
                                    </Label>
                                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                      {integration.category}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-slate-600">
                                    {t(`agency.integrations.items.${integration.id}.description`, integration.description)}
                                  </p>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    setEnabledIntegrations(prev => ({ ...prev, [integration.id]: checked }));
                                  }}
                                  className="ml-4"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-6 mt-6 pt-6 ">
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-slate-700" />
                      <h3 className="font-semibold text-lg text-slate-900">{t('agency.integrations.adsPlatformsTitle', 'Cuentas publicitarias')}</h3>
                    </div>
                    <p className="text-xs text-slate-500 pl-7">{t('agency.integrations.adsPlatformsDesc', 'OAuth y cuentas Meta / Google Ads. Requiere tener activado el módulo PPC y permisos de rol para ver las pantallas de anuncios.')}</p>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4 bg-slate-50/50 mt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Facebook className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-slate-900">Meta Ads</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('agency.integrations.metaAds.oauthConnection', 'Conexión con Meta (OAuth)')}</Label>
                        {currentAgency?.meta_ads_access_token ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✅ {t('agency.integrations.metaAds.tokenConfigured', 'Token configurado')}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const appId = import.meta.env.VITE_META_APP_ID;
                                if (!appId) {
                                  toast.error(t('agency.integrations.metaAds.envMissingAppId'));
                                  return;
                                }
                                if (!currentAgency?.id) return;
                                const redirectUri = `${window.location.origin}/meta-callback`;
                                const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                sessionStorage.setItem('meta_oauth_state', JSON.stringify({ state, agencyId: currentAgency.id }));
                                const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(META_OAUTH_SCOPES)}&response_type=code`;
                                window.location.href = authUrl;
                              }}
                            >
                              {t('agency.integrations.metaAds.reconnect', 'Re-vincular')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-red-600"
                              onClick={async () => {
                                if (!currentAgency?.id) return;
                                try {
                                  const { metaAccessToken: _mt, ...restInt } = currentAgency.settings?.integrations || {};
                                  const newSettings = {
                                    ...currentAgency.settings,
                                    integrations: { ...restInt },
                                  };
                                  const { error } = await supabase
                                    .from('agencies')
                                    .update({
                                      meta_ads_access_token: null,
                                      updated_at: new Date().toISOString(),
                                      settings: newSettings,
                                    })
                                    .eq('id', currentAgency.id);
                                  if (error) throw error;
                                  await supabase.from('meta_ads_campaigns').delete().eq('agency_id', currentAgency.id);
                                  await refreshAgency();
                                  toast.success(t('agency.integrations.metaAds.disconnectSuccess', 'Meta Ads desvinculado'));
                                  fetchConnectedAccounts();
                                } catch (e: unknown) {
                                  toast.error(e instanceof Error ? e.message : t('common.error', 'Error al desvincular'));
                                }
                              }}
                            >
                              {t('agency.integrations.metaAds.disconnect', 'Desvincular')}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              className="w-full justify-center gap-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900"
                              onClick={() => {
                                const appId = import.meta.env.VITE_META_APP_ID;
                                if (!appId) {
                                  toast.error(t('agency.integrations.metaAds.envMissingAppId'));
                                  return;
                                }
                                if (!currentAgency?.id) {
                                  toast.error(t('agency.integrations.metaAds.missingAgencyContext'));
                                  return;
                                }
                                const redirectUri = `${window.location.origin}/meta-callback`;
                                const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                sessionStorage.setItem('meta_oauth_state', JSON.stringify({ state, agencyId: currentAgency.id }));
                                const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(META_OAUTH_SCOPES)}&response_type=code`;
                                window.location.href = authUrl;
                              }}
                            >
                              🔗 {t('agency.integrations.metaAds.connect', 'Conectar con Meta')}
                            </Button>
                            <p className="text-xs text-slate-500">
                              {t('agency.integrations.metaAds.connectDesc', 'Se abrirá el inicio de sesión de Meta. Tras autorizar, se importarán las cuentas publicitarias disponibles.')}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 flex flex-col justify-start">
                        <Label>{t('agency.integrations.metaAds.importTitle', 'Importar cuentas desde Meta')}</Label>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full md:w-auto"
                          disabled={!currentAgency?.id || !currentAgency?.meta_ads_access_token || syncingMetaAccounts}
                          onClick={async () => {
                            if (!currentAgency?.id) return;
                            setSyncingMetaAccounts(true);
                            try {
                              const response = await invokeEdgeFunctionWithRetry('list-meta-accounts', {
                                agency_id: currentAgency.id,
                                sync_config: true,
                              });
                              const data = response.data as { error?: string; count?: number };
                              const error = response.error;
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              toast.success(t('agency.integrations.metaAds.syncSuccess', { count: data?.count ?? 0 }));
                              await fetchConnectedAccounts();
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : t('common.error', 'Error al listar cuentas'));
                            } finally {
                              setSyncingMetaAccounts(false);
                            }
                          }}
                        >
                          {syncingMetaAccounts ? t('agency.integrations.metaAds.syncing', 'Sincronizando…') : t('agency.integrations.metaAds.importAction', 'Actualizar lista de cuentas')}
                        </Button>
                        <p className="text-xs text-slate-500">{t('agency.integrations.metaAds.importDesc', 'Llama a la API de Meta y registra las cuentas en "Cuentas conectadas".')}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase">{t('agency.integrations.metaAds.connectedAccounts', { count: connectedAccounts.length })}</h4>
                        {connectedAccounts.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">{t('agency.integrations.metaAds.noAccounts', 'No hay cuentas conectadas.')}</p>
                        ) : (
                          <div className="grid gap-2">
                            {connectedAccounts.map(acc => (
                              <div key={acc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Facebook className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{acc.account_name || t('agency.integrations.metaAds.title', 'Cuenta de Anuncios')}</p>
                                    <p className="text-xs font-mono text-slate-500">{acc.account_id}{acc.currency ? ` · ${acc.currency}` : ''}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                  onClick={() => handleRemoveAccount(acc.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Google Ads */}
                  <div className="space-y-4 border rounded-lg p-4 bg-slate-50/50 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold text-slate-900">{t('agency.integrations.googleAds.title', 'Google Ads')}</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="google-customer-id">{t('agency.integrations.googleAds.selectAccount', 'Cuenta de Google Ads')}</Label>
                        {(currentAgency?.google_ads_refresh_token || integrations.googleRefreshToken) && currentAgency?.id ? (
                          <div className="space-y-2">
                            <Select
                              value={currentAgency?.google_ads_customer_id || integrations.googleAdsCustomerId || ''}
                              onValueChange={async (value) => {
                                setIntegrations(prev => ({ ...prev, googleAdsCustomerId: value }));
                                const { error } = await supabase.from('agencies')
                                  .update({ google_ads_customer_id: value })
                                  .eq('id', currentAgency.id!);
                                if (error) {
                                  toast.error(t('common.error', 'Error guardando la cuenta seleccionada'));
                                  return;
                                }
                                await supabase.from('google_ads_campaigns').delete().eq('agency_id', currentAgency.id!);
                                try {
                                  await syncAdAccountCurrenciesFromPlatform(currentAgency.id!, 'google');
                                } catch (e) {
                                  console.warn('sync google currencies tras selección:', e);
                                }
                                await refreshAgency();
                                toast.success(t('agency.integrations.googleAds.updateSuccess', 'Cuenta de Google Ads actualizada. Sincroniza de nuevo para cargar los datos.'));
                              }}
                            >
                              <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder={t('agency.integrations.googleAds.selectAccountPlaceholder', 'Selecciona una cuenta...')} />
                              </SelectTrigger>
                              <SelectContent>
                                <GoogleAdsAccountSelect
                                  agencyId={currentAgency.id}
                                  fetchEnabled={activeTab === 'integrations'}
                                />
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">{t('agency.integrations.googleAds.selectAccountDesc', 'Selecciona la cuenta principal o MCC para sincronizar.')}</p>
                          </div>
                        ) : (currentAgency?.google_ads_refresh_token || integrations.googleRefreshToken) ? (
                          <div className="p-3 border border-dashed rounded bg-slate-100 text-slate-500 text-sm text-center">
                            {t('agency.integrations.googleAds.loading', 'Cargando...')}
                          </div>
                        ) : (
                          <div className="p-3 border border-dashed rounded bg-slate-100 text-slate-500 text-sm text-center">
                            {t('agency.integrations.googleAds.connectFirst', 'Conecta primero con Google para ver tus cuentas disponibles.')}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 flex flex-col justify-center">
                        <Label>{t('agency.integrations.googleAds.connect', 'Conexión con Google Ads')}</Label>
                        {(currentAgency?.google_ads_refresh_token || integrations.googleRefreshToken) ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✅ {t('agency.integrations.googleAds.linked', 'Vinculado')}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                                if (!googleClientId) {
                                  toast.error(t('agency.integrations.googleAds.configError', 'Error de configuración: Falta VITE_GOOGLE_CLIENT_ID en el entorno.'));
                                  return;
                                }
                                if (!currentAgency?.id) return;
                                const redirectUri = window.location.origin + '/google-callback';
                                const scope = 'https://www.googleapis.com/auth/adwords';
                                const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                sessionStorage.setItem('google_oauth_state', JSON.stringify({ state, agencyId: currentAgency.id }));
                                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
                                window.location.href = authUrl;
                              }}
                            >
                              {t('agency.integrations.googleAds.reconnect', 'Re-vincular')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-red-600"
                              onClick={async () => {
                                if (!currentAgency?.id) return;
                                try {
                                  const { googleRefreshToken: _rt, googleAdsCustomerId: _cid, ...restIntegrations } = currentAgency?.settings?.integrations || {};
                                  const newSettings = {
                                    ...currentAgency?.settings,
                                    integrations: { ...restIntegrations }
                                  };
                                  const { error } = await supabase
                                    .from('agencies')
                                    .update({
                                      google_ads_refresh_token: null,
                                      google_ads_customer_id: null,
                                      updated_at: new Date().toISOString(),
                                      settings: newSettings
                                    })
                                    .eq('id', currentAgency.id);
                                  if (error) throw error;
                                  await supabase.from('google_ads_campaigns').delete().eq('agency_id', currentAgency.id);
                                  setIntegrations(prev => ({ ...prev, googleRefreshToken: undefined, googleAdsCustomerId: '' }));
                                  await refreshAgency();
                                  toast.success(t('agency.integrations.googleAds.disconnectSuccess', 'Cuenta de Google Ads desvinculada'));
                                } catch (e: any) {
                                  toast.error(e?.message || t('common.error', 'Error al desvincular'));
                                }
                              }}
                            >
                              {t('agency.integrations.googleAds.disconnect', 'Desvincular')}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              className="w-full justify-center gap-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800"
                              onClick={() => {
                                const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                                if (!googleClientId) {
                                  toast.error(t('agency.integrations.googleAds.configError', 'Error de configuración: Falta VITE_GOOGLE_CLIENT_ID en el entorno.'));
                                  return;
                                }
                                if (!currentAgency?.id) {
                                  toast.error(t('agency.integrations.googleAds.missingAgencyContext'));
                                  return;
                                }
                                const redirectUri = window.location.origin + '/google-callback';
                                const scope = 'https://www.googleapis.com/auth/adwords';
                                const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                sessionStorage.setItem('google_oauth_state', JSON.stringify({ state, agencyId: currentAgency.id }));
                                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
                                window.location.href = authUrl;
                              }}
                            >
                              🔗 {t('agency.integrations.googleAds.connect', 'Conectar con Google')}
                            </Button>
                            <p className="text-xs text-slate-500">
                              {t('agency.integrations.googleAds.connectDesc', 'Se abrirá la pantalla de consentimiento de Google. Al autorizar, podrás seleccionar tu cuenta.')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-0 space-y-6">
            {/* Personalización */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-600" />
                  {t('agency.appearance.title', 'Personalización')}
                </CardTitle>
                <CardDescription>
                  {t('agency.appearance.description', 'Personaliza la apariencia de tu agencia')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">{t('agency.appearance.primaryColor', 'Color Principal')}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primary-color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-32"
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div
                      className="h-10 rounded-lg flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {t('agency.appearance.preview', 'Vista previa')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('agency.notifications.eventsTitle', 'Avisos por dependencias')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'agency.notifications.eventsDescription',
                    'Modelo híbrido: activo por defecto para que nadie pierda el aviso cuando una tarea bloqueante se completa. Puedes desactivarlo aquí para toda la agencia.',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="dependency-unblock-emails">
                      {t(
                        'agency.notifications.dependencyUnblockLabel',
                        'Correo al desbloquear tareas dependientes',
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'agency.notifications.dependencyUnblockHint',
                        'Se envía a quien tenía la tarea completada y a los asignados de las tareas que dependían de ella (si tienen email en su perfil).',
                      )}
                    </p>
                  </div>
                  <Switch
                    id="dependency-unblock-emails"
                    checked={dependencyUnblockEmailsEnabled}
                    onCheckedChange={setDependencyUnblockEmailsEnabled}
                    className="shrink-0"
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  {t('agency.notifications.title', 'Notificaciones por email')}
                </CardTitle>
                <CardDescription>{t('agency.notifications.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationRulesSection ref={notificationRulesRef} agencyId={currentAgency.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 space-y-6">
            <AgencyBillingTab />
          </TabsContent>
        </div>
      </Tabs>

      {/* Botón Flotante de Guardar - Siempre visible */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 lg:left-auto lg:right-6 lg:transform-none">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 p-3 backdrop-blur-sm">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white min-w-[200px] shadow-lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('agency.saving', 'Guardando...')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('agency.saveChanges', 'Guardar Cambios')}
              </>
            )}
          </Button>
        </div>
      </div>
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la cuenta de la configuración. Podrás volver a añadirla más tarde si lo necesitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAccount} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
