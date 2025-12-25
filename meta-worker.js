/* Ejecutar con: node meta-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

const cleanEnv = (val) => val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim() : '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = cleanEnv(process.env.META_ACCESS_TOKEN);
const API_VERSION = 'v19.0';

if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN) { console.error("❌ Faltan claves"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getAccountName(id) {
    try {
        const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${id}?fields=name&access_token=${META_ACCESS_TOKEN}`);
        const data = await res.json();
        return data.name || id;
    } catch { return id; }
}

async function processSyncJob(jobId) {
    const log = async (msg) => {
        const { data } = await supabase.from('meta_sync_logs').select('logs').eq('id', jobId).single();
        await supabase.from('meta_sync_logs').update({ logs: [...(data?.logs||[]), msg].slice(-50) }).eq('id', jobId);
    };

    try {
        await supabase.from('meta_sync_logs').update({ status: 'running' }).eq('id', jobId);
        await log("🚀 Sincronizando Meta ...");

        // 1. Leer cuentas de DB
        const { data: dbAccounts } = await supabase.from('ad_accounts_config').select('account_id').eq('platform', 'meta').eq('is_active', true);
        let ids = dbAccounts?.map(a => a.account_id) || [];
        
        // Fallback al .env si DB está vacía
        if (!ids.length && process.env.META_AD_ACCOUNT_IDS) {
            ids = cleanEnv(process.env.META_AD_ACCOUNT_IDS).split(',').map(i => i.trim());
        }

        if (!ids.length) { await log("⚠️ No hay cuentas configuradas."); return; }

        for (const id of ids) {
            const name = await getAccountName(id);
            await log(`👉 Procesando: ${name}`);
            
            // Actualizar nombre en config
            await supabase.from('ad_accounts_config').update({ account_name: name }).eq('account_id', id);

            // Fetch Insights (Resumido)
            const range = { start: new Date().toISOString().slice(0,8)+'01', end: new Date().toISOString().slice(0,10) };
            const url = `https://graph.facebook.com/${API_VERSION}/${id}/insights?level=campaign&fields=campaign_id,campaign_name,spend,actions,action_values&time_range={'since':'${range.start}','until':'${range.end}'}&access_token=${META_ACCESS_TOKEN}`;
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.data) {
                const upsertData = json.data.map(row => {
                    let conv = 0, val = 0;
                    row.actions?.forEach(a => { if(a.action_type === 'purchase' || a.action_type === 'lead') conv += parseFloat(a.value); });
                    row.action_values?.forEach(a => { if(a.action_type === 'purchase') val += parseFloat(a.value); });
                    
                    return {
                        client_id: id, client_name: name,
                        campaign_id: row.campaign_id, campaign_name: row.campaign_name,
                        status: 'ENABLED', date: range.start,
                        cost: row.spend, conversions: conv, conversions_value: val
                    };
                });
                await supabase.from('meta_ads_campaigns').upsert(upsertData, { onConflict: 'campaign_id, date' });
            }
        }
        await log("🎉 Finalizado.");
        await supabase.from('meta_sync_logs').update({ status: 'completed' }).eq('id', jobId);
    } catch (e) {
        await log(`Error: ${e.message}`);
        await supabase.from('meta_sync_logs').update({ status: 'error' }).eq('id', jobId);
    }
}

supabase.channel('meta-listener').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meta_sync_logs' }, p => {
    if(p.new.status === 'pending') processSyncJob(p.new.id);
}).subscribe();

setInterval(async () => {
    const { data } = await supabase.from('meta_sync_logs').select('id').eq('status', 'pending').limit(1);
    if (data?.length) processSyncJob(data[0].id);
}, 5000);
