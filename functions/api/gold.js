export async function onRequest(context) {
  try {
    const response = await fetch('https://gold-proxy.benzsnoopdog.workers.dev/', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return new Response(`Error fetching data: ${response.statusText}`, { status: response.status });
    }

    const data = await response.text();

    return new Response(data, {
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
