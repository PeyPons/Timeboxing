/* Ejecutar con: node meta-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_IDS = process.env.META_AD_ACCOUNT_IDS;

const API_VERSION = 'v19.0';

if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN || !META_AD_ACCOUNT_IDS) { 
    console.error("❌ Faltan claves en .env (META_ACCESS_TOKEN, META_AD_ACCOUNT_IDS o Supabase)"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILIDADES ---
function getMonthRanges() {
    const now = new Date();
    
    // Mes Actual (YYYY-MM-01 al Hoy)
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Mes Anterior (YYYY-MM-01 al Fin de mes)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const formatDate = (d) => d.toISOString().split('T')[0];

    return [
        { start: formatDate(prevStart), end: formatDate(prevEnd), label: 'Mes Pasado' },
        { start: formatDate(currentStart), end: formatDate(currentEnd), label: 'Mes Actual' }
    ];
}

async function fetchMetaInsights(adAccountId, range) {
    const fields = 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values';
    const url = `https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights?level=campaign&fields=${fields}&time_range={'since':'${range.start}','until':'${range.end}'}&access_token=${META_ACCESS_TOKEN}&limit=500`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            console.error(`🔴 Error Meta API (${adAccountId}):`, data.error.message);
            return [];
        }
        return data.data || [];
    } catch (err) {
        console.error(`💥 Error Red (${adAccountId}):`, err.message);
        return [];
    }
}

// Extraer métricas de arrays "actions"
function parseMetaMetrics(row) {
    let conv = 0;
    let val = 0;

    // Ajusta aquí los eventos que consideras "Conversión"
    const conversionEvents = ['purchase', 'lead', 'submit_application', 'contact', 'schedule', 'subscribe', 'start_trial'];

    if (row.actions) {
        row.actions.forEach(a => {
            if (conversionEvents.includes(a.action_type) || a.action_type.includes('purchase')) {
                conv += parseFloat(a.value);
            }
        });
    }

    if (row.action_values) {
        row.action_values.forEach(a => {
            if (a.action_type === 'purchase' || a.action_type === 'omni_purchase') {
                val += parseFloat(a.value);
            }
        });
    }

    return { conv, val };
}

async function runSync() {
    console.log(`🚀 Iniciando Sincronización META (Mensual)...`);
    const accounts = META_AD_ACCOUNT_IDS.split(',').map(id => id.trim());
    const ranges = getMonthRanges();
    let totalRows = 0;

    for (const accountId of accounts) {
        console.log(`👉 Procesando: ${accountId}`);
        for (const range of ranges) {
            const insights = await fetchMetaInsights(accountId, range);
            
            if (insights.length > 0) {
                // Normalizar fecha al día 1 del mes (YYYY-MM-01)
                const monthDate = range.start.substring(0, 8) + '01'; 

                const rowsToInsert = insights.map(row => {
                    const metrics = parseMetaMetrics(row);
                    return {
                        client_id: accountId,
                        client_name: `Cuenta ${accountId}`, // Meta no da el nombre en insights, se puede mejorar luego
                        campaign_id: row.campaign_id,
                        campaign_name: row.campaign_name,
                        status: 'ENABLED', 
                        date: monthDate,
                        cost: parseFloat(row.spend || 0),
                        impressions: parseInt(row.impressions || 0),
                        clicks: parseInt(row.clicks || 0),
                        conversions: metrics.conv,
                        conversions_value: metrics.val
                    };
                });

                const { error } = await supabase
                    .from('meta_ads_campaigns')
                    .upsert(rowsToInsert, { onConflict: 'campaign_id, date' });

                if (error) console.error(`❌ Error DB: ${error.message}`);
                else totalRows += rowsToInsert.length;
            }
        }
    }
    console.log(`🎉 Finalizado. Filas actualizadas: ${totalRows}`);
}

runSync();
