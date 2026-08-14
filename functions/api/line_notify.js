export async function onRequestPost({ request }) {
  try {
    const { message, token, targetId } = await request.json();

    if (!message || !token || !targetId) {
      return new Response(JSON.stringify({ error: 'Missing message, token, or targetId' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      to: targetId,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };

    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await lineResponse.json();

    return new Response(JSON.stringify(responseData), {
      status: lineResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
