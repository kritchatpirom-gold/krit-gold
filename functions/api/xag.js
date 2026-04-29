export async function onRequest(context) {
  try {
    const response = await fetch('https://silver.kritgold.workers.dev', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cloud.bowinsgroup.com/'
      }
    });

    if (!response.ok) {
      return new Response(`Error fetching data: ${response.statusText}`, { status: response.status });
    }

    const rawDataArray = await response.json();
    const rawData = rawDataArray[0];

    // Map the new response format to the format expected by the frontend (app.js)
    const mappedData = {
      buy: rawData.buy,
      sell: rawData.sell,
      spot: rawData.rate_spot,
      exchange: rawData.rate_exchange
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

