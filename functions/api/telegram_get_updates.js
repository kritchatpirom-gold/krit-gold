export async function onRequestPost({ request }) {
  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({ ok: false, description: 'Missing token' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const responseData = await telegramResponse.json();

    return new Response(JSON.stringify(responseData), {
      status: telegramResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, description: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
