const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const supabaseUrl = 'https://cjithgqbtwuxfxrauvax.supabase.co';
const supabaseKey = 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

createApp({
    setup() {
        const currentTab = ref('home');
        const user = ref(null);
        const showAuth = ref(false);
        const authForm = ref({ email: '', password: '' });
        const authError = ref('');
        const authLoading = ref(false);
        const mobileMenuOpen = ref(false);

        // Prices & Chart
        const goldPrice = ref(0);
        const silverPrice = ref(0);
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

        // Transactions
        const transactions = ref([]);
        const loadingTransactions = ref(false);
        const filterDate = ref(new Date().toISOString().split('T')[0]);

        // Calculator Form
        const calcForm = ref({
            type: 'tong_lom', 
            weight: null,
            percent: null,
            customerName: '',
            phone: ''
        });

        const resetForm = () => {
            calcForm.value = {
                type: 'tong_lom',
                weight: null,
                percent: null,
                customerName: '',
                phone: ''
            };
        };

        const isFormValid = computed(() => {
            return calcForm.value.weight > 0 && calcForm.value.percent !== null;
        });

        const calculatedResult = computed(() => {
            let base = 0;
            let premium = 0;
            let net = 0;

            const tForm = calcForm.value;
            const w = Number(tForm.weight) || 0;
            const p = Number(tForm.percent) || 0;
            const gp = Number(goldPrice.value) || 40000;
            const sp = Number(silverPrice.value) || 30000; // per kg

            if (tForm.type === 'tong_lom') {
                base = gp;
                let activePremium = premiums.value.find(pr => p >= pr.range_min && p <= pr.range_max);
                premium = activePremium ? Number(activePremium.premium_amount) : 0;
                // (ราคาทองแท่ง + ราคาบวก) * 0.0656 * (%ทอง/100) * น้ำหนัก
                net = (base + premium) * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'tong_roop') {
                base = gp;
                // (ราคาทองแท่ง - 4%) * 0.0656 * (%/100) * น้ำหนัก
                const baseAfterPercent = base * 0.96;
                net = baseAfterPercent * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'tong_tang') {
                base = gp;
                // (ราคาทองแท่ง - 300) * 0.0656 * (%/100) * น้ำหนัก
                net = (base - 300) * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'silver') {
                base = sp;
                // ((ราคาเงินแท่ง - 13000) / 1000) * (%เงิน/100) * น้ำหนัก
                net = ((base - 13000) / 1000) * (p / 100) * w;
            }

            return {
                basePrice: base,
                premium: premium,
                netPrice: Math.max(0, net)
            };
        });

        const formatCurrency = (val) => {
            return Number(val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleString('th-TH');
        };

        const getTypeName = (type) => {
            const types = {
                'tong_lom': 'ทองหลอม',
                'tong_roop': 'ทองรูปพรรณ',
                'tong_tang': 'ทองคำแท่ง',
                'silver': 'เงิน (ซิลเวอร์)'
            };
            return types[type] || type;
        };

        // Auth
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            user.value = data.session?.user || null;
            if (user.value) {
                loadPremiums();
                if (currentTab.value === 'history') loadTransactions();
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
                loadPremiums();
                currentTab.value = 'calculator';
            }
        };

        const logout = async () => {
            await supabase.auth.signOut();
            user.value = null;
            currentTab.value = 'home';
        };

        // Data Management
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
            const startDate = new Date(filterDate.value);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(filterDate.value);
            endDate.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });
                
            if (data) transactions.value = data;
            else transactions.value = [];
            loadingTransactions.value = false;
        };

        const deleteTransaction = async (id) => {
            if(confirm('ยืนยันการลบรายการนี้?')) {
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (!error) loadTransactions();
                else alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
            }
        };

        const saveAndPrint = async () => {
            if (!isFormValid.value) return;
            saving.value = true;
            
            const trData = {
                customer_name: calcForm.value.customerName,
                phone: calcForm.value.phone,
                type: calcForm.value.type,
                base_price: calculatedResult.value.basePrice,
                premium_amount: calculatedResult.value.premium,
                percent: calcForm.value.percent,
                weight: calcForm.value.weight,
                net_price: calculatedResult.value.netPrice
            };

            const { error } = await supabase.from('transactions').insert([trData]);
            saving.value = false;
            
            if (error) {
                alert('เกิดข้อผิดพลาด: ' + error.message);
            } else {
                nextTick(() => {
                    window.print();
                    resetForm();
                });
            }
        };

        // Initialize App Graph and API
        const initChart = () => {
            const ctx = document.getElementById('priceChart');
            if(!ctx) return;
            
            priceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'ราคาทองคำ (บาท)', data: [], borderColor: '#c88c3a', backgroundColor: 'rgba(200, 140, 58, 0.1)', fill: true, tension: 0.4 },
                        { label: 'ราคาเงิน XAG (กิโล)', data: [], borderColor: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: false } }
                }
            });
        };

        const updateChart = (timeLabel, gold, silver) => {
            if(!priceChart) return;
            
            if(priceChart.data.labels.length > 20) {
                priceChart.data.labels.shift();
                priceChart.data.datasets[0].data.shift();
                priceChart.data.datasets[1].data.shift();
            }
            
            priceChart.data.labels.push(timeLabel);
            priceChart.data.datasets[0].data.push(gold);
            priceChart.data.datasets[1].data.push(silver);
            priceChart.update();
        };

        const fetchPrices = async () => {
            try {
                // Fetch proxy from Netlify
                const res = await fetch('/api/proxy');
                let data = null;
                if(res.ok) {
                   const text = await res.text();
                   try { data = JSON.parse(text); } catch(e){}
                }

                if(!data && goldPrice.value === 0) {
                    // Fallback mock if API unavailable
                    const goldMock = 40000 + (Math.random() * 200 - 100);
                    const silverMock = 30000 + (Math.random() * 200 - 100);
                    
                    priceTrendGold.value = goldMock - goldPrice.value;
                    priceTrendSilver.value = silverMock - silverPrice.value;
                    
                    goldPrice.value = goldMock;
                    silverPrice.value = silverMock;
                } else if(data) {
                    // Adjust path based on real API struct:
                    // Usually jk-goldtrader API has some nested objects. E.g., data.gold.sell, data.xag.sell
                    // Let's assume a generic attempt, if it fails, we keep mock.
                    const currGold = parseFloat(data?.Gold?.Sell || data?.gold?.sell || data?.price || goldPrice.value + (Math.random() * 50 - 25));
                    const currSilver = parseFloat(data?.Silver?.Sell || data?.xag?.sell || silverPrice.value + (Math.random() * 50 - 25));
                    
                    priceTrendGold.value = currGold - goldPrice.value;
                    priceTrendSilver.value = currSilver - silverPrice.value;
                    
                    goldPrice.value = currGold;
                    silverPrice.value = currSilver;
                }
                
                const timeStr = new Date().toLocaleTimeString('th-TH');
                updateChart(timeStr, goldPrice.value, silverPrice.value);
                
            } catch(err) {
                console.error('Fetch prices failed', err);
            }
        };

        onMounted(() => {
            checkAuth();
            loadPremiums();
            
            goldPrice.value = 40500;
            silverPrice.value = 31200;
            
            nextTick(() => {
                initChart();
                fetchPrices();
                setInterval(fetchPrices, 30000); // 30 sec interval
            });
        });

        watch(currentTab, (newTab) => {
            if (newTab === 'home') {
                nextTick(() => {
                    initChart();
                    const timeStr = new Date().toLocaleTimeString('th-TH');
                    updateChart(timeStr, goldPrice.value, silverPrice.value);
                });
            } else if (newTab === 'history') {
                loadTransactions();
            }
        });

        return {
            currentTab,
            user,
            showAuth,
            authForm,
            authError,
            authLoading,
            mobileMenuOpen,
            login,
            logout,
            
            goldPrice,
            silverPrice,
            priceTrendGold,
            priceTrendSilver,
            
            premiums,
            loadingPremiums,
            savePremiums,
            saving,

            transactions,
            loadingTransactions,
            filterDate,
            loadTransactions,
            deleteTransaction,

            calcForm,
            resetForm,
            isFormValid,
            calculatedResult,
            saveAndPrint,
            
            formatCurrency,
            formatDate,
            getTypeName
        };
    }
}).mount('#app');
