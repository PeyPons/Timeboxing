import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAgency } from '@/contexts/AgencyContext';
import { toast } from '@/lib/notify';
import {
  Key, Plus, Trash2, Copy, Check, Loader2, Shield, Clock,
  AlertTriangle, Eye, EyeOff, BookOpen, ExternalLink, Terminal, Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { AppTrans, useAppTranslation } from '@/hooks/useAppTranslation';
import { Checkbox } from '@/components/ui/checkbox';
import {
  API_TOKEN_SCOPE_CATALOG,
  API_TOKEN_SCOPE_LABELS,
  type ApiTokenScope,
  normalizeApiTokenScopes,
} from '@/lib/apiTokenScopes';

interface ApiToken {
  id: string;
  agency_id: string;
  name: string;
  permissions: 'readonly' | 'readwrite';
  scopes?: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_BASE = `${SUPABASE_URL}/rest/v1`;

function CopyField({ label, sublabel, value, displayValue, mono = true }: {
  label: string;
  sublabel?: string;
  value: string;
  displayValue?: string;
  mono?: boolean;
}) {
  const { t } = useAppTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t('apiKeys.copySuccess', 'Copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error(t('apiKeys.copyError', 'Error')); }
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        {sublabel && <span className="text-[11px] text-slate-400">{sublabel}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 bg-white border rounded-md px-3 py-2 text-slate-700 truncate ${mono ? 'font-mono text-xs' : 'text-sm'}`}>
          {displayValue || value || '—'}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy} disabled={!value}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const { t, i18n } = useAppTranslation();
  const { currentAgency } = useAgency();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenPermissions, setNewTokenPermissions] = useState<'readonly' | 'readwrite'>('readwrite');
  const [newTokenScopes, setNewTokenScopes] = useState<ApiTokenScope[]>([...API_TOKEN_SCOPE_CATALOG]);
  const [newTokenExpiration, setNewTokenExpiration] = useState<string>('365d');
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';

  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedTokenName, setGeneratedTokenName] = useState('');
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [copiedBearer, setCopiedBearer] = useState(false);

  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!currentAgency?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_tokens')
        .select('id, agency_id, name, permissions, scopes, is_active, last_used_at, created_at, expires_at')
        .eq('agency_id', currentAgency.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTokens(data || []);
    } catch (err) {
      console.error('Error cargando tokens:', err);
      toast.error(t('apiKeys.toastLoadError', 'Error loading API tokens'));
    } finally {
      setLoading(false);
    }
  }, [currentAgency?.id, t]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleCreateToken = async () => {
    if (!currentAgency?.id || !newTokenName.trim()) return;
    try {
      setCreating(true);
      let expiresInDays: number | undefined;
      switch (newTokenExpiration) {
        case '30d': expiresInDays = 30; break;
        case '90d': expiresInDays = 90; break;
        case '365d': expiresInDays = 365; break;
        default: expiresInDays = undefined;
      }
      const scopes = normalizeApiTokenScopes(newTokenScopes);
      if (scopes.length === 0) {
        throw new Error(t('apiKeys.createDialog.scopesRequired', 'Selecciona al menos un recurso.'));
      }
      const { data, error } = await supabase.functions.invoke('generate-api-token', {
        body: {
          agency_id: currentAgency.id,
          name: newTokenName.trim(),
          permissions: newTokenPermissions,
          scopes,
          expires_in_days: expiresInDays,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setShowCreateDialog(false);
      setNewTokenName('');
      setNewTokenPermissions('readwrite');
      setNewTokenScopes([...API_TOKEN_SCOPE_CATALOG]);
      setNewTokenExpiration('never');

      setGeneratedToken(data.token);
      setGeneratedTokenName(data.name);
      setShowBearerToken(false);
      setCopiedBearer(false);

      await fetchTokens();
      toast.success(t('apiKeys.toastCreateSuccess', 'Token "{{name}}" created successfully', { name: data.name }));
    } catch (err: unknown) {
      console.error('Error creando token:', err);
      toast.error(err instanceof Error ? err.message : t('apiKeys.toastCreateError', 'Error creating token'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeToken = async (token: ApiToken) => {
    try {
      setRevoking(token.id);
      const { data, error } = await supabase.functions.invoke('revoke-api-token', {
        body: { token_id: token.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await fetchTokens();
      toast.success(t('apiKeys.toastRevokeSuccess', 'Token "{{name}}" revoked', { name: token.name }));
      setTokenToRevoke(null);
    } catch (err: unknown) {
      console.error('Error revocando token:', err);
      toast.error(err instanceof Error ? err.message : t('apiKeys.toastRevokeError', 'Error revoking token'));
    } finally {
      setRevoking(null);
    }
  };

  const copyBearerToken = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopiedBearer(true);
      toast.success(t('apiKeys.toastBearerCopied', 'Bearer token copied'));
      setTimeout(() => setCopiedBearer(false), 2000);
    } catch { toast.error(t('apiKeys.copyError', 'Error')); }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(i18n.language.startsWith('en') ? 'en-GB' : 'es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getTokenStatus = (token: ApiToken): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (!token.is_active) return { label: t('apiKeys.tokenStatusRevoked', 'Revoked'), variant: 'destructive' as const };
    if (token.expires_at && new Date(token.expires_at) < new Date()) return { label: t('apiKeys.tokenStatusExpired', 'Expired'), variant: 'secondary' as const };
    return { label: t('apiKeys.tokenStatusActive', 'Active'), variant: 'default' as const };
  };

  const activeTokens = tokens.filter(t => t.is_active && (!t.expires_at || new Date(t.expires_at) >= new Date()));
  const inactiveTokens = tokens.filter(t => !t.is_active || (t.expires_at && new Date(t.expires_at) < new Date()));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            {t('apiKeys.pageHeading', 'API & Integrations')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('apiKeys.pageSubtitle', 'Manage access tokens to connect external systems with your agency.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/api-docs">
              <BookOpen className="h-4 w-4 mr-2" />
              {t('apiKeys.docsApi', 'API docs')}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('apiKeys.createToken', 'Create token')}
          </Button>
        </div>
      </div>

      {/* Credenciales de conexión */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {t('apiKeys.connectionCardTitle', 'Connection details for your integrator')}
          </CardTitle>
          <CardDescription>
            {t('apiKeys.connectionCardDesc', 'Share these values with whoever needs API access. The Bearer token is generated below. Agency ID is only needed for inserts (employees, clients, projects).')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyField
            label={t('apiKeys.baseUrl', 'Base URL')}
            value={`${API_BASE}/`}
          />
          <CopyField
            label={t('apiKeys.apikeyHeader', 'apikey header')}
            sublabel={t('apiKeys.apikeySublabel', '(public Supabase key, same for everyone)')}
            value={ANON_KEY}
            displayValue={ANON_KEY ? `${ANON_KEY.slice(0, 30)}...${ANON_KEY.slice(-8)}` : t('apiKeys.notConfigured', 'Not configured')}
          />
          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <Label className="text-xs font-semibold text-slate-700">{t('apiKeys.authHeader', 'Authorization header')}</Label>
              <span className="text-[11px] text-slate-400">{t('apiKeys.authSublabel', '(identifies your agency and filters data)')}</span>
            </div>
            <div className="flex-1 bg-slate-50 border border-dashed rounded-md px-3 py-2.5 text-sm text-slate-500 italic">
              {t('apiKeys.bearerPlaceholder')}
            </div>
          </div>
          <CopyField
            label={t('apiKeys.agencyId', 'Agency ID')}
            sublabel={t('apiKeys.agencyIdSublabel', '(inserts only: employees, clients, projects…; not needed for reads)')}
            value={currentAgency?.id ?? ''}
            displayValue={currentAgency?.id ? `${currentAgency.id.slice(0, 8)}...${currentAgency.id.slice(-4)}` : '—'}
          />
        </CardContent>
      </Card>

      {/* Active tokens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {t('apiKeys.tokensTitle', 'API tokens')}
                {activeTokens.length > 0 && (
                  <Badge variant="secondary">{t('apiKeys.activeCount', '{{count}} active', { count: activeTokens.length, defaultValue: activeTokens.length === 1 ? '{{count}} active' : '{{count}} active' })}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t('apiKeys.tokensDesc', 'Each token is a signed JWT with access to your agency data.')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : activeTokens.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Key className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">{t('apiKeys.noActiveTitle', 'No active tokens')}</p>
              <p className="text-sm mt-1">{t('apiKeys.noActiveDesc', 'Create a token so external systems can access the API.')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('apiKeys.createFirst', 'Create first token')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTokens.map((token) => {
                const status = getTokenStatus(token);
                return (
                  <div key={token.id} className="flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-900">{token.name}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {token.permissions === 'readonly' ? t('apiKeys.readonly') : t('apiKeys.readwrite')}
                        </Badge>
                        {Array.isArray(token.scopes) && token.scopes.length > 0 && (
                          <Badge variant="outline" className="text-xs text-slate-500">
                            {t('apiKeys.scopesCount', '{{count}} recursos', { count: token.scopes.length })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(token.created_at)}
                        </span>
                        {token.expires_at ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t('apiKeys.expires', { date: formatDate(token.expires_at) })}
                          </span>
                        ) : (
                          <span className="text-slate-400">{t('apiKeys.noExpiration')}</span>
                        )}
                      </div>
                      {Array.isArray(token.scopes) && token.scopes.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate" title={token.scopes.join(', ')}>
                          {token.scopes.join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 ml-4"
                      onClick={() => setTokenToRevoke(token)}
                      disabled={revoking === token.id}
                    >
                      {revoking === token.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">{t('apiKeys.revoke', 'Revoke')}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive tokens */}
      {inactiveTokens.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-500 flex items-center gap-2">
              {t('apiKeys.inactiveTitle', 'Inactive tokens')}
              <Badge variant="secondary">{inactiveTokens.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveTokens.map((token) => {
                const status = getTokenStatus(token);
                return (
                  <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-600">{token.name}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Badge variant="outline" className="text-xs text-slate-400">
                          {token.permissions === 'readonly' ? t('apiKeys.readonly') : t('apiKeys.readwrite')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{t('apiKeys.created', 'Created: {{date}}', { date: formatDate(token.created_at) })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guía rápida */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {t('apiKeys.quickGuideTitle', 'Quick guide')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {[
              { step: '1', title: t('apiKeys.quickGuide.step1Title', 'Create a token above'), desc: t('apiKeys.quickGuide.step1Desc', 'Give it a descriptive name (e.g. "CRM", "BI Dashboard"). Copy the JWT.') },
              { step: '2', title: t('apiKeys.quickGuide.step2Title', 'Set up the 3 headers'), desc: t('apiKeys.quickGuide.step2Desc', 'In Postman or another tool, open the Headers tab (not Params) and add: apikey, Authorization and Content-Type.') },
              { step: '3', title: t('apiKeys.quickGuide.step3Title', 'Make requests'), desc: t('apiKeys.quickGuide.step3Desc', 'Data is filtered automatically by your agency via RLS. You do not need to send agency_id.') },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0 mt-0.5">{step}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <div className="text-slate-500 mb-1">{t('apiKeys.curlExampleComment', '# Example: fetch employees')}</div>
            <div><span className="text-emerald-400">curl</span> -X GET \</div>
            <div className="pl-2 text-cyan-300">'{API_BASE}/employees?select=id,name,role' \</div>
            <div className="pl-2">-H <span className="text-amber-300">'apikey: &lt;ANON_KEY&gt;'</span> \</div>
            <div className="pl-2">-H <span className="text-amber-300">'Authorization: Bearer &lt;TU_TOKEN&gt;'</span> \</div>
            <div className="pl-2">-H <span className="text-amber-300">'Content-Type: application/json'</span></div>
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
            <AppTrans
              i18nKey="apiKeys.postmanHint"
              components={{ strong: <strong />, link: <Link to="/api-docs" className="text-primary underline" /> }}
            />
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── DIALOGS ─── */}

      {/* Crear token */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('apiKeys.createDialog.title', 'Crear token API')}</DialogTitle>
            <DialogDescription>
              {t('apiKeys.createDialog.description', 'El token se mostrará una sola vez al crearlo. Guárdalo en un lugar seguro.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="token-name">{t('apiKeys.createDialog.nameLabel', 'Nombre descriptivo')}</Label>
              <Input
                id="token-name"
                placeholder={t('apiKeys.createDialog.namePlaceholder', 'Ej: CRM Sync, Dashboard externo...')}
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('apiKeys.permissions', 'Permissions')}</Label>
              <Select value={newTokenPermissions} onValueChange={(v) => setNewTokenPermissions(v as 'readonly' | 'readwrite')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="readwrite">{t('apiKeys.readwriteOption', 'Read and write')}</SelectItem>
                  <SelectItem value="readonly">{t('apiKeys.readonlyOption', 'Read only')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('apiKeys.createDialog.scopesLabel', 'Recursos permitidos')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setNewTokenScopes([...API_TOKEN_SCOPE_CATALOG])}
                  >
                    {t('apiKeys.createDialog.scopesAll', 'Todos')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setNewTokenScopes([])}
                  >
                    {t('apiKeys.createDialog.scopesNone', 'Ninguno')}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {t(
                  'apiKeys.createDialog.scopesHint',
                  'Principio de mínimo privilegio: solo marca lo que la integración necesita. Blog, Ads, auditoría y tokens quedan siempre fuera.'
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-3 bg-slate-50">
                {API_TOKEN_SCOPE_CATALOG.map((scope) => {
                  const checked = newTokenScopes.includes(scope);
                  const label = API_TOKEN_SCOPE_LABELS[scope][lang];
                  return (
                    <label key={scope} className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setNewTokenScopes((prev) => {
                            if (value === true) {
                              return normalizeApiTokenScopes([...prev, scope]);
                            }
                            return prev.filter((s) => s !== scope);
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-slate-800">{label}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{scope}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('apiKeys.expiration')}</Label>
              <Select value={newTokenExpiration} onValueChange={setNewTokenExpiration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{t('apiKeys.expirationNever')}</SelectItem>
                  <SelectItem value="30d">{t('apiKeys.expiration30d')}</SelectItem>
                  <SelectItem value="90d">{t('apiKeys.expiration90d')}</SelectItem>
                  <SelectItem value="365d">{t('apiKeys.expiration365d')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('apiKeys.createDialog.cancel', 'Cancel')}</Button>
            <Button
              onClick={handleCreateToken}
              disabled={creating || !newTokenName.trim() || newTokenScopes.length === 0}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              {t('apiKeys.createDialog.generate', 'Generate token')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token generado -- toda la info para el integrador */}
      <Dialog open={!!generatedToken} onOpenChange={(open) => { if (!open) { setGeneratedToken(null); setShowBearerToken(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {t('apiKeys.generatedDialog.title', 'Token created: {{name}}', { name: generatedTokenName })}
            </DialogTitle>
            <DialogDescription>
              {t('apiKeys.generatedDialog.description', 'Copy these values and share them with your integrator. The Bearer token is shown only now.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Tabla resumen para copiar */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border">
                <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">{t('apiKeys.generatedDialog.baseUrl', 'Base URL')}</span>
                <span className="flex-1 font-mono text-xs text-slate-700 break-all">{API_BASE}/</span>
                <CopyBtn value={`${API_BASE}/`} />
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border">
                <span className="text-xs font-semibold text-slate-500 w-24 shrink-0"><code className="bg-slate-200 px-1 rounded">apikey</code></span>
                <span className="flex-1 font-mono text-xs text-slate-700 break-all">{ANON_KEY}</span>
                <CopyBtn value={ANON_KEY} />
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
                <span className="text-xs font-semibold text-slate-500 w-24 shrink-0 pt-0.5"><code className="bg-slate-200 px-1 rounded">Authorization</code></span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-slate-700 break-all">
                    {showBearerToken
                      ? `Bearer ${generatedToken}`
                      : `Bearer ${'•'.repeat(40)}`}
                  </span>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => setShowBearerToken(!showBearerToken)} className="p-1 rounded hover:bg-amber-200/50 transition-colors" title={showBearerToken ? t('apiKeys.generatedDialog.hide', 'Hide') : t('apiKeys.generatedDialog.show', 'Show')}>
                    {showBearerToken ? <EyeOff className="h-3.5 w-3.5 text-slate-500" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                  </button>
                  <CopyBtn value={`Bearer ${generatedToken}`} />
                </div>
              </div>
            </div>

            

            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                <AppTrans
                  i18nKey="apiKeys.generatedDialog.bearerWarning"
                  components={{ strong: <strong /> }}
                />
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setGeneratedToken(null); setShowBearerToken(false); }}>
              {t('apiKeys.generatedDialog.close')}
            </Button>
            <Button onClick={copyBearerToken}>
              {copiedBearer ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedBearer ? t('apiKeys.generatedDialog.copied') : t('apiKeys.generatedDialog.copyBearer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar revocación */}
      <AlertDialog open={!!tokenToRevoke} onOpenChange={(open) => { if (!open) setTokenToRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.revokeDialog.title', { name: tokenToRevoke?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('apiKeys.revokeDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('apiKeys.revokeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => tokenToRevoke && handleRevokeToken(tokenToRevoke)} className="bg-red-600 hover:bg-red-700">
              {t('apiKeys.revokeDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const { t } = useAppTranslation();
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setOk(true); toast.success(t('apiKeys.copySuccess', 'Copied')); setTimeout(() => setOk(false), 1500); }
        catch { toast.error(t('apiKeys.copyError', 'Error')); }
      }}
      className="p-1 rounded hover:bg-slate-200 transition-colors"
      title={t('apiKeys.copy', 'Copy')}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
    </button>
  );
}
