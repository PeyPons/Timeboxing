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
  console.log(`📡 Buscando clientes...`);
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

async function getCampaignsDaily(customerId, accessToken) {
  // GAQL MÁGICO: Pedimos segments.date y filtramos los últimos 30 días
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
    WHERE campaign.status = 'ENABLED' 
    AND metrics.cost_micros > 0 -- Solo traemos días con gasto para no llenar la DB de ceros
    AND segments.date DURING LAST_30_DAYS`;

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

  if (!response.ok) return [];

  const data = await response.json();
  const rows = [];
  if (data && Array.isArray(data)) {
    data.forEach(batch => {
      if (batch.results) {
        batch.results.forEach(row => {
          rows.push({
            client_id: customerId,
            campaign_id: row.campaign.id.toString(),
            campaign_name: row.campaign.name,
            status: row.campaign.status,
            date: row.segments.date, // La fecha del dato (ej: 2023-10-25)
            cost: row.metrics ? (parseInt(row.metrics.costMicros) / 1000000) : 0,
            clicks: row.metrics ? parseInt(row.metrics.clicks) : 0,
            impressions: row.metrics ? parseInt(row.metrics.impressions) : 0
          });
        });
      }
    });
  }
  return rows;
}

// Ejecución
try {
  console.log("🚀 INICIANDO SINCRONIZACIÓN DIARIA...");
  const token = await getAccessToken();
  const clients = await getClientAccounts(token);
  console.log(`📋 Clientes: ${clients.length}`);

  let totalRows = 0;
  for (const client of clients) {
    process.stdout.write(`   procesando ${client.name}... `);
    const dailyData = await getCampaignsDaily(client.id, token);
    
    if (dailyData.length > 0) {
      // Añadimos el nombre del cliente a cada fila
      const rowsToInsert = dailyData.map(d => ({ ...d, client_name: client.name }));

      // UPSERT: Si ya existe el dato para ese día/campaña, lo actualiza
      const { error } = await supabase
        .from('google_ads_campaigns')
        .upsert(rowsToInsert, { onConflict: 'campaign_id, date' });
      
      if (!error) {
        console.log(`✅ ${dailyData.length} reg.`);
        totalRows += dailyData.length;
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
    } else {
      console.log(`(sin gasto reciente)`);
    }
  }
  console.log(`\n🎉 FIN. Total registros diarios: ${totalRows}`);

} catch (error) {
  console.error("\n💥 ERROR:", error.message);
}
