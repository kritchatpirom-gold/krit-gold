export async function onRequestPost({ request }) {
  try {
    const { message, token, chatId } = await request.json();

    if (!message || !token || !chatId) {
      return new Response(JSON.stringify({ ok: false, description: 'กรุณาระบุ Token, Chat ID และข้อความ' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      chat_id: chatId,
      text: message
    };

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

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
