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

const API_VERSION = 'v22'; // Versión más reciente

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("❌ Faltan claves en .env"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const today = `${year}-${month}-${day}`;
  return { firstDay, today };
}

// --- GOOGLE AUTH & API ---
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
          clients.push({ id: row.customerClient.clientCustomer.split('/')[1], name: row.customerClient.descriptiveName }); 
        }); 
      } 
    });
  }
  return clients;
}

async function getAccountLevelSpend(customerId, accessToken, dateRange) {
  // SOLICITAMOS PRESUPUESTO Y CONVERSIONES
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.conversions_value,
      metrics.conversions
    FROM campaign 
    WHERE 
      segments.date BETWEEN '${dateRange.firstDay}' AND '${dateRange.today}'
      AND metrics.cost_micros > 0`; 
  
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });

  let rows = [];
  if (response.ok) {
    const data = await response.json();
    const dbDate = dateRange.today;
    if (data && Array.isArray(data)) {
      data.forEach(batch => { 
        if (batch.results) { 
          batch.results.forEach(row => { 
            // Conversión segura de micro-unidades
            const cost = parseInt(row.metrics.costMicros || '0') / 1000000;
            const budget = row.campaignBudget ? (parseInt(row.campaignBudget.amountMicros || '0') / 1000000) : 0;
            
            rows.push({ 
              client_id: customerId, 
              campaign_id: `${row.campaign.id}`, 
              campaign_name: row.campaign.name, 
              status: row.campaign.status, 
              date: dbDate, 
              cost: cost,
              conversions_value: row.metrics.conversionsValue ? parseFloat(row.metrics.conversionsValue) : 0,
              conversions: row.metrics.conversions ? parseFloat(row.metrics.conversions) : 0,
              daily_budget: budget
            }); 
          }); 
        } 
      });
    }
  } else {
    console.error(`🔴 Error Google API en cliente ${customerId}:`, await response.text());
  }
  return rows;
}

// --- WORKER LOGIC ---
async function processSyncJob(jobId) {
  const log = async (msg) => {
    console.log(`[Job ${jobId}] ${msg}`);
    const { data } = await supabase.from('ad_sync_logs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    await supabase.from('ad_sync_logs').update({ logs: [...currentLogs, msg] }).eq('id', jobId);
  };

  try {
    await supabase.from('ad_sync_logs').update({ status: 'running' }).eq('id', jobId);
    const range = getDateRange();
    await log(`🚀 Worker API ${API_VERSION}. Periodo: ${range.firstDay} al ${range.today}`);
    
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Clientes: ${clients.length}`);

    let totalRows = 0;
    for (const [index, client] of clients.entries()) {
      await log(`[${index + 1}/${clients.length}] ${client.name}...`);
      const campaignData = await getAccountLevelSpend(client.id, token, range);
      
      if (campaignData.length > 0) {
         const rowsToInsert = campaignData.map(d => ({ ...d, client_name: client.name }));
         // Upsert con budget y conversions
         const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
         if (error) {
            console.error(`❌ Error DB: ${error.message}`);
         } else {
            totalRows += campaignData.length;
         }
      }
    }
    await log(`🎉 FIN. Procesados ${totalRows} registros.`);
    await supabase.from('ad_sync_logs').update({ status: 'completed' }).eq('id', jobId);

  } catch (err) {
    console.error(err);
    await log(`💥 ERROR FATAL: ${err.message}`);
    await supabase.from('ad_sync_logs').update({ status: 'error' }).eq('id', jobId);
  }
}

supabase.channel('ads-worker').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ad_sync_logs' }, (payload) => {
    processSyncJob(payload.new.id);
}).subscribe();

setInterval(async () => {
  const { data } = await supabase.from('ad_sync_logs').select('id').eq('status', 'pending').limit(1);
  if (data?.length) {
    await supabase.from('ad_sync_logs').update({ status: 'queued' }).eq('id', data[0].id);
    processSyncJob(data[0].id);
  }
}, 3000);

console.log(`📡 Worker listo (API ${API_VERSION}).`);
