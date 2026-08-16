import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunctionWithRetry } from '@/lib/invokeEdgeFunction';
import { useAgency } from '@/contexts/AgencyContext';
import { toast } from '@/lib/notify';
import {
  Settings, Trash2, Rocket, Facebook, Megaphone, ShieldCheck, Database, AlertTriangle,
} from 'lucide-react';
import { AVAILABLE_INTEGRATIONS } from '@/config/integrations';
import { syncAdAccountCurrenciesFromPlatform } from '@/utils/adAccountCurrencySync';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgencySettings } from '@/types';

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

type IntegrationsState = NonNullable<AgencySettings['integrations']>;

export type AgencyIntegrationsTabProps = {
  fetchAccountsEnabled: boolean;
  enabledIntegrations: Record<string, boolean>;
  setEnabledIntegrations: Dispatch<SetStateAction<Record<string, boolean>>>;
  integrations: IntegrationsState;
  setIntegrations: Dispatch<SetStateAction<IntegrationsState>>;
  connectedAccounts: Array<{ id: string; account_name?: string | null; account_id: string; currency?: string | null }>;
  newAccountId: string;
  setNewAccountId: Dispatch<SetStateAction<string>>;
  isAddingAccount: boolean;
  syncingMetaAccounts: boolean;
  setSyncingMetaAccounts: Dispatch<SetStateAction<boolean>>;
  onAddAccount: () => void | Promise<void>;
  onRemoveAccount: (id: string) => void;
  fetchConnectedAccounts: () => void | Promise<void>;
};

export function AgencyIntegrationsTab({
  fetchAccountsEnabled,
  enabledIntegrations,
  setEnabledIntegrations,
  integrations,
  setIntegrations,
  connectedAccounts,
  newAccountId: _newAccountId,
  setNewAccountId: _setNewAccountId,
  isAddingAccount: _isAddingAccount,
  syncingMetaAccounts,
  setSyncingMetaAccounts,
  onAddAccount: _onAddAccount,
  onRemoveAccount,
  fetchConnectedAccounts,
}: AgencyIntegrationsTabProps) {
  const { t } = useAppTranslation();
  const { currentAgency, refreshAgency } = useAgency();

  return (
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
                          onClick={() => onRemoveAccount(acc.id)}
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
                          fetchEnabled={fetchAccountsEnabled}
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
  );
}
