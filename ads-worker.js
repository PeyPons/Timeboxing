/* Ejecutar con: node ads-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const MCC_ID = process.env.GOOGLE_MCC_ID;
const API_VERSION = 'v22';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("❌ Faltan claves en .env"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNCIONES GOOGLE (Las mismas de antes) ---
async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error("Error Token Google: " + JSON.stringify(data));
  return data.access_token;
}

async function getClientAccounts(accessToken) {
  const query = `SELECT customer_client.client_customer, customer_client.descriptive_name FROM customer_client WHERE customer_client.status = 'ENABLED' AND customer_client.manager = false`;
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${MCC_ID}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Error API: ${await response.text()}`);
  const data = await response.json();
  const clients = [];
  if (data && Array.isArray(data)) {
    data.forEach(batch => { if (batch.results) { batch.results.forEach(row => { clients.push({ id: row.customerClient.clientCustomer.split('/')[1], name: row.customerClient.descriptiveName }); }); } });
  }
  return clients;
}

async function getAccountLevelSpend(customerId, accessToken) {
  const query = `SELECT campaign.id, campaign.name, campaign.status, segments.date, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_90_DAYS AND metrics.cost_micros > 0`; 
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });
  let rows = [];
  if (response.ok) {
    const data = await response.json();
    if (data && Array.isArray(data)) {
      data.forEach(batch => { if (batch.results) { batch.results.forEach(row => { 
        rows.push({ client_id: customerId, campaign_id: row.campaign.id.toString(), campaign_name: row.campaign.name, status: row.campaign.status, date: row.segments.date, cost: row.metrics ? (parseInt(row.metrics.costMicros) / 1000000) : 0 }); 
      }); } });
    }
  }
  if (rows.length === 0) {
     const today = new Date().toISOString().split('T')[0];
     rows.push({ client_id: customerId, campaign_id: 'account-level', campaign_name: '(Sin Gasto)', status: 'UNKNOWN', date: today, cost: 0 });
  }
  return rows;
}

// --- LÓGICA DE ESCUCHA (LISTENER) ---
async function processSyncJob(jobId) {
  const log = async (msg) => {
    console.log(`[Job ${jobId}] ${msg}`);
    // Añadimos el mensaje al array de logs en Supabase para que la web lo vea
    await supabase.rpc('append_log', { job_id: jobId, new_log: msg }); 
    // NOTA: Si rpc falla (por no crearlo), usamos update normal:
    const { data } = await supabase.from('ad_sync_logs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    await supabase.from('ad_sync_logs').update({ logs: [...currentLogs, msg] }).eq('id', jobId);
  };

  try {
    await supabase.from('ad_sync_logs').update({ status: 'running' }).eq('id', jobId);
    await log("🔄 Iniciando conexión con Google Ads...");
    
    const token = await getAccessToken();
    await log("✅ Token obtenido. Buscando clientes...");
    
    const clients = await getClientAccounts(token);
    await log(`📋 Detectados ${clients.length} clientes.`);

    let totalRows = 0;
    for (const [index, client] of clients.entries()) {
      await log(`Processing (${index + 1}/${clients.length}): ${client.name}...`);
      const dailyData = await getAccountLevelSpend(client.id, token);
      
      if (dailyData.length > 0) {
        const rowsToInsert = dailyData.map(d => ({ ...d, client_name: client.name }));
        const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
        if (error) await log(`❌ Error DB: ${error.message}`);
        else totalRows += dailyData.length;
      }
    }

    await log(`🎉 FIN. ${totalRows} registros actualizados.`);
    await supabase.from('ad_sync_logs').update({ status: 'completed' }).eq('id', jobId);

  } catch (err) {
    await log(`💥 ERROR FATAL: ${err.message}`);
    await supabase.from('ad_sync_logs').update({ status: 'error' }).eq('id', jobId);
  }
}

// --- BUCLE PRINCIPAL ---
console.log("📡 ESCUCHANDO peticiones de actualización desde la web...");

// Suscribirse a nuevos inserts en la tabla de logs
supabase
  .channel('ads-worker')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'ad_sync_logs' },
    (payload) => {
      console.log('🔔 Nueva petición recibida:', payload.new.id);
      processSyncJob(payload.new.id);
    }
  )
  .subscribe();

// Mantener el proceso vivo
setInterval(() => {}, 10000);
