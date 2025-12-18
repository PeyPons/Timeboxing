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

// Rango: Mes Actual + Mes Anterior (Suficiente para comparar)
function getDateRange() {
  const now = new Date();
  
  // 1 del mes pasado
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pYear = prevMonthDate.getFullYear();
  const pMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const pDay = '01'; 
  const firstDay = `${pYear}-${pMonth}-${pDay}`;

  // Hoy
  const tYear = now.getFullYear();
  const tMonth = String(now.getMonth() + 1).padStart(2, '0');
  const tDay = String(now.getDate()).padStart(2, '0');
  const today = `${tYear}-${tMonth}-${tDay}`;

  return { firstDay, today };
}

// Historial: Últimos 30 días (Límite estricto de Google)
function getHistoryDateRange() {
  const now = new Date();
  
  // Fecha Fin: HOY
  const tYear = now.getFullYear();
  const tMonth = String(now.getMonth() + 1).padStart(2, '0');
  const tDay = String(now.getDate()).padStart(2, '0');
  const today = `${tYear}-${tMonth}-${tDay}`;

  // Fecha Inicio: Hace 30 días
  const limitDate = new Date();
  limitDate.setDate(now.getDate() - 29); 
  const lYear = limitDate.getFullYear();
  const lMonth = String(limitDate.getMonth() + 1).padStart(2, '0');
  const lDay = String(limitDate.getDate()).padStart(2, '0');
  const firstDay = `${lYear}-${lMonth}-${lDay}`;

  return { firstDay, today };
}

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

// --- 1. DATOS MENSUALES (ESTABILIDAD) ---
async function getAccountLevelSpend(customerId, accessToken, dateRange) {
  // CAMBIO CLAVE: Usamos segments.month en lugar de segments.date
  // Esto devuelve 1 sola fila por campaña y mes (acumulado).
  const queryMonthly = `
    SELECT 
      segments.month,
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
      body: JSON.stringify({ query: queryMonthly }),
  });

  if (!response.ok) {
      console.error(`🔴 Error Campañas ${customerId}:`, await response.text());
      return [];
  }

  const data = await response.json();
  let rows = [];

  if (data && Array.isArray(data)) {
    data.forEach(batch => { 
      if (batch.results) { 
        batch.results.forEach(row => { 
          const cost = parseInt(row.metrics.costMicros || '0') / 1000000;
          const budget = row.campaignBudget ? (parseInt(row.campaignBudget.amountMicros || '0') / 1000000) : 0;
           
          rows.push({ 
            client_id: customerId, 
            campaign_id: `${row.campaign.id}`, 
            campaign_name: row.campaign.name, 
            status: row.campaign.status, 
            // segments.month devuelve el primer día del mes (ej: 2023-10-01)
            date: row.segments.month, 
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

// --- 2. HISTORIAL DE CAMBIOS (Mantenemos el fix v4.2) ---
async function getChangeHistory(customerId, accessToken) {
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
        change_event.change_date_time BETWEEN '${historyRange.firstDay} 00:00:00' AND '${historyRange.today} 23:59:59'
      ORDER BY 
        change_event.change_date_time DESC
      LIMIT 50`;

    const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        // Silenciamos errores comunes de historial
        return [];
    }

    const data = await response.json();
    let changes = [];

    if (data && Array.isArray(data)) {
        data.forEach(batch => {
            if (batch.results) {
                batch.results.forEach(row => {
                    let detailText = "Modificación";
                    const ce = row.changeEvent; 
                    if (!ce) return;

                    if(ce.oldResource && ce.newResource) {
                        detailText = "Actualización";
                    } else if (ce.newResource) {
                        detailText = "Creación";
                    } else if (ce.oldResource) {
                        detailText = "Eliminación";
                    }

                    changes.push({
                        id: generateChangeId(row),
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
    const range = getDateRange(); 
    await log(`🚀 Iniciando Sync v5.0 (Modo Mensual).`);
    
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Clientes: ${clients.length}`);

    let totalCampRows = 0;
    let totalChangeRows = 0;

    for (const [index, client] of clients.entries()) {
      // Log cada 5 clientes para no saturar la consola/DB
      if (index % 5 === 0) await log(`[${index + 1}/${clients.length}] Procesando lote...`);
      
      // 1. Métricas Mensuales
      const campaignData = await getAccountLevelSpend(client.id, token, range);
      if (campaignData.length > 0) {
         const rowsToInsert = campaignData.map(d => ({ ...d, client_name: client.name }));
         // Upsert funciona igual porque la fecha será "YYYY-MM-01" siempre
         const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
         if (error) console.error(`❌ DB Error: ${error.message}`);
         else totalCampRows += campaignData.length;
      }

      // 2. Historial (Opcional: Si tarda mucho, coméntalo)
      const historyData = await getChangeHistory(client.id, token);
      if (historyData.length > 0) {
          const { error } = await supabase.from('google_ads_changes').upsert(historyData, { onConflict: 'id' });
          if (!error) totalChangeRows += historyData.length;
      }
    }

    await log(`🎉 FIN. Filas Mensuales: ${totalCampRows} | Cambios: ${totalChangeRows}`);
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

console.log(`📡 Worker v5.0 (Mensual Estable) Listo.`);
