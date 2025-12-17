async function getAccountLevelSpend(customerId, accessToken) {
  // CAMBIO: Volvemos a 'campaign' para obtener el desglose, 
  // pero mantenemos 'THIS_MONTH' para el control presupuestario.
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      metrics.cost_micros 
    FROM campaign 
    WHERE 
      segments.date DURING THIS_MONTH 
      AND metrics.cost_micros > 0`; 
      // metrics.cost_micros > 0 asegura que solo traemos lo que ha gastado dinero
  
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': DEVELOPER_TOKEN, 'Content-Type': 'application/json', 'login-customer-id': MCC_ID },
    body: JSON.stringify({ query }),
  });

  let rows = [];
  
  if (response.ok) {
    const data = await response.json();
    const today = new Date().toISOString().split('T')[0];

    if (data && Array.isArray(data)) {
      data.forEach(batch => { 
        if (batch.results) { 
          batch.results.forEach(row => { 
            rows.push({ 
              client_id: customerId, 
              // Usamos ID compuesto para que cada campaña sea única por día
              campaign_id: `${row.campaign.id}`, 
              campaign_name: row.campaign.name, 
              status: row.campaign.status, // ENABLED, PAUSED, etc.
              date: today, 
              cost: (parseInt(row.metrics.costMicros || '0') / 1000000)
            }); 
          }); 
        } 
      });
    }
  } else {
    console.error(`🔴 Error Google API en cliente ${customerId}:`, await response.text());
  }

  // Si no hay campañas con gasto, metemos una fila vacía para que no parezca error
  if (rows.length === 0) {
     const today = new Date().toISOString().split('T')[0];
     rows.push({ 
         client_id: customerId, 
         campaign_id: `NO-SPEND-${customerId}`, 
         campaign_name: '(Sin Gasto este mes)', 
         status: 'UNKNOWN', 
         date: today, 
         cost: 0 
     });
  }
  return rows;
}
