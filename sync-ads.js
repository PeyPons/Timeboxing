/* Ejecutar con: node sync-ads.js */
require('dotenv').config(); 

const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// IMPORTANTE: Usamos la Service Role Key para poder ESCRIBIR sin restricciones
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
  console.error("Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY definido.");
  process.exit(1);
}

// Cliente con superpoderes (Service Role)
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
  if (!data.access_token) throw new Error("Error obteniendo token Google: " + JSON.stringify(data));
  return data.access_token;
}

async function getClientAccounts(accessToken) {
  console.log(`📡 Buscando clientes en MCC ${MCC_ID}...`);
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

async function getCampaigns(customerId, accessToken) {
  // Query corregida para asegurar datos numéricos
  const query = `
    SELECT campaign.id, campaign.name, campaign.status, 
           metrics.cost_micros, metrics.clicks, metrics.impressions 
    FROM campaign 
    WHERE campaign.status = 'ENABLED'`;

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
  const campaigns = [];
  if (data && Array.isArray(data)) {
    data.forEach(batch => {
      if (batch.results) {
        batch.results.forEach(row => {
          campaigns.push({
            client_name: null, 
            client_id: customerId,
            campaign_name: row.campaign.name,
            status: row.campaign.status,
            // Convertir micros a moneda real (dividido por 1 millón)
            cost: row.metrics ? (parseInt(row.metrics.costMicros) / 1000000) : 0,
            clicks: row.metrics ? parseInt(row.metrics.clicks) : 0,
            impressions: row.metrics ? parseInt(row.metrics.impressions) : 0
          });
        });
      }
    });
  }
  return campaigns;
}

(async () => {
  try {
    console.log("🚀 INICIANDO SINCRONIZACIÓN...");
    
    // Check de dotenv
    try { require('dotenv'); } catch { console.log("⚠️ Nota: Asegúrate de tener 'dotenv' instalado."); }

    const token = await getAccessToken();
    console.log("✅ Token Google obtenido.");

    // 1. Limpiar tabla antigua para evitar duplicados
    const { error: delErr } = await supabase.from('google_ads_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
        console.error("❌ Error limpiando DB:", delErr.message);
        console.error("   (Verifica que la tabla exista y tengas permisos)");
        return;
    }
    console.log("🧹 Base de datos limpiada.");

    // 2. Obtener Clientes
    const clients = await getClientAccounts(token);
    console.log(`📋 Clientes encontrados: ${clients.length}`);

    // 3. Procesar y guardar
    let total = 0;
    for (const client of clients) {
      process.stdout.write(`   procesando ${client.name}... `);
      const campaigns = await getCampaigns(client.id, token);
      
      if (campaigns.length > 0) {
        const rows = campaigns.map(c => ({ ...c, client_name: client.name }));
        const { error } = await supabase.from('google_ads_campaigns').insert(rows);
        
        if (!error) {
          console.log(`✅ ${campaigns.length} campañas.`);
          total += campaigns.length;
        } else {
          console.log(`❌ Error Insertando: ${error.message}`);
        }
      } else {
        console.log(`(sin campañas activas)`);
      }
    }
    console.log(`\n🎉 FIN. Total campañas guardadas en Supabase: ${total}`);

  } catch (error) {
    console.error("\n💥 ERROR:", error.message);
  }
})();
