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

// --- FUNCIONES GOOGLE ---
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
  
  if (!response.ok) throw new Error(`Error API Clients: ${await response.text()}`);
  
  const data = await response.json();
  const clients = [];
  if (data && Array.isArray(data)) {
    data.forEach(batch => { 
      if (batch.results) { 
        batch.results.forEach(row => { 
          clients.push({ 
            id: row.customerClient.clientCustomer.split('/')[1], 
            name: row.customerClient.descriptiveName 
          }); 
        }); 
      } 
    });
  }
  return clients;
}

async function getAccountLevelSpend(customerId, accessToken) {
  // CAMBIO: Solicitamos desglose por campaña (campaign) filtrando por el mes actual (THIS_MONTH).
  // También pedimos conversions_value para ver si la campaña genera valor.
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      metrics.cost_micros,
      metrics.conversions_value
    FROM campaign 
    WHERE 
      segments.date DURING THIS_MONTH 
      AND metrics.cost_micros > 0`; 
  
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });

  let rows = [];
  
  if (response.ok) {
    const data = await response.json();
    const today = new Date().toISOString().split('T')[0];

    if (data && Array.isArray(data)) {
      data.forEach(batch => { 
        if (batch.results) { 
          batch.results.forEach(row => { 
            rows.push({ 
              client_id: customerId, 
              // ID compuesto para que la campaña sea única por día
              campaign_id: `${row.campaign.id}`, 
              campaign_name: row.campaign.name, 
              status: row.campaign.status, // ENABLED, PAUSED
              date: today, 
              cost: (parseInt(row.metrics.costMicros || '0') / 1000000),
              // Guardamos también el valor de conversion (si existe)
              conversions_value: row.metrics.conversionsValue ? parseFloat(row.metrics.conversionsValue) : 0
            }); 
          }); 
        } 
      });
    }
  } else {
    console.error(`🔴 Error Google API en cliente ${customerId}:`, await response.text());
  }

  // Fallback visual si no hay gasto
  if (rows.length === 0) {
     const today = new Date().toISOString().split('T')[0];
     rows.push({ 
         client_id: customerId, 
         campaign_id: `NO-SPEND-${customerId}`, 
         campaign_name: '(Sin Gasto este mes)', 
         status: 'UNKNOWN', 
         date: today, 
         cost: 0,
         conversions_value: 0
     });
  }
  return rows;
}

// --- WORKER ---
async function processSyncJob(jobId) {
  const log = async (msg) => {
    console.log(`[Job ${jobId}] ${msg}`);
    const { data } = await supabase.from('ad_sync_logs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    await supabase.from('ad_sync_logs').update({ logs: [...currentLogs, msg] }).eq('id', jobId);
  };

  try {
    await supabase.from('ad_sync_logs').update({ status: 'running' }).eq('id', jobId);
    await log(`🚀 Iniciando sincronización detallada (${API_VERSION})...`);
    
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Clientes activos: ${clients.length}`);

    let totalRows = 0;
    for (const [index, client] of clients.entries()) {
      process.stdout.write(`   [${index + 1}/${clients.length}] Procesando ${client.name}... `);
      
      const campaignData = await getAccountLevelSpend(client.id, token);
      
      if (campaignData.length > 0) {
         const totalGasto = campaignData.reduce((sum, c) => sum + c.cost, 0);
         const numCampañas = campaignData.filter(c => c.cost > 0).length;
         
         if (totalGasto > 0) {
            console.log(`✅ ${totalGasto.toFixed(2)}€ (${numCampañas} campañas)`);
         } else {
            console.log(`⚠️ 0€`);
         }

         const rowsToInsert = campaignData.map(d => ({ ...d, client_name: client.name }));
         
         // Upsert basado en campaign_id + date
         const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
         
         if (error) {
            console.error(`❌ Error Supabase: ${error.message}`);
            await log(`❌ Error guardando datos de ${client.name}`);
         } else {
            totalRows += campaignData.length;
         }
      }
    }

    await log(`🎉 FIN. Datos actualizados correctamente.`);
    await supabase.from('ad_sync_logs').update({ status: 'completed' }).eq('id', jobId);

  } catch (err) {
    console.error(err);
    await log(`💥 ERROR FATAL: ${err.message}`);
    await supabase.from('ad_sync_logs').update({ status: 'error' }).eq('id', jobId);
  }
}

// --- ESCUCHA ---
supabase.channel('ads-worker').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ad_sync_logs' }, (payload) => {
    processSyncJob(payload.new.id);
}).subscribe();

// Polling de seguridad
setInterval(async () => {
  const { data } = await supabase.from('ad_sync_logs').select('id').eq('status', 'pending').limit(1);
  if (data?.length) {
    await supabase.from('ad_sync_logs').update({ status: 'queued' }).eq('id', data[0].id);
    processSyncJob(data[0].id);
  }
}, 3000);

console.log(`📡 Worker listo (API: ${API_VERSION}). Esperando trabajos...`);
