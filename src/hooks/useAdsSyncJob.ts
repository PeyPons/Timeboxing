import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/notify';
import type { AdsPlatform } from '@/utils/adsPacingUtils';

export type AdsSyncJobStatus = 'idle' | 'running' | 'completed' | 'error';

interface AdsSyncLogRow {
  id: string;
  status: string;
  logs?: string[] | null;
}

const PLATFORM_CONFIG = {
  google: {
    logTable: 'ads_sync_logs',
    functionName: 'sync-google-ads',
    channelPrefix: 'google-sync',
    initialLogKey: 'ads.dialogs.sync.initGoogle',
    initialLog: '🚀 Iniciando conexión con Google Ads...',
    pendingLog: 'Esperando worker...',
    startErrorPrefix: '❌ Error al iniciar sincronización:',
  },
  meta: {
    logTable: 'meta_sync_logs',
    functionName: 'sync-meta-ads',
    channelPrefix: 'meta-sync',
    initialLogKey: 'ads.dialogs.sync.initMeta',
    initialLog: '🚀 Conectando con Meta API...',
    pendingLog: 'Iniciando worker...',
    startErrorPrefix: '❌ Error al iniciar:',
  },
} as const;

interface UseAdsSyncJobOptions {
  platform: AdsPlatform;
  agencyId?: string;
  onCompleted: () => void | Promise<void>;
  refreshLastSync: () => void | Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useAdsSyncJob({
  platform,
  agencyId,
  onCompleted,
  refreshLastSync,
}: UseAdsSyncJobOptions) {
  const { t } = useTranslation('app');
  const config = PLATFORM_CONFIG[platform];
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<AdsSyncJobStatus>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledTerminalJobRef = useRef<string | null>(null);

  const startSync = useCallback(async () => {
    if (!agencyId) {
      toast.error(t('common.errorIdentifyingAgency', 'Error: No se ha identificado la agencia actual.'));
      return;
    }

    setIsSyncing(true);
    setSyncStatus('running');
    setSyncLogs([t(config.initialLogKey, config.initialLog)]);
    setSyncProgress(0);
    handledTerminalJobRef.current = null;

    try {
      const { data, error } = await supabase
        .from(config.logTable)
        .insert({
          status: 'pending',
          logs: [config.pendingLog],
          agency_id: agencyId,
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentJobId(data.id);

      const { error: functionError } = await supabase.functions.invoke(config.functionName, {
        body: { job_id: data.id, agency_id: agencyId },
      });
      if (functionError) throw functionError;
    } catch (error) {
      setSyncStatus('error');
      setSyncLogs((previous) => [
        ...previous,
        `${config.startErrorPrefix} ${getErrorMessage(error)}`,
      ]);
      setIsSyncing(false);
    }
  }, [agencyId, config, t]);

  useEffect(() => {
    if (!currentJobId || !isSyncing || !agencyId) return;

    const channel = supabase.channel(`${config.channelPrefix}-${currentJobId}`);
    const cleanup = () => {
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };

    const handleUpdate = (row: AdsSyncLogRow) => {
      if (row.logs) setSyncLogs(row.logs);
      if (row.status !== 'completed' && row.status !== 'error') return;
      if (handledTerminalJobRef.current === currentJobId) return;
      handledTerminalJobRef.current = currentJobId;

      if (row.status === 'completed') {
        setSyncStatus('completed');
        setSyncProgress(100);
        toast.success(t('ads.dialogs.sync.completed', 'Sincronización completada'));
        void onCompleted();
        void refreshLastSync();
        cleanup();
        window.setTimeout(() => {
          setIsSyncing(false);
          setCurrentJobId(null);
        }, 2000);
      } else {
        setSyncStatus('error');
        toast.error(t('ads.dialogs.sync.error', 'Error en el proceso'));
        cleanup();
      }
    };

    const checkStatus = async () => {
      const { data } = await supabase
        .from(config.logTable)
        .select('*')
        .eq('id', currentJobId)
        .eq('agency_id', agencyId)
        .single();
      if (data) handleUpdate(data as AdsSyncLogRow);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: config.logTable,
          filter: `id=eq.${currentJobId}`,
        },
        (payload) => handleUpdate(payload.new as AdsSyncLogRow),
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, 2000);

    return cleanup;
  }, [
    agencyId,
    config,
    currentJobId,
    isSyncing,
    onCompleted,
    refreshLastSync,
    t,
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [syncLogs, isSyncing]);

  return {
    isSyncing,
    setIsSyncing,
    syncLogs,
    syncStatus,
    syncProgress,
    scrollRef,
    startSync,
  };
}
