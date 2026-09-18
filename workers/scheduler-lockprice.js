export default {
  // 1. ฟังก์ชันนี้จะทำงานเมื่อถูกตั้งเวลา (Cron Trigger) จากระบบของ Cloudflare โดยตรง
  async scheduled(event, env, ctx) {
    await this.processAutoLock(env);
  },

  // 2. ฟังก์ชันนี้ไว้สำหรับทดสอบผ่าน URL (พ่วง ?token=kritgold-auto-lock-secret-2026)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const expectedToken = env.CRON_SECRET || 'kritgold-auto-lock-secret-2026';
    
    if (token !== expectedToken) {
        return new Response('Unauthorized - รหัสผ่านไม่ถูกต้อง', { status: 401 });
    }

    try {
        const result = await this.processAutoLock(env);
        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },

  // 3. โค้ดหลักในการเช็คราคาและล็อค
  async processAutoLock(env) {
    // 3.1 ดึงราคาปัจจุบันจาก API ผ่าน Service Binding (สายตรง ไม่โดน Error 1042)
    if (!env.GOLD_REALTIME) {
        throw new Error('ยังไม่ได้ตั้งค่า Service Binding ที่ชื่อ GOLD_REALTIME ในเมนู Settings');
    }

    // ใช้สายตรงดึงข้อมูล
    const goldRes = await env.GOLD_REALTIME.fetch('https://dummy');
    const goldData = await goldRes.json();
    
    // โครงสร้างของ gold-realtime ตัวใหม่
    const currentBuyPrice = parseFloat(goldData.data.bar_buy);

    if (!currentBuyPrice) {
        throw new Error('Could not parse bar_buy price');
    }

    // 3.2 ดึงข้อมูลตัวแปร Environment Variables ของ Supabase 
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured in Cloudflare Environment Variables');
    }

    // 3.3 ดึงรายการตั้งเป้าหมายที่ยัง Active อยู่จาก Supabase
    const targetsRes = await fetch(`${supabaseUrl}/rest/v1/gold_targets?status=eq.active`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        }
    });
    
    const activeTargets = await targetsRes.json();
    
    if (!Array.isArray(activeTargets)) {
         throw new Error(`Supabase Error: ${JSON.stringify(activeTargets)}`);
    }
    
    let triggeredCount = 0;

    // 3.4 วนลูปตรวจสอบและทำรายการออโต้ล็อค
    for (const target of activeTargets) {
        // ถ้าราคารับซื้อปัจจุบัน >= ราคาเป้าหมาย
        if (currentBuyPrice >= target.target_price) {
            
            const lockPayload = {
                merchant_email: target.merchant_email,
                merchant_name: target.merchant_name,
                type: target.type,
                locked_price: target.target_price,
                weight_baht: target.weight_baht,
                status: 'pending'
            };

            // เพิ่มรายการใหม่ลงใน gold_locks
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/gold_locks`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(lockPayload)
            });

            if (insertRes.ok) {
                // อัปเดตสถานะเป้าหมายเป็น triggered
                await fetch(`${supabaseUrl}/rest/v1/gold_targets?id=eq.${target.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        status: 'triggered',
                        triggered_at: new Date().toISOString()
                    })
                });
                
                // แจ้งเตือน Telegram
                try {
                    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/global_settings?key=in.(telegram_bot_token,telegram_chat_id)`, {
                        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                    });
                    const settings = await settingsRes.json();
                    const botToken = settings.find(s => s.key === 'telegram_bot_token')?.value_text;
                    const chatId = settings.find(s => s.key === 'telegram_chat_id')?.value_text;
                    
                    if (botToken && chatId) {
                        const typeLabel = target.type === 'buy' ? 'รับซื้อ' : (target.type === 'sell' ? 'ขายออก' : target.type);
                        const totalAmount = target.target_price * target.weight_baht;
                        const msg = `⚡️ ออโต้ล็อคทำงาน!\nพ่อค้า ${target.merchant_name} ล็อค${typeLabel}\nราคา: ฿${target.target_price.toLocaleString()}\nน้ำหนัก: ${target.weight_baht} บาททอง\nยอดรวม: ฿${totalAmount.toLocaleString()}`;
                        
                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text: msg })
                        });
                    }
                } catch (e) {
                    console.error('Telegram Notify Error:', e);
                }

                // ยิงบิลไปยัง JK-Gold เมื่อออโต้ล็อคทำงาน
                try {
                    await this.sendJkGoldBill(target, supabaseUrl, supabaseKey, env);
                } catch (e) {
                    console.error('JK-Gold Bill Error in Scheduler:', e);
                }

                triggeredCount++;
            }
        }
    }

    return { success: true, price: currentBuyPrice, triggered: triggeredCount };
  },

  // ฟังก์ชันยิงบิลไปยัง JK-Gold สำหรับ Cloudflare Cron Worker
  async sendJkGoldBill(target, supabaseUrl, supabaseKey, env) {
    const price = Math.round(Number(target.target_price));
    const weight = Number(target.weight_baht);
    if (!price || !weight) return;

    const perGram = Math.round((price / 15.2) * 100) / 100;
    const total = Math.round(price * weight);

    // 1. ดึง Token (แคชใน Supabase global_settings)
    let token = null;
    try {
      const tokenRes = await fetch(`${supabaseUrl}/rest/v1/global_settings?key=eq.jk_gold_token`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const tokenData = await tokenRes.json();
      if (Array.isArray(tokenData) && tokenData[0]?.value_text && Number(tokenData[0]?.value) > Date.now() + 60000) {
        token = tokenData[0].value_text;
      }
    } catch (e) {}

    // ถ้าไม่มี Token หรือหมดอายุ ให้ล็อกอินใหม่
    if (!token) {
      const authRes = await fetch('https://api.jk-gold.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'krit4845@jkgold', password: '0801474845' })
      });
      if (authRes.ok) {
        const authJson = await authRes.json();
        token = authJson.data?.token || authJson.token;
        if (token) {
          const expiry = Date.now() + (23 * 60 * 60 * 1000);
          fetch(`${supabaseUrl}/rest/v1/global_settings`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'jk_gold_token', value: expiry, value_text: token })
          }).catch(() => {});
        }
      }
    }

    if (!token) {
      console.error('JK-Gold Auth Token could not be acquired');
      return;
    }

    // 2. ดึงและรัน type_id รายวัน (เวลาไทย)
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    let currentSeq = 0;
    try {
      const seqRes = await fetch(`${supabaseUrl}/rest/v1/global_settings?key=eq.jk_gold_daily_seq`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const seqData = await seqRes.json();
      if (Array.isArray(seqData) && seqData[0]) {
        if (seqData[0].value_text === todayStr) {
          currentSeq = Number(seqData[0].value) || 0;
        }
      }
    } catch (e) {}

    const nextSeq = currentSeq + 1;
    fetch(`${supabaseUrl}/rest/v1/global_settings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key: 'jk_gold_daily_seq', value: nextSeq, value_text: todayStr })
    }).catch(() => {});

    // 3. ขั้นตอนที่ 1: ขอราคาและล็อกราคา (price-lock) จาก JK-Gold
    let lockRes = await fetch('https://api.jk-gold.com/api/v1/bills/price-lock', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type_id: "15", // ทองคำแท่ง 96.5% ในระบบ JK-Gold
        metal: "gold",
        weight: weight,
        percent: 0
      })
    });

    const lockData = await lockRes.json().catch(() => ({}));
    if (!lockRes.ok || !lockData.success || !lockData.data?.lock_id) {
      console.error('JK-Gold Scheduler Price-Lock Failed:', lockData);
      return;
    }

    const jkLockId = lockData.data.lock_id;

    // 4. ขั้นตอนที่ 2: ส่งคำขอสร้างบิลด้วย lock_id
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
    console.log('JK-Gold Auto-Lock Bill Result:', billResult);
  }
};
