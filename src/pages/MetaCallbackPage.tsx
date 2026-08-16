import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunctionWithRetry } from '@/lib/invokeEdgeFunction';
import { useAgency } from '@/contexts/AgencyContext';
import { toast } from '@/lib/notify';

export default function MetaCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshAgency } = useAgency();
    const processedRef = useRef(false);
    const { t } = useAppTranslation();

    useEffect(() => {
        const handleCallback = async () => {
            if (processedRef.current) return;
            processedRef.current = true;

            const code = searchParams.get('code');
            const error = searchParams.get('error');
            const errorReason = searchParams.get('error_reason');
            const errorDescription = searchParams.get('error_description');

            if (error) {
                console.error('Error OAuth Meta:', error, errorReason, errorDescription);
                toast.error(
                    error === 'access_denied'
                        ? t('auth.oauth.meta.denied')
                        : t('auth.oauth.meta.genericError', {
                              error: errorDescription || error,
                          })
                );
                navigate('/agency?tab=integrations');
                return;
            }

            if (!code) {
                toast.error(t('auth.oauth.meta.invalidResponse'));
                navigate('/agency?tab=integrations');
                return;
            }

            const stateFromUrl = searchParams.get('state');
            let agencyId: string | null = null;
            try {
                const stored = sessionStorage.getItem('meta_oauth_state');
                if (stored && stateFromUrl) {
                    const { state, agencyId: savedAgencyId } = JSON.parse(stored);
                    if (state === stateFromUrl && savedAgencyId) {
                        agencyId = savedAgencyId;
                        sessionStorage.removeItem('meta_oauth_state');
                    }
                }
            } catch {
                // ignore
            }

            if (!agencyId) {
                toast.error(t('auth.oauth.meta.missingAgency'));
                navigate('/agency?tab=integrations');
                return;
            }

            try {
                const redirectUri = `${window.location.origin}/meta-callback`;
                const { data, error: fnError } = await invokeEdgeFunctionWithRetry('oauth-meta', {
                    code,
                    redirect_uri: redirectUri,
                    agency_id: agencyId,
                });

                if (fnError) throw fnError;
                const metaError =
                    data && typeof data === 'object' && 'error' in data
                        ? data.error
                        : null;
                if (metaError) throw new Error(String(metaError));

                try {
                    const { error: listErr } = await invokeEdgeFunctionWithRetry(
                        'list-meta-accounts',
                        { agency_id: agencyId, sync_config: true },
                        { retries: 2, baseDelayMs: 600 }
                    );
                    if (listErr) console.warn('list-meta-accounts tras OAuth:', listErr);
                } catch (e) {
                    console.warn('list-meta-accounts tras OAuth:', e);
                }

                toast.success(t('auth.oauth.meta.success'));
                await refreshAgency();
                navigate('/agency?tab=integrations');
            } catch (err: unknown) {
                console.error('Error intercambiando token Meta:', err);
                let message =
                    err instanceof Error ? err.message : t('auth.oauth.common.tryAgain');
                if (/name resolution|getaddrinfo/i.test(message)) {
                    message = t('auth.oauth.meta.dnsError');
                }
                toast.error(t('auth.oauth.meta.linkError', { message }));
                navigate('/agency?tab=integrations');
            }
        };

        handleCallback();
    }, [searchParams, navigate, refreshAgency, t]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-slate-600 font-medium mt-4">
                {t('auth.oauth.meta.loadingTitle')}
            </p>
            <p className="text-slate-400 text-sm mt-2">
                {t('auth.oauth.meta.loadingSubtitle')}
            </p>
        </div>
    );
}
