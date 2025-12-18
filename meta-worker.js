/* Ejecutar con: node meta-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_IDS = process.env.META_AD_ACCOUNT_IDS;
const API_VERSION = 'v19.0';

if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN) { 
    console.error("❌ Faltan claves en .env"); process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILIDADES ---
function getMonthRanges() {
    const now = new Date();
    // Traemos los últimos 3 meses para tener contexto en las gráficas
    const ranges = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        ranges.push({ 
            start: start.toISOString().split('T')[0], 
            end: end.toISOString().split('T')[0],
            label: `${d.toLocaleString('es-ES', { month: 'long' })}`
        });
    }
    return ranges; // Devuelve [Mes Actual, Mes Pasado, Hace 2 meses]
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
        throw new Error(`Meta API Error: ${err.message}`);
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

// --- LOGICA DEL PROCESO ---
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
        
        const accounts = META_AD_ACCOUNT_IDS.split(',').map(id => id.trim());
        const ranges = getMonthRanges();
        let totalRows = 0;

        for (const accountId of accounts) {
            await log(`👉 Cuenta: ${accountId}`);
            
            for (const range of ranges) {
                try {
                    const insights = await fetchMetaInsights(accountId, range);
                    if (insights.length > 0) {
                        const monthDate = range.start.substring(0, 8) + '01'; 
                        const rowsToInsert = insights.map(row => {
                            const metrics = parseMetaMetrics(row);
                            return {
                                client_id: accountId,
                                client_name: `Cuenta ${accountId}`,
                                campaign_id: row.campaign_id,
                                campaign_name: row.campaign_name,
                                status: 'ENABLED', 
                                date: monthDate,
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
                    await log(`⚠️ Aviso: ${err.message}`);
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

// --- ESCUCHADOR EN TIEMPO REAL ---
supabase.channel('meta-worker-listener')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meta_sync_logs' }, (payload) => {
        if(payload.new.status === 'pending') processSyncJob(payload.new.id);
    })
    .subscribe();

// Polling de seguridad (por si se pierde el evento)
setInterval(async () => {
    const { data } = await supabase.from('meta_sync_logs').select('id').eq('status', 'pending').limit(1);
    if (data?.length) processSyncJob(data[0].id);
}, 5000);

console.log(`📡 Meta Worker v2.0 (Realtime) Listo.`);
