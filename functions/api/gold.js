export async function onRequest(context) {
  try {
    const response = await fetch('https://gold.kritgold.workers.dev', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return new Response(`Error fetching data: ${response.statusText}`, { status: response.status });
    }

    const rawData = await response.json();
    
    // Parse asTime (2026-04-29T17:15:00)
    let date_th = "";
    let time_th = "";
    if (rawData.asTime) {
      const dt = new Date(rawData.asTime);
      date_th = dt.toLocaleDateString('th-TH');
      time_th = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    // Map to frontend structure
    const mappedData = {
      ok: true,
      prices: {
        bar: {
          buy: rawData.bL_BuyPrice,
          sell: rawData.bL_SellPrice
        },
        orn: {
          buy: rawData.oM965_BuyPrice,
          sell: rawData.oM965_SellPrice
        }
      },
      meta: {
        date_th: date_th,
        time_th: time_th,
        round: rawData.seq
      }
    };

    return new Response(JSON.stringify(mappedData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

