const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const supabaseUrl = 'https://cjithgqbtwuxfxrauvax.supabase.co';
const supabaseKey = 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';
//const supabaseUrl = 'http://127.0.0.1:54321';
//const supabaseUrl = 'http://192.168.1.104:54321';
//const supabaseKey = '850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Robust truncation helper to skip floating-point binary gaps (like .42999... becoming .43)
const floor2 = (v) => {
    if (v === null || v === undefined) return 0;
    const s = Number(v).toFixed(4); // Rounds to 4th decimal to clean ghost bits
    return Number(s.slice(0, -2)); // Truncates to 2nd decimal
};

createApp({
    setup() {
        const currentTab = ref('home');
        const user = ref(null);
        const showAuth = ref(false);
        const authForm = ref({ email: '', password: '' });
        const authError = ref('');
        const authLoading = ref(false);
        const mobileMenuOpen = ref(false);
        const lastSignature = ref(null);
        const productPhoto = ref(null);
        const viewingPhoto = ref(null);
        let signaturePad = null;

        // Roles
        const isAdmin = computed(() => user.value && user.value.email === 'admin@kritgold.com');
        const isEmployee = computed(() => user.value && user.value.email === 'user@kritgold.com');
        const isLoggedIn = computed(() => user.value !== null);

        // Prices & Chart
        const goldPriceAsk = ref(0);
        const goldPriceBid = ref(0);
        const goldPrice = ref(0); // Using Bar Buy as calculation base
        const goldOrnBuy = ref(0);
        const goldOrnSell = ref(0);
        const goldPriceMeta = ref({ date_th: '', time_th: '', round: '' });

        const silverPriceSell = ref(0);
        const silverPriceBuy = ref(0);
        const silverPriceSpot = ref(0);
        const silverPriceExchange = ref(0);
        const silverPrice = ref(0); // Reference for calc

        const priceTrendGold = ref(0);
        const priceTrendSilver = ref(0);
        let priceChart = null;

        // DB Data
        const premiums = ref([
            { id: 1, range_min: 0, range_max: 29, premium_amount: 0, label: '<30%' },
            { id: 2, range_min: 30, range_max: 49, premium_amount: 0, label: '30-49%' },
            { id: 3, range_min: 50, range_max: 69, premium_amount: 0, label: '50-69%' },
            { id: 4, range_min: 70, range_max: 98, premium_amount: 0, label: '70-98%' },
            { id: 5, range_min: 99, range_max: 100, premium_amount: 0, label: '99%' }
        ]);
        const loadingPremiums = ref(false);
        const saving = ref(false);

        // Transactions & Filter
        const transactions = ref([]);
        const loadingTransactions = ref(false);
        const filter = ref({
            startDate: new Date().toLocaleDateString('en-CA'),
            startTime: '00:00',
            endDate: new Date().toLocaleDateString('en-CA'),
            endTime: '23:59',
            type: ['tong_lom', 'tong_roop', 'tong_tang', 'silver', 'redeem'],
            search: '',
            purityRange: [] // Multi-select array
        });

        const isFilterActive = computed(() => {
            const today = new Date().toLocaleDateString('en-CA');
            return filter.value.startDate !== today ||
                filter.value.endDate !== today ||
                filter.value.startTime !== '00:00' ||
                filter.value.endTime !== '23:59' ||
                filter.value.type.length !== 5 ||
                filter.value.search !== '' ||
                filter.value.purityRange.length > 0;
        });

        const selectedTransactions = ref([]);

        const isAllSelected = computed(() => {
            return transactions.value.length > 0 && selectedTransactions.value.length === transactions.value.length;
        });

        const togglePurity = (range) => {
            const idx = filter.value.purityRange.indexOf(range);
            if (idx > -1) {
                filter.value.purityRange.splice(idx, 1);
            } else {
                filter.value.purityRange.push(range);
            }
        };

        const setDatePreset = (preset) => {
            const now = new Date();
            let start = new Date();
            let end = new Date();

            if (preset === 'today') {
                // Default is today/today
            } else if (preset === 'yesterday') {
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
            } else if (preset === 'week') {
                const day = now.getDay(); // 0 = Sun
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
                start.setDate(diff);
                // end remains today
            } else if (preset === 'month') {
                start.setDate(1); // 1st of current month
                // end remains today
            }

            filter.value.startDate = start.toLocaleDateString('en-CA');
            filter.value.endDate = end.toLocaleDateString('en-CA');
            filter.value.startTime = '00:00';
            filter.value.endTime = '23:59';

            loadTransactions();
        };

        const toggleSelectAll = () => {
            if (isAllSelected.value) {
                selectedTransactions.value = [];
            } else {
                selectedTransactions.value = transactions.value.map(t => t.id);
            }
        };

        // Bill / Cart System
        const billItems = ref([]);

        // Calculator Form
        const calcForm = ref({
            type: 'tong_lom',
            weight: null,
            percent: null,
            customerName: '',
            phone: '',
            idCard: '',
            manualPrice: null
        });

        const resetForm = () => {
            calcForm.value = {
                type: 'tong_lom',
                weight: null,
                percent: null,
                customerName: '',
                phone: '',
                idCard: '',
                manualPrice: null
            };
        };

        const isPhoneValid = computed(() => {
            return /^0[0-9]{9}$/.test(calcForm.value.phone);
        });

        const isIdCardValid = computed(() => {
            let id = calcForm.value.idCard;
            if (!id || id.length !== 13 || !/^\d{13}$/.test(id)) return false;
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseFloat(id.charAt(i)) * (13 - i);
            }
            let checkSum = (11 - (sum % 11)) % 10;
            return checkSum === parseFloat(id.charAt(12));
        });

        const isFormValid = computed(() => {
            let baseValid = false;
            if (calcForm.value.type === 'tong_roop' || calcForm.value.type === 'redeem') {
                baseValid = calcForm.value.weight > 0;
            } else {
                baseValid = calcForm.value.weight > 0 && calcForm.value.percent !== null;
            }

            if (isLoggedIn.value) {
                return baseValid && isIdCardValid.value && calcForm.value.customerName.trim().length > 1;
            }
            return baseValid;
        });

        const currentAssetPrice = computed(() => {
            if (calcForm.value.type === 'tong_lom' || calcForm.value.type === 'tong_roop' || calcForm.value.type === 'tong_tang' || calcForm.value.type === 'redeem') {
                return Number(goldPrice.value) || 0;
            } else if (calcForm.value.type === 'silver') {
                return Math.floor((Number(silverPrice.value) || 0) * 0.87);
            }
            return 0;
        });

        watch(() => calcForm.value.type, () => {
            calcForm.value.manualPrice = currentAssetPrice.value;
        });

        watch(currentAssetPrice, (newVal) => {
            if (!calcForm.value.manualPrice || calcForm.value.manualPrice === 0) {
                calcForm.value.manualPrice = newVal;
            }
        });

        const calculatedResult = computed(() => {
            let base = 0;
            let premium = 0;
            let net = 0;

            const tForm = calcForm.value;
            const w = Number(tForm.weight) || 0;
            const p = Number(tForm.percent) || 0;
            const refPrice = Number(tForm.manualPrice) > 0 ? Number(tForm.manualPrice) : currentAssetPrice.value;

            const gp = Math.floor(refPrice);
            const sp = Math.floor(refPrice);

            if (tForm.type === 'tong_lom') {
                base = gp;
                let activePremium = premiums.value.find(pr => p >= pr.range_min && p <= pr.range_max);
                // ทองหลอมถ้าน้ำหนักน้อยกว่า 5 กรัม ไม่บวกพรีเมียม
                premium = (activePremium && w >= 5) ? Number(activePremium.premium_amount) : 0;
                const perGram = floor2((base + premium) * 0.0656);
                const withPurity = floor2(perGram * (p / 100));
                net = floor2(withPurity * w);
            } else if (tForm.type === 'tong_roop') {
                base = gp;
                const baseAfterPercent = floor2(base * 0.96);
                const perGram = floor2(baseAfterPercent * 0.0656);
                net = floor2(perGram * w);
            } else if (tForm.type === 'redeem') {
                base = gp;
                const baseAfterPercent = floor2(base * 0.95);
                const perGram = floor2(baseAfterPercent * 0.0656);
                net = floor2(perGram * w);
            } else if (tForm.type === 'tong_tang') {
                base = gp;
                const perGram = floor2((base - 300) * 0.0656);
                const withPurity = floor2(perGram * (p / 100));
                net = floor2(withPurity * w);
            } else if (tForm.type === 'silver') {
                const deduct13 = sp;
                base = deduct13;
                const perGram = Math.floor(deduct13 / 1000);
                const withPercent = Math.floor(perGram * (p / 100));
                net = Math.floor(withPercent * w);
            }

            return {
                basePrice: base,
                premium: premium,
                netPrice: floor2(Math.max(0, net))
            };
        });

        const addToBill = () => {
            if (!isFormValid.value) return;
            billItems.value.push({
                id: Date.now() + Math.random(),
                type: calcForm.value.type,
                percent: (calcForm.value.type === 'tong_roop' || calcForm.value.type === 'redeem') ? 96.5 : calcForm.value.percent,
                weight: calcForm.value.weight,
                basePrice: calculatedResult.value.basePrice,
                premium: calculatedResult.value.premium,
                netPrice: calculatedResult.value.netPrice,
                customerName: calcForm.value.customerName,
                phone: calcForm.value.phone,
                idCard: calcForm.value.idCard
            });
            calcForm.value.weight = null;
            calcForm.value.percent = null;
        };

        const removeBillItem = (idx) => {
            billItems.value.splice(idx, 1);
        };

        const billTotal = computed(() => {
            return billItems.value.reduce((sum, item) => sum + item.netPrice, 0);
        });

        const formatCurrency = (val) => {
            return Number(val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleString('th-TH');
        };

        const formatPricePerGram = (val, type) => {
            const digits = type === 'silver' ? 0 : 2;
            return Number(val || 0).toLocaleString('th-TH', {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
        };

        const getTypeName = (type) => {
            const types = {
                'tong_lom': 'ทองหลอม',
                'tong_roop': 'ทองรูปพรรณ',
                'tong_tang': 'ทองคำแท่ง',
                'silver': 'เงิน (ซิลเวอร์)',
                'redeem': 'ไถ่ถอน'
            };
            return types[type] || type;
        };

        const initSignaturePad = (retries = 0) => {
            const canvas = document.getElementById('signature-pad');

            // Check if canvas exists and is visible (width > 0)
            if (canvas && canvas.offsetWidth > 0) {
                // If there's an existing instance, shut it down completely
                if (signaturePad) {
                    signaturePad.off();
                    signaturePad = null;
                }

                // Standard scaling for high-DPI displays
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);

                // Create fresh instance
                signaturePad = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: 'rgb(0, 51, 153)',
                    velocityFilterWeight: 0.7
                });
            } else if (retries < 30) {
                // Keep trying every 100ms for up to 3 seconds (to cover slow transitions)
                setTimeout(() => initSignaturePad(retries + 1), 100);
            }
        };

        const clearSignature = () => {
            if (signaturePad) {
                signaturePad.clear();
                lastSignature.value = null;
            }
        };

        const handlePhotoChange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resize to keep database size low
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Store as compressed JPEG
                    productPhoto.value = canvas.toDataURL('image/jpeg', 0.7);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        const removePhoto = () => {
            productPhoto.value = null;
            // Clear input
            const input = document.getElementById('photo-input');
            if (input) input.value = '';
        };

        // Auth
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            user.value = data.session?.user || null;
            if (user.value) {
                if (isAdmin.value && currentTab.value === 'history') loadTransactions();
            }
        };

        const login = async () => {
            authLoading.value = true;
            authError.value = '';
            const { data, error } = await supabase.auth.signInWithPassword({
                email: authForm.value.email,
                password: authForm.value.password,
            });
            authLoading.value = false;

            if (error) {
                authError.value = error.message;
            } else {
                user.value = data.user;
                showAuth.value = false;
                currentTab.value = 'calculator';
            }
        };

        const logout = async () => {
            await supabase.auth.signOut();
            user.value = null;
            currentTab.value = 'home';
        };

        // DB Data
        const loadPremiums = async () => {
            loadingPremiums.value = true;
            const { data, error } = await supabase.from('gold_premiums').select('*').order('range_min', { ascending: true });
            if (data && data.length) premiums.value = data;
            loadingPremiums.value = false;
        };

        const savePremiums = async () => {
            saving.value = true;
            for (const p of premiums.value) {
                if (p.id) {
                    await supabase.from('gold_premiums').update({ premium_amount: p.premium_amount }).eq('id', p.id);
                }
            }
            saving.value = false;
            alert('บันทึกการตั้งค่าสำเร็จ');
        };

        const loadTransactions = async () => {
            loadingTransactions.value = true;
            selectedTransactions.value = [];

            const startDt = new Date(`${filter.value.startDate}T${filter.value.startTime}:00`);
            const endDt = new Date(`${filter.value.endDate}T${filter.value.endTime}:59`);

            let query = supabase
                .from('transactions')
                .select('*')
                .gte('created_at', startDt.toISOString())
                .lte('created_at', endDt.toISOString())
                .order('created_at', { ascending: false });

            if (filter.value.type.length > 0 && filter.value.type.length < 5) {
                query = query.in('type', filter.value.type);
            }

            if (filter.value.search.trim()) {
                const s = `%${filter.value.search.trim()}%`;
                query = query.or(`customer_name.ilike.${s},phone.ilike.${s},id_card.ilike.${s}`);
            }

            if (filter.value.purityRange.length > 0) {
                const orConditions = [];
                if (filter.value.purityRange.includes('low')) orConditions.push('percent.lt.30');
                if (filter.value.purityRange.includes('mid')) orConditions.push('and(percent.gte.30,percent.lt.99)');
                if (filter.value.purityRange.includes('high')) orConditions.push('percent.gte.99');

                if (orConditions.length > 0) {
                    query = query.or(orConditions.join(','));
                }
            }

            const { data, error } = await query;

            if (data) transactions.value = data;
            else transactions.value = [];
            loadingTransactions.value = false;
        };

        const deleteTransaction = async (id) => {
            if (confirm('ยืนยันการลบรายการนี้?')) {
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (!error) loadTransactions();
                else alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
            }
        };

        const deleteSelected = async () => {
            if (selectedTransactions.value.length === 0) return;
            if (confirm(`ยืนยันการลบรายการที่เลือกจำนวน ${selectedTransactions.value.length} รายการ?`)) {
                loadingTransactions.value = true;
                const { error } = await supabase
                    .from('transactions')
                    .delete()
                    .in('id', selectedTransactions.value);

                if (!error) {
                    selectedTransactions.value = [];
                    await loadTransactions();
                } else {
                    alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
                    loadingTransactions.value = false;
                }
            }
        };

        const exportCSV = () => {
            if (transactions.value.length === 0) return;

            let csvContent = 'วันที่,เวลา,ลูกค้า,เบอร์โทรศัพท์,ประเภทสินทรัพย์,เปอร์เซ็นต์/น้ำหนัก,ยอดสุทธิ (บาท)\n';

            transactions.value.forEach(t => {
                const dt = new Date(t.created_at);
                const dDate = dt.toLocaleDateString('th-TH');
                const dTime = dt.toLocaleTimeString('th-TH');

                const name = `"${t.customer_name || 'เงินสด'}"`;
                const phone = `"${t.phone || '-'}"`;
                const type = `"${getTypeName(t.type)}"`;

                let detail = '-';
                if (t.type === 'tong_lom' || t.type === 'tong_roop') detail = `"${t.percent}% / ${t.weight} กรัม"`;
                else if (t.type === 'tong_tang' || t.type === 'silver') detail = `"${t.weight} กรัม"`;

                csvContent += `${dDate},${dTime},${name},${phone},${type},${detail},${t.net_price}\n`;
            });

            // Add Total Row
            csvContent += `,,,,,รวมยอดสุทธิทั้งสิ้น (บาท),${transactionsTotal.value}\n`;

            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // Add BOM for Excel UTF-8 representation
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            const fileName = `KritGold_Sales_${filter.value.startDate}_to_${filter.value.endDate}.csv`;
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        const transactionsTotal = computed(() => {
            return transactions.value.reduce((sum, item) => sum + (Number(item.net_price) || 0), 0);
        });

        const totalWeight = computed(() => {
            return transactions.value.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
        });

        const saveAndPrint = async () => {
            if (billItems.value.length === 0) return;

            // Capture signature
            if (signaturePad && !signaturePad.isEmpty()) {
                lastSignature.value = signaturePad.toDataURL();
            } else {
                lastSignature.value = null;
            }

            const handleAfterPrint = () => {
                billItems.value = [];
                resetForm();
                clearSignature();
                removePhoto();
                window.removeEventListener('afterprint', handleAfterPrint);
            };

            const triggerPrint = () => {
                window.addEventListener('afterprint', handleAfterPrint);
                window.print();

                // Fallback for mobile browsers that don't block JS execution
                // and might not reliably fire afterprint, giving them 3 secs to render PDF.
                setTimeout(() => {
                    handleAfterPrint();
                }, 3000);
            };

            // If completely public guest (no login), just print without calling DB
            if (!isLoggedIn.value) {
                nextTick(() => {
                    triggerPrint();
                });
                return;
            }

            // Logged in (Employee or Admin): Save to DB first
            saving.value = true;

            const trData = billItems.value.map(item => ({
                customer_name: item.customerName || 'เงินสด',
                phone: item.phone || '',
                id_card: item.idCard || '',
                type: item.type,
                base_price: item.basePrice,
                premium_amount: item.premium,
                percent: item.percent,
                weight: item.weight,
                net_price: item.netPrice,
                signature: lastSignature.value,
                photo: productPhoto.value,
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('transactions').insert(trData);
            saving.value = false;

            if (error) {
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
            } else {
                nextTick(() => {
                    triggerPrint();
                });
            }
        };

        // Graph
        const initChart = () => {
            const container = document.getElementById('tradingview_gold');
            if (container && window.TradingView) {
                container.innerHTML = '';
                new window.TradingView.widget({
                    "autosize": true,
                    "symbol": "OANDA:XAUUSD",
                    "interval": "60",
                    "timezone": "Asia/Bangkok",
                    "theme": "dark",
                    "style": "1",
                    "locale": "th_TH",
                    "enable_publishing": false,
                    "backgroundColor": "rgba(24, 24, 27, 0.4)",
                    "gridColor": "rgba(255, 255, 255, 0.05)",
                    "hide_top_toolbar": false,
                    "hide_legend": false,
                    "save_image": false,
                    "container_id": "tradingview_gold"
                });
            } else if (container && !window.TradingView) {
                setTimeout(initChart, 300);
            }
        };

        const updateChart = (timeLabel, gold, silver) => {
            // TradingView widget handles real-time data internally
        };

        const fetchPrices = async () => {
            try {
                // Fetch Gold API
                const resGold = await fetch('/api/gold');
                if (resGold.ok) {
                    const dataGold = await resGold.json();
                    if (dataGold && dataGold.ok && dataGold.prices) {
                        const barBuy = parseFloat(dataGold.prices.bar.buy);
                        const barSell = parseFloat(dataGold.prices.bar.sell);
                        const ornBuy = parseFloat(dataGold.prices.orn.buy);
                        const ornSell = parseFloat(dataGold.prices.orn.sell);

                        priceTrendGold.value = barBuy - (goldPrice.value || barBuy);

                        // Use bar.buy as the base for all calculations (goldPrice)
                        goldPrice.value = barBuy; // ใช้ราคารับซื้อ (Buy) เป็นฐานการคำนวณตามสั่ง
                        goldPriceBid.value = barBuy;
                        goldPriceAsk.value = barSell;
                        goldOrnBuy.value = ornBuy;
                        goldOrnSell.value = ornSell;

                        if (dataGold.meta) {
                            goldPriceMeta.value = dataGold.meta;
                        }
                    }
                }

                // Fetch XAG API
                const resXag = await fetch('/api/xag');
                if (resXag.ok) {
                    const dataXag = await resXag.json();
                    if (dataXag) {
                        const sell = parseFloat(dataXag.sell);
                        const buy = parseFloat(dataXag.buy);
                        silverPriceSpot.value = parseFloat(dataXag.spot);
                        silverPriceExchange.value = parseFloat(dataXag.exchange);
                        priceTrendSilver.value = buy - (silverPrice.value || buy);

                        silverPriceSell.value = sell;
                        silverPriceBuy.value = buy;
                        silverPrice.value = buy; // Reference for calculation (รับซื้อ)
                    }
                }

                // Update graph
                if (goldPrice.value > 0 || silverPrice.value > 0) {
                    const timeStr = new Date().toLocaleTimeString('th-TH');
                    updateChart(timeStr, goldPrice.value, silverPrice.value);
                }
            } catch (err) {
                console.error('Fetch prices failed', err);
            }
        };

        const syncHashToTab = () => {
            const hash = window.location.hash.replace('#', '');
            const validTabs = ['home', 'history', 'settings'];
            if (validTabs.includes(hash)) {
                currentTab.value = hash;
            } else if (!window.location.hash) {
                currentTab.value = 'home';
            }
        };

        onMounted(() => {
            syncHashToTab();
            window.addEventListener('hashchange', syncHashToTab);

            loadPremiums();
            checkAuth();

            nextTick(() => {
                setTimeout(() => {
                    initChart();
                    if (isLoggedIn.value && currentTab.value === 'calculator') initSignaturePad();
                }, 500); // 500ms delay for Chrome CSS transition

                fetchPrices();
                setInterval(fetchPrices, 30000); // 30 sec interval
            });
        });

        watch([isLoggedIn, currentTab], () => {
            if (isLoggedIn.value && currentTab.value === 'calculator') {
                nextTick(() => {
                    setTimeout(initSignaturePad, 300);
                });
            }
        });

        watch(currentTab, (newTab) => {
            if (window.location.hash.replace('#', '') !== newTab) {
                window.location.hash = newTab;
            }
            if (newTab === 'home') {
                setTimeout(() => {
                    initChart();
                    const timeStr = new Date().toLocaleTimeString('th-TH');
                    updateChart(timeStr, goldPrice.value, silverPrice.value);
                }, 400); // 400ms delay passing CSS fade transition
            } else if (newTab === 'history') {
                loadTransactions();
            }
            mobileMenuOpen.value = false;
        });

        return {
            currentTab,
            user,
            isLoggedIn,
            isAdmin,
            isEmployee,
            showAuth,
            authForm,
            authError,
            authLoading,
            mobileMenuOpen,
            login,
            logout,

            goldPriceAsk,
            goldPriceBid,
            goldPrice,
            goldOrnBuy,
            goldOrnSell,
            goldPriceMeta,

            silverPriceSell,
            silverPriceBuy,
            silverPriceSpot,
            silverPriceExchange,
            silverPrice,

            priceTrendGold,
            priceTrendSilver,

            premiums,
            loadingPremiums,
            savePremiums,
            saving,

            transactions,
            loadingTransactions,
            transactionsTotal,
            totalWeight,
            formatCurrency,
            filter,
            isFilterActive,
            deleteTransaction,
            loadTransactions,
            deleteSelected,
            exportCSV,
            selectedTransactions,
            isAllSelected,
            togglePurity,
            setDatePreset,
            toggleSelectAll,

            calcForm,
            resetForm,
            isFormValid,
            currentAssetPrice,
            calculatedResult,
            isPhoneValid,
            isIdCardValid,
            formatPricePerGram,

            billItems,
            addToBill,
            removeBillItem,
            billTotal,
            saveAndPrint,

            formatDate,
            getTypeName,
            lastSignature,
            clearSignature,
            productPhoto,
            handlePhotoChange,
            removePhoto,
            viewingPhoto
        };
    }
}).mount('#app');
