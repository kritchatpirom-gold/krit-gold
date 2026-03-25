exports.handler = async function(event, context) {
  try {
    const response = await fetch('https://www.jk-goldtrader.com/api', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Error fetching data: ${response.statusText}`
      };
    }

    const data = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: data
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
