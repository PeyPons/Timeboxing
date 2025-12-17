/* Ejecutar con: node sync-ads.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Google Ads Creds
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const MCC_ID = process.env.GOOGLE_MCC_ID;
const API_VERSION = 'v22';

if (!SUPABASE_URL || !SUPABASE_KEY || !CLIENT_ID) {
  console.error("❌ ERROR: Faltan variables en el archivo .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error("Error token Google: " + JSON.stringify(data));
  return data.access_token;
}

async function getClientAccounts(accessToken) {
  console.log(`📡 Buscando clientes en el MCC...`);
  const query = `
    SELECT customer_client.client_customer, customer_client.descriptive_name 
    FROM customer_client 
    WHERE customer_client.status = 'ENABLED' AND customer_client.manager = false`;

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

  if (!response.ok) throw new Error(`Error API: ${await response.text()}`);
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
  // ESTRATEGIA: "Account Level Real"
  // No filtramos por status = 'ENABLED'.
  // Pedimos TODO lo que haya tenido coste (metrics.cost_micros > 0)
  // Esto incluye campañas pausadas o eliminadas que hayan gastado dinero en el periodo.
  
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      segments.date,
      metrics.cost_micros, 
      metrics.clicks, 
      metrics.impressions 
    FROM campaign 
    WHERE 
      segments.date DURING LAST_90_DAYS 
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
              status: row.campaign.status, // Guardamos el estado real (PAUSED, ENABLED, REMOVED)
              date: row.segments.date,
              cost: row.metrics ? (parseInt(row.metrics.costMicros) / 1000000) : 0,
              clicks: row.metrics ? parseInt(row.metrics.clicks) : 0,
              impressions: row.metrics ? parseInt(row.metrics.impressions) : 0
            });
          });
        }
      });
    }
  }

  // Si no hay gasto en 90 días, insertamos una fila dummy HOY con coste 0
  // para que el cliente al menos aparezca en la lista como "activo sin gasto".
  if (rows.length === 0) {
     const today = new Date().toISOString().split('T')[0];
     // Verificamos si la cuenta existe y está viva
     rows.push({
       client_id: customerId,
       campaign_id: 'account-level',
       campaign_name: '(Sin Gasto Reciente)',
       status: 'UNKNOWN',
       date: today,
       cost: 0,
       clicks: 0,
       impressions: 0
     });
  }

  return rows;
}

// Ejecución
try {
  console.log("🚀 INICIANDO SINCRONIZACIÓN (Modo Facturación Real)...");
  
  const token = await getAccessToken();
  const clients = await getClientAccounts(token);
  console.log(`📋 Clientes detectados en MCC: ${clients.length}`);

  let totalRows = 0;
  for (const client of clients) {
    process.stdout.write(`   procesando ${client.name}... `);
    const dailyData = await getAccountLevelSpend(client.id, token);
    
    if (dailyData.length > 0) {
      const rowsToInsert = dailyData.map(d => ({ ...d, client_name: client.name }));

      // Usamos UPSERT para actualizar si ya existe el dato
      const { error } = await supabase
        .from('google_ads_campaigns')
        .upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
      
      if (!error) {
        console.log(`✅ ${dailyData.length} registros.`);
        totalRows += dailyData.length;
      } else {
        console.log(`❌ Error DB: ${error.message}`);
      }
    } else {
      console.log(`(error de lectura)`);
    }
  }
  console.log(`\n🎉 FIN. Base de datos actualizada con ${totalRows} registros.`);

} catch (error) {
  console.error("\n💥 ERROR FATAL:", error.message);
}
