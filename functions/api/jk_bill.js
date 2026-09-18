let memoryToken = null;
let memoryTokenExpiry = 0;

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const reqData = await request.json();
    const { price: rawPrice, weight_baht: rawWeight, lock_id, type } = reqData;

    const weight = Number(rawWeight);

    if (!weight || weight <= 0) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'กรุณาระบุน้ำหนักให้ถูกต้อง' 
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const supabaseUrl = env?.SUPABASE_URL || 'https://cjithgqbtwuxfxrauvax.supabase.co';
    const supabaseKey = env?.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_ANON_KEY || 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';

    // 1. จัดการ Token สำหรับ JK-Gold (auto-login/cache)
    let token = await getValidToken(supabaseUrl, supabaseKey);

    // 2. ดึงและรัน type_id รายวันสำหรับลำดับบิลภายใน
    const dailySeq = await getNextDailyTypeId(supabaseUrl, supabaseKey);

    // 3. ขั้นตอนที่ 1 ของ JK-Gold: ทำการ price-lock ก่อนเสมอ
    let lockRes = await fetch('https://api.jk-gold.com/api/v1/bills/price-lock', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type_id: "15", // รหัสประเภททองคำแท่ง 96.5% ในระบบ JK-Gold
        metal: "gold",
        weight: weight,
        percent: 0
      })
    });

    // กรณี Token หมดอายุกลางทาง (401) ให้ล็อกอินใหม่ 1 ครั้งแล้วลองอีกรอบ
    if (lockRes.status === 401) {
      memoryToken = null;
      memoryTokenExpiry = 0;
      token = await getValidToken(supabaseUrl, supabaseKey, true);
      lockRes = await fetch('https://api.jk-gold.com/api/v1/bills/price-lock', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type_id: "15",
          metal: "gold",
          weight: weight,
          percent: 0
        })
      });
    }

    const lockData = await lockRes.json().catch(() => ({}));
    if (!lockRes.ok || !lockData.success || !lockData.data?.lock_id) {
      return new Response(JSON.stringify({
        ok: false,
        step: 'price-lock',
        error: lockData.message || 'ไม่สามารถล็อกราคาจาก JK-Gold ได้',
        details: lockData
      }), {
        status: lockRes.status || 400,
        headers: corsHeaders
      });
    }

    const jkLockId = lockData.data.lock_id;

    // 4. ขั้นตอนที่ 2 ของ JK-Gold: ส่งคำขอสร้างบิลด้วย lock_id ที่ได้รับมา
    const billRes = await fetch('https://api.jk-gold.com/api/v1/bills', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lock_id: jkLockId
      })
    });

    const billResult = await billRes.json().catch(() => ({}));

    // 5. บันทึกข้อมูลบิลลงในตาราง gold_locks ถ้ามี lock_id
    if (lock_id && supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/gold_locks?id=eq.${lock_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            jk_bill_id: billResult?.data?.id ? String(billResult.data.id) : null,
            jk_bill_code: billResult?.data?.code || null,
            jk_bill_status: billRes.ok && billResult.success ? 'success' : 'failed',
            jk_type_id: String(dailySeq)
          })
        });
      } catch (err) {
        console.warn('Error updating gold_locks with JK bill:', err);
      }
    }

    return new Response(JSON.stringify({
      ok: billRes.ok && billResult.success,
      status: billRes.status,
      type_id: String(dailySeq),
      jk_lock: lockData.data,
      jk_result: billResult
    }), {
      status: billRes.ok ? 200 : billRes.status,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error in jk_bill API:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// ฟังก์ชันดึง Token พร้อมระบบแคชและการล็อกอินอัตโนมัติ
async function getValidToken(supabaseUrl, supabaseKey, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryToken && now < memoryTokenExpiry) {
    return memoryToken;
  }

  // ถ้าไม่ได้บังคับรีเฟรช ลองอ่านจาก Supabase global_settings ดูก่อน
  if (!forceRefresh) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/global_settings?key=eq.jk_gold_token`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const expiry = Number(item.value) || 0;
        if (item.value_text && expiry > (now + 60000)) {
          memoryToken = item.value_text;
          memoryTokenExpiry = expiry;
          return memoryToken;
        }
      }
    } catch (e) {
      console.warn('Could not read jk_gold_token from Supabase:', e);
    }
  }

  // ทำการ Login ใหม่เพื่อรับ Token
  const authRes = await fetch('https://api.jk-gold.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'krit4845@jkgold',
      password: '0801474845'
    })
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    throw new Error(`JK-Gold Login Failed (${authRes.status}): ${errText}`);
  }

  const authData = await authRes.json();
  const token = authData.data?.token || authData.token;
  if (!token) {
    throw new Error('No token found in JK-Gold auth response');
  }

  // Token ปกติมีอายุ 24 ชม. ตั้งแคชไว้ 23 ชม.
  const expiry = now + (23 * 60 * 60 * 1000);
  memoryToken = token;
  memoryTokenExpiry = expiry;

  // บันทึกลง Supabase global_settings
  try {
    await fetch(`${supabaseUrl}/rest/v1/global_settings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        key: 'jk_gold_token',
        value: expiry,
        value_text: token
      })
    });
  } catch (e) {
    console.warn('Could not persist token to Supabase:', e);
  }

  return token;
}

// ฟังก์ชันรัน type_id รายวัน (เริ่มนับ 1 ใหม่ทุกวัน เวลาไทย)
async function getNextDailyTypeId(supabaseUrl, supabaseKey) {
  // วันที่ปัจจุบันในเวลาประเทศไทย (Asia/Bangkok)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()); // รูปแบบ YYYY-MM-DD

  let currentSeq = 0;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/global_settings?key=eq.jk_gold_daily_seq`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      if (item.value_text === todayStr) {
        currentSeq = Number(item.value) || 0;
      } else {
        // วันใหม่ รีเซ็ตเริ่มนับ 1
        currentSeq = 0;
      }
    }
  } catch (e) {
    console.warn('Error reading daily sequence from Supabase:', e);
  }

  const nextSeq = currentSeq + 1;

  // บันทึกลำดับใหม่กลับไปยัง Supabase
  try {
    await fetch(`${supabaseUrl}/rest/v1/global_settings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        key: 'jk_gold_daily_seq',
        value: nextSeq,
        value_text: todayStr
      })
    });
  } catch (e) {
    console.warn('Error updating daily sequence to Supabase:', e);
  }

  return nextSeq;
}
