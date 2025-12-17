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

// ACTUALIZADO: Usamos la versión v22 (Última versión estable)
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
  // NOTA: En v18/v22 NO debemos pedir métricas aquí, solo la estructura.
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
          // Parseamos el resource name 'customers/1234567890' -> '1234567890'
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
  // Consulta de métricas a nivel de campaña
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      segments.date, 
      metrics.cost_micros 
    FROM campaign 
    WHERE 
      segments.date DURING LAST_90_DAYS 
      AND metrics.cost_micros > 0`; 
  
  // IMPORTANTE: Aquí la URL cambia para apuntar al cliente específico (${customerId}), 
  // pero seguimos usando el MCC como 'login-customer-id' para la autorización.
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });

  let rows = [];
  
  if (response.ok) {
    const data = await response.json();
    if (data && Array.isArray(data)) {
      data.forEach(batch => { 
        if (batch.results) { 
          batch.results.forEach(row => { 
            rows.push({ 
              client_id: customerId, 
              campaign_id: row.campaign.id.toString(), 
              campaign_name: row.campaign.name, 
              status: row.campaign.status, 
              date: row.segments.date, 
              // Convertimos micros a moneda real
              cost: row.metrics ? (parseInt(row.metrics.costMicros) / 1000000) : 0 
            }); 
          }); 
        } 
      });
    }
  } else {
    console.error(`🔴 Error Google API en cliente ${customerId}:`, await response.text());
  }

  // Fallback: Si no hay gasto, insertamos una fila vacía para que conste que se revisó
  if (rows.length === 0) {
     const today = new Date().toISOString().split('T')[0];
     rows.push({ client_id: customerId, campaign_id: `account-level-${customerId}`, campaign_name: '(Sin Gasto Reciente)', status: 'UNKNOWN', date: today, cost: 0 });
  }
  return rows;
}

// --- WORKER ---
async function processSyncJob(jobId) {
  const log = async (msg) => {
    console.log(`[Job ${jobId}] ${msg}`);
    // Leemos logs actuales para hacer append (simple pero efectivo)
    const { data } = await supabase.from('ad_sync_logs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    await supabase.from('ad_sync_logs').update({ logs: [...currentLogs, msg] }).eq('id', jobId);
  };

  try {
    await supabase.from('ad_sync_logs').update({ status: 'running' }).eq('id', jobId);
    await log(`🚀 Iniciando sincronización (${API_VERSION})...`);
    
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Clientes encontrados: ${clients.length}`);

    let totalRows = 0;
    for (const [index, client] of clients.entries()) {
      process.stdout.write(`   [${index + 1}/${clients.length}] Procesando ${client.name}... `);
      
      const dailyData = await getAccountLevelSpend(client.id, token);
      
      if (dailyData.length > 0) {
         if (dailyData[0].cost === 0 && dailyData[0].campaign_name === '(Sin Gasto Reciente)') {
            console.log("⚠️ 0€");
         } else {
            console.log(`✅ ${dailyData.length} registros.`);
         }

         const rowsToInsert = dailyData.map(d => ({ ...d, client_name: client.name }));
         
         const { error } = await supabase.from('google_ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
         
         if (error) {
            console.error(`❌ Error Supabase: ${error.message}`);
            await log(`❌ Error guardando datos de ${client.name}`);
         } else {
            totalRows += dailyData.length;
         }
      }
    }

    await log(`🎉 FIN. ${totalRows} filas actualizadas/insertadas.`);
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

// Polling de seguridad (por si se pierde el evento de websocket)
setInterval(async () => {
  const { data } = await supabase.from('ad_sync_logs').select('id').eq('status', 'pending').limit(1);
  if (data?.length) {
    await supabase.from('ad_sync_logs').update({ status: 'queued' }).eq('id', data[0].id);
    processSyncJob(data[0].id);
  }
}, 3000);

console.log(`📡 Worker listo (API: ${API_VERSION}). Esperando trabajos...`);
