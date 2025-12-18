/* Ejecutar con: node meta-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

// Utilitario para limpiar comillas si Docker las inyecta mal
const cleanEnv = (val) => val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim() : '';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = cleanEnv(process.env.META_ACCESS_TOKEN);
const API_VERSION = 'v19.0';

if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN) { 
    console.error("❌ Faltan claves en .env"); process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNCIONES AUXILIARES ---

// Obtener el NOMBRE REAL de la cuenta desde la API de Meta
async function getAccountName(adAccountId) {
    try {
        const url = `https://graph.facebook.com/${API_VERSION}/${adAccountId}?fields=name&access_token=${META_ACCESS_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.name || adAccountId; // Devuelve el nombre o el ID si falla
    } catch (e) {
        return adAccountId;
    }
}

function getMonthRanges() {
    const now = new Date();
    const ranges = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        const dbDate = startStr.substring(0, 8) + '01'; 
        ranges.push({ start: startStr, end: endStr, dbDate });
    }
    return ranges;
}

async function fetchMetaInsights(adAccountId, range) {
    const fields = 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values';
    const url = `https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights?level=campaign&fields=${fields}&time_range={'since':'${range.start}','until':'${range.end}'}&access_token=${META_ACCESS_TOKEN}&limit=500`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.data || [];
    } catch (err) {
        throw new Error(`Meta API: ${err.message}`);
    }
}

function parseMetaMetrics(row) {
    let conv = 0;
    let val = 0;
    const conversionEvents = ['purchase', 'lead', 'submit_application', 'contact', 'schedule', 'subscribe', 'start_trial', 'initiate_checkout'];

    if (row.actions) {
        row.actions.forEach(a => {
            if (conversionEvents.includes(a.action_type) || a.action_type.includes('purchase')) conv += parseFloat(a.value);
        });
    }
    if (row.action_values) {
        row.action_values.forEach(a => {
            if (a.action_type === 'purchase' || a.action_type === 'omni_purchase') val += parseFloat(a.value);
        });
    }
    return { conv, val };
}

// --- LÓGICA PRINCIPAL ---
async function processSyncJob(jobId) {
    const log = async (msg) => {
        console.log(`[Job ${jobId}] ${msg}`);
        const { data } = await supabase.from('meta_sync_logs').select('logs').eq('id', jobId).single();
        const currentLogs = data?.logs || [];
        await supabase.from('meta_sync_logs').update({ logs: [...currentLogs, msg] }).eq('id', jobId);
    };

    try {
        await supabase.from('meta_sync_logs').update({ status: 'running' }).eq('id', jobId);
        await log(`🚀 Iniciando Sync Meta.`);
        
        // 1. INTENTAR LEER CUENTAS DESDE LA BASE DE DATOS (Configuración de Empleados)
        const { data: dbAccounts } = await supabase.from('ad_accounts_config')
            .select('account_id')
            .eq('platform', 'meta')
            .eq('is_active', true);
        
        let accountIds = [];
        
        // Si hay cuentas en DB, las usamos. Si no, fallback al .env
        if (dbAccounts && dbAccounts.length > 0) {
            accountIds = dbAccounts.map(a => a.account_id);
            await log(`📋 Leyendo ${accountIds.length} cuentas desde configuración.`);
        } else {
            const envIds = cleanEnv(process.env.META_AD_ACCOUNT_IDS);
            if (envIds) {
                accountIds = envIds.split(',').map(id => id.trim());
                await log(`⚠️ Usando configuración .env (No hay cuentas en DB).`);
            }
        }

        const ranges = getMonthRanges();
        let totalRows = 0;

        for (const accountId of accountIds) {
            // Obtener nombre real (Empresa S.L.) en lugar de act_12345
            const accountName = await getAccountName(accountId);
            await log(`👉 Cuenta: ${accountName} (${accountId})`);
            
            for (const range of ranges) {
                try {
                    const insights = await fetchMetaInsights(accountId, range);
                    if (insights.length > 0) {
                        const rowsToInsert = insights.map(row => {
                            const metrics = parseMetaMetrics(row);
                            return {
                                client_id: accountId,
                                client_name: accountName, // GUARDAMOS EL NOMBRE REAL
                                campaign_id: row.campaign_id,
                                campaign_name: row.campaign_name,
                                status: 'ENABLED', 
                                date: range.dbDate,
                                cost: parseFloat(row.spend || 0),
                                impressions: parseInt(row.impressions || 0),
                                clicks: parseInt(row.clicks || 0),
                                conversions: metrics.conv,
                                conversions_value: metrics.val
                            };
                        });

                        const { error } = await supabase.from('meta_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
                        if (error) await log(`❌ Error DB: ${error.message}`);
                        else totalRows += rowsToInsert.length;
                    }
                } catch (err) {
                    await log(`⚠️ ${err.message}`);
                }
            }
        }

        await log(`🎉 Finalizado. Datos actualizados: ${totalRows}`);
        await supabase.from('meta_sync_logs').update({ status: 'completed' }).eq('id', jobId);

    } catch (err) {
        console.error(err);
        await log(`💥 ERROR FATAL: ${err.message}`);
        await supabase.from('meta_sync_logs').update({ status: 'error' }).eq('id', jobId);
    }
}

// --- REALTIME LISTENER ---
supabase.channel('meta-worker-listener')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meta_sync_logs' }, (payload) => {
        if(payload.new.status === 'pending') processSyncJob(payload.new.id);
    })
    .subscribe();

// Polling de seguridad
setInterval(async () => {
    const { data } = await supabase.from('meta_sync_logs').select('id').eq('status', 'pending').limit(1);
    if (data?.length) processSyncJob(data[0].id);
}, 5000);

console.log(`📡 Meta Worker v2.2 (DB Accounts + Names) Listo.`);
