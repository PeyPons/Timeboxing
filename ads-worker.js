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
const MCC_ID = process.env.GOOGLE_LOGIN_CUSTOMER_ID; // Usamos el ID de login como MCC principal

// ✅ USANDO VERSIÓN V22
const API_VERSION = 'v22';

if (!SUPABASE_URL || !SUPABASE_KEY || !CLIENT_ID) { 
    console.error("❌ Faltan claves en .env"); process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILIDADES ---

function getDateRange() {
  const now = new Date();
  // Desde el día 1 del mes pasado hasta hoy (para cubrir correcciones de datos recientes)
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const year = prevMonth.getFullYear();
  const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
  const day = String(prevMonth.getDate()).padStart(2, '0');
  
  const firstDay = `${year}-${month}-${day}`;
  const today = new Date().toISOString().split('T')[0];
  
  return { firstDay, today };
}

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 
        client_id: CLIENT_ID, 
        client_secret: CLIENT_SECRET, 
        refresh_token: REFRESH_TOKEN, 
        grant_type: 'refresh_token' 
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error("Error Token Google: " + JSON.stringify(data));
  return data.access_token;
}

// Obtener lista de clientes dentro del MCC
async function getClientAccounts(accessToken) {
  const query = `
    SELECT 
        customer_client.client_customer, 
        customer_client.descriptive_name 
    FROM customer_client 
    WHERE 
        customer_client.status = 'ENABLED' 
        AND customer_client.manager = false`;
  
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${MCC_ID}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'developer-token': DEVELOPER_TOKEN, 
        'Content-Type': 'application/json', 
        'login-customer-id': MCC_ID 
    },
    body: JSON.stringify({ query }),
  });
  
  if (!response.ok) throw new Error(`Error API Clients: ${await response.text()}`);
  
  const data = await response.json();
  const clients = [];
  
  if (data && Array.isArray(data)) {
    data.forEach(batch => { 
      if (batch.results) { 
        batch.results.forEach(row => { 
          // El formato viene como "customers/1234567890", extraemos solo el número
          const id = row.customerClient.clientCustomer.split('/')[1];
          clients.push({ id, name: row.customerClient.descriptiveName }); 
        }); 
      } 
    });
  }
  return clients;
}

// Obtener métricas de campañas de una cuenta específica
async function getAccountData(customerId, accessToken, dateRange) {
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      metrics.cost_micros,
      metrics.conversions_value,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions,
      segments.date
    FROM campaign 
    WHERE 
      segments.date BETWEEN '${dateRange.firstDay}' AND '${dateRange.today}'
      AND metrics.cost_micros > 0`; 
   
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'developer-token': DEVELOPER_TOKEN, 
        'Content-Type': 'application/json', 
        'login-customer-id': MCC_ID 
    },
    body: JSON.stringify({ query }),
  });

  const rows = [];
  if (response.ok) {
    const data = await response.json();
    if (data && Array.isArray(data)) {
      data.forEach(batch => { 
        if (batch.results) { 
          batch.results.forEach(row => { 
            rows.push({ 
              client_id: customerId, 
              // ID de campaña como string para evitar problemas de redondeo en JS
              campaign_id: String(row.campaign.id), 
              campaign_name: row.campaign.name, 
              status: row.campaign.status, 
              // Normalizamos la fecha al primer día del mes (YYYY-MM-01) para agrupar mensualmente en DB
              date: row.segments.date.substring(0, 7) + '-01', 
              
              // Conversión de Micros a moneda real (dividir por 1 millón)
              cost: parseInt(row.metrics.costMicros || '0') / 1000000,
              
              conversions_value: parseFloat(row.metrics.conversionsValue || 0),
              conversions: parseFloat(row.metrics.conversions || 0),
              clicks: parseInt(row.metrics.clicks || 0),
              impressions: parseInt(row.metrics.impressions || 0)
            }); 
          }); 
        } 
      });
    }
  } else {
      // Si la cuenta está cancelada o hay error de permisos, a veces devuelve error. Lo registramos pero no paramos.
      console.warn(`⚠️ Aviso en cuenta ${customerId}: ${response.statusText}`);
  }
  return rows;
}

// --- LÓGICA DEL WORKER ---
async function processSyncJob(jobId) {
  const log = async (msg) => {
    console.log(`[Job ${jobId}] ${msg}`);
    // Actualizamos logs en Supabase para que se vea en el frontend
    const { data } = await supabase.from('ads_sync_logs').select('logs').eq('id', jobId).single();
    const currentLogs = data?.logs || [];
    // Mantenemos solo los últimos 50 mensajes para no llenar la DB
    const newLogs = [...currentLogs, msg].slice(-50);
    await supabase.from('ads_sync_logs').update({ logs: newLogs }).eq('id', jobId);
  };

  try {
    await supabase.from('ads_sync_logs').update({ status: 'running' }).eq('id', jobId);
    
    const range = getDateRange();
    await log(`🚀 Iniciando Sync Google Ads (v22). Datos desde: ${range.firstDay}`);
    
    // 1. Obtener Token y Clientes
    const token = await getAccessToken();
    const clients = await getClientAccounts(token);
    await log(`📋 Cuentas encontradas: ${clients.length}`);

    let totalRows = 0;
    
    // 2. Procesar Cliente a Cliente (Secuencial para buen feedback visual)
    for (const [index, client] of clients.entries()) {
      await log(`[${index + 1}/${clients.length}] Sincronizando: ${client.name}...`);
      
      try {
          const campaignData = await getAccountData(client.id, token, range);
          
          if (campaignData.length > 0) {
             const rowsToInsert = campaignData.map(d => ({ ...d, client_name: client.name }));
             
             // Upsert en la tabla 'ads_campaigns'
             // Requiere restricción UNIQUE en (campaign_id, date)
             const { error } = await supabase.from('ads_campaigns').upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
             
             if (error) console.error(`❌ Error DB ${client.name}: ${error.message}`);
             else totalRows += campaignData.length;
          }
      } catch (err) {
          console.error(`Error procesando cliente ${client.name}:`, err.message);
      }
    }
    
    await log(`🎉 FIN. Total registros procesados: ${totalRows}`);
    await supabase.from('ads_sync_logs').update({ status: 'completed' }).eq('id', jobId);

  } catch (err) {
    console.error(err);
    await log(`💥 ERROR FATAL: ${err.message}`);
    await supabase.from('ads_sync_logs').update({ status: 'error' }).eq('id', jobId);
  }
}

// --- ESCUCHADOR REALTIME ---
supabase.channel('ads-worker-rest-v22')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ads_sync_logs' }, (payload) => {
        if(payload.new.status === 'pending') processSyncJob(payload.new.id);
    })
    .subscribe();

// Polling de seguridad (por si falla el socket)
setInterval(async () => {
  const { data } = await supabase.from('ads_sync_logs').select('id').eq('status', 'pending').limit(1);
  if (data?.length) processSyncJob(data[0].id);
}, 5000);

console.log(`📡 Google Worker v22 (REST Optimized) Listo.`);
