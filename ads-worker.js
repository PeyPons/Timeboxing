/* Ejecutar con: node ads-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsApi } from 'google-ads-api';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_LOGIN_CUSTOMER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !CLIENT_ID) {
    console.error("❌ Faltan claves en .env"); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const client = new GoogleAdsApi({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, developer_token: DEVELOPER_TOKEN });

async function processSyncJob(jobId) {
    const log = async (msg) => {
        // Logueamos y mantenemos historial
        const { data } = await supabase.from('ads_sync_logs').select('logs').eq('id', jobId).single();
        const currentLogs = data?.logs || [];
        await supabase.from('ads_sync_logs').update({ logs: [...currentLogs, msg].slice(-50) }).eq('id', jobId);
    };

    try {
        await supabase.from('ads_sync_logs').update({ status: 'running' }).eq('id', jobId);
        await log("🚀 Conectando con Google Ads...");

        const customer = client.Customer({
            customer_id: LOGIN_CUSTOMER_ID,
            refresh_token: REFRESH_TOKEN,
            login_customer_id: LOGIN_CUSTOMER_ID,
        });

        const customerIds = await customer.listAccessibleCustomers();
        await log(`📋 Cuentas encontradas: ${customerIds.length}`);

        // PROCESAMIENTO UNO A UNO (Sin lotes)
        for (const cid of customerIds) {
            const cleanId = cid.replace('customers/', '');
            
            try {
                const accountClient = client.Customer({
                    customer_id: cleanId,
                    refresh_token: REFRESH_TOKEN,
                    login_customer_id: LOGIN_CUSTOMER_ID,
                });

                // Obtener nombre
                const info = await accountClient.query(`SELECT customer.descriptive_name FROM customer LIMIT 1`);
                const name = info[0]?.customer?.descriptive_name || cleanId;
                
                await log(`👉 Sincronizando: ${name}...`);

                // Obtener datos
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                const end = new Date().toISOString().split('T')[0];

                const rows = await accountClient.query(`
                    SELECT campaign.id, campaign.name, campaign.status, 
                           metrics.cost_micros, metrics.conversions, metrics.conversions_value, segments.date 
                    FROM campaign 
                    WHERE segments.date BETWEEN '${start}' AND '${end}'
                `);

                if (rows.length) {
                    const upsertData = rows.map(r => ({
                        client_id: cleanId, client_name: name,
                        campaign_id: r.campaign.id.toString(), campaign_name: r.campaign.name,
                        status: r.campaign.status, date: r.segments.date.substring(0, 7) + '-01',
                        cost: r.metrics.cost_micros / 1000000,
                        conversions: r.metrics.conversions, conversions_value: r.metrics.conversions_value
                    }));
                    await supabase.from('ads_campaigns').upsert(upsertData, { onConflict: 'campaign_id, date' });
                }
            } catch (e) { /* Ignorar errores de cuentas canceladas */ }
        }

        await log("🎉 Finalizado correctamente.");
        await supabase.from('ads_sync_logs').update({ status: 'completed' }).eq('id', jobId);

    } catch (err) {
        await log(`💥 Error: ${err.message}`);
        await supabase.from('ads_sync_logs').update({ status: 'error' }).eq('id', jobId);
    }
}

supabase.channel('ads-listener').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ads_sync_logs' }, p => {
    if(p.new.status === 'pending') processSyncJob(p.new.id);
}).subscribe();

// Polling backup
setInterval(async () => {
    const { data } = await supabase.from('ads_sync_logs').select('id').eq('status', 'pending').limit(1);
    if (data?.length) processSyncJob(data[0].id);
}, 5000);
