/* Ejecutar con: node meta-worker.js */
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // ¡Nuevo en .env!
const META_AD_ACCOUNT_IDS = process.env.META_AD_ACCOUNT_IDS; // Lista separada por comas: "act_123,act_456"

const API_VERSION = 'v19.0'; // Versión reciente de Graph API

if (!SUPABASE_URL || !SUPABASE_KEY || !META_ACCESS_TOKEN) { 
    console.error("❌ Faltan claves en .env (META_ACCESS_TOKEN o Supabase)"); 
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

    // Formato YYYY-MM-DD para Facebook
    const formatDate = (d) => d.toISOString().split('T')[0];

    return [
        { start: formatDate(prevStart), end: formatDate(prevEnd), label: 'Mes Pasado' },
        { start: formatDate(currentStart), end: formatDate(currentEnd), label: 'Mes Actual' }
    ];
}

// --- FETCH META API ---
async function fetchMetaInsights(adAccountId, dateRange) {
    // Endpoint: Insights a nivel de Campaña
    // Pedimos: Gasto, Impresiones, Clics, Acciones (Conversiones)
    const fields = 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values';
    const url = `https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights?level=campaign&fields=${fields}&time_range={'since':'${dateRange.start}','until':'${dateRange.end}'}&access_token=${META_ACCESS_TOKEN}&limit=500`;

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

// --- PROCESAMIENTO ---
// Facebook devuelve conversiones en una lista "actions". Hay que buscar "purchase", "lead", etc.
function parseMetaMetrics(row) {
    let conv = 0;
    let val = 0;

    // Sumar conversiones relevantes (compras, leads, etc)
    if (row.actions) {
        row.actions.forEach(a => {
            // Ajusta estos keys según lo que consideres "Conversión"
            if (['purchase', 'lead', 'submit_application', 'contact'].includes(a.action_type)) {
                conv += parseFloat(a.value);
            }
        });
    }

    // Sumar valor (Ingresos)
    if (row.action_values) {
        row.action_values.forEach(a => {
            if (a.action_type === 'purchase_roas' || a.action_type === 'omni_purchase') { 
                // A veces Facebook da ROAS directo o valor absoluto, depende de la config.
                // Generalmente buscamos 'purchase' dentro de action_values para el valor monetario.
            }
            // Simplificación: usaremos el valor de 'purchase' si existe
            if (a.action_type === 'purchase') {
                val += parseFloat(a.value);
            }
        });
    }

    return { conv, val };
}

// --- WORKER LOGIC ---
async function runSync() {
    console.log(`🚀 Iniciando Sincronización META (Mensual)...`);
    
    // Obtener lista de cuentas (desde .env o DB)
    // Ejemplo: act_12345678,act_87654321
    const accounts = META_AD_ACCOUNT_IDS.split(',').map(id => id.trim());
    const ranges = getMonthRanges();

    let totalRows = 0;

    for (const accountId of accounts) {
        console.log(`👉 Procesando cuenta: ${accountId}`);
        
        // Obtenemos nombre de la cuenta (Opcional, requiere otra llamada, aquí hardcodeamos o lo sacamos de insights si viene)
        // Para simplificar, usaremos el ID como nombre o lo actualizaremos luego.
        
        for (const range of ranges) {
            const insights = await fetchMetaInsights(accountId, range);
            
            if (insights.length > 0) {
                // Preparamos datos para Supabase
                // IMPORTANTE: Facebook devuelve totales del rango. 
                // Guardaremos con fecha = día 1 del mes del rango para coincidir con la lógica mensual.
                const monthDate = range.start.substring(0, 8) + '01'; // YYYY-MM-01

                const rowsToInsert = insights.map(row => {
                    const metrics = parseMetaMetrics(row);
                    return {
                        client_id: accountId,
                        client_name: `Meta Account ${accountId}`, // Idealmente hacer fetch a /act_ID para sacar el nombre real
                        campaign_id: row.campaign_id,
                        campaign_name: row.campaign_name,
                        status: 'ENABLED', // Insights solo trae data activa, asumimos enabled o activo históricamente
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

    console.log(`🎉 Sincronización META Finalizada. Filas actualizadas: ${totalRows}`);
}

runSync();
