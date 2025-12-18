/* Ejecutar con: node ads-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

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

// --- UTILIDADES ---

// Rango amplio para métricas (Mes actual + Anterior)
function getDateRange() {
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const pYear = prevMonthDate.getFullYear();
  const pMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const pDay = String(prevMonthDate.getDate()).padStart(2, '0');
  const firstDay = `${pYear}-${pMonth}-${pDay}`;

  const tYear = now.getFullYear();
  const tMonth = String(now.getMonth() + 1).padStart(2, '0');
  const tDay = String(now.getDate()).padStart(2, '0');
  const today = `${tYear}-${tMonth}-${tDay}`;

  return { firstDay, today };
}

// Rango específico para Historial (MÁXIMO 30 DÍAS atrás por limitación de API)
function getHistoryDateRange() {
  const now = new Date();
  const limitDate = new Date();
  limitDate.setDate(now.getDate() - 30); // Restar 30 días exactos

  const lYear = limitDate.getFullYear();
  const lMonth = String(limitDate.getMonth() + 1).padStart(2, '0');
  const lDay = String(limitDate.getDate()).padStart(2, '0');
  const firstDay = `${lYear}-${lMonth}-${lDay}`;

  return { firstDay };
}

// CORREGIDO: Usar camelCase (changeEvent) en lugar de snake_case
function generateChangeId(row) {
    if (!row.changeEvent) return `unknown_${Date.now()}`;
    return `${row.changeEvent.changeDateTime}_${row.changeEvent.resourceName}`.replace(/[^a-zA-Z0-9]/g, '_');
}

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

// --- 1. DATOS DE CAMPAÑAS ---
async function getAccountLevelSpend(customerId, accessToken, dateRange) {
  const queryDaily = `
    SELECT 
      segments.date,
      campaign.id, 
      campaign.name, 
      campaign.status, 
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.conversions_value,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM campaign 
    WHERE 
      segments.date BETWEEN '${dateRange.firstDay}' AND '${dateRange.today}'
      AND metrics.cost_micros > 0`;

  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
      body: JSON.stringify({ query: queryDaily }),
  });

  if (!response.ok) {
      console.error(`🔴 Error Google API Campañas ${customerId}:`, await response.text());
      return [];
  }

  const dataDaily = await response.json();
  let rows = [];

  if (dataDaily && Array.isArray(dataDaily)) {
    dataDaily.forEach(batch => { 
      if (batch.results) { 
        batch.results.forEach(row => { 
          const cost = parseInt(row.metrics.costMicros || '0') / 1000000;
          const budget = row.campaignBudget ? (parseInt(row.campaignBudget.amountMicros || '0') / 1000000) : 0;
           
          rows.push({ 
            client_id: customerId, 
            campaign_id: `${row.campaign.id}`, 
            campaign_name: row.campaign.name, 
            status: row.campaign.status, 
            date: row.segments.date, 
            cost: cost,
            conversions_value: row.metrics.conversionsValue ? parseFloat(row.metrics.conversionsValue) : 0,
            conversions: row.metrics.conversions ? parseFloat(row.metrics.conversions) : 0,
            daily_budget: budget,
            clicks: row.metrics.clicks ? parseInt(row.metrics.clicks) : 0,
            impressions: row.metrics.impressions ? parseInt(row.metrics.impressions) : 0
          }); 
        }); 
      } 
    });
  }
  return rows;
}

// --- 2. HISTORIAL DE CAMBIOS (CORREGIDO) ---
async function getChangeHistory(customerId, accessToken) {
    // Usamos el rango corregido (max 30 días)
    const historyRange = getHistoryDateRange();
    
    const query = `
      SELECT 
        change_event.change_date_time,
        change_event.user_email,
        change_event.change_resource_type,
        change_event.old_resource,
        change_event.new_resource,
        change_event.resource_name,
        change_event.campaign
      FROM 
        change_event 
      WHERE 
        change_event.change_date_time >= '${historyRange.firstDay} 00:00:00'
      ORDER BY 
        change_event.change_date_time DESC
      LIMIT 50`;

    const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        // Ignoramos errores si la cuenta no soporta historial o fecha inválida
        console.warn(`⚠️ Aviso History API ${customerId}:`, await response.text());
        return [];
    }

    const data = await response.json();
    let changes = [];

    if (data && Array.isArray(data)) {
        data.forEach(batch => {
            if (batch.results) {
                batch.results.forEach(row => {
                    // console.log("Row Change Debug:", JSON.stringify(row)); // Descomentar si sigue fallando

                    // Simplificación de detalles
                    let detailText = "Modificación";
                    const ce = row.changeEvent; // Abreviamos
                    
                    if (!ce) return;

                    if(ce.oldResource && ce.newResource) {
                        detailText = "Actualización";
                    } else if (ce.newResource) {
                        detailText = "Creación";
                    } else if (ce.oldResource) {
                        detailText = "Eliminación";
                    }

                    changes.push({
                        id: generateChangeId(row), // Ahora usa la función corregida
                        client_id: customerId,
                        change_date: ce.changeDateTime,
                        user_email: ce.userEmail || 'Sistema',
                        change_type: ce.changeResourceType,
                        campaign_name: ce.campaign || 'N/A', 
                        resource_name: ce.resourceName,
                        details: detailText
                    });
                });
            }
        });
    }
    return changes;
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
    const range = getDateRange(); // Rango normal para métricas
    await log(`🚀 Iniciando Sync v4.1 (Fix Historial).`);
    
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Clientes encontrados: ${clients.length}`);

    let totalCampRows = 0;
    let totalChangeRows = 0;

    for (const [index, client] of clients.entries()) {
      await log(`[${index + 1}/${clients.length}] Procesando ${client.name}...`);
      
      // 1. Obtener Métricas de Campaña (Rango completo)
      const campaignData = await getAccountLevelSpend(client.id, token, range);
      if (campaignData.length > 0) {
         const rowsToInsert = campaignData.map(d => ({ ...d, client_name: client.name }));
         const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
         if (error) console.error(`❌ Error DB Campaigns: ${error.message}`);
         else totalCampRows += campaignData.length;
      }

      // 2. Obtener Historial (Rango restringido a 30 días)
      const historyData = await getChangeHistory(client.id, token);
      if (historyData.length > 0) {
          const { error } = await supabase.from('google_ads_changes').upsert(historyData, { onConflict: 'id' });
          if (error) console.error(`❌ Error DB History: ${error.message}`);
          else totalChangeRows += historyData.length;
      }
    }

    await log(`🎉 FIN. Métricas: ${totalCampRows} | Cambios: ${totalChangeRows}`);
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

console.log(`📡 Worker v4.1 (Corrección Historial) Listo.`);
