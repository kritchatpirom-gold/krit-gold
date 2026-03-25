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

        // Roles
        const isAdmin = computed(() => user.value && user.value.email === 'admin@kritgold.com');
        const isEmployee = computed(() => user.value && user.value.email === 'user@kritgold.com');
        const isLoggedIn = computed(() => user.value !== null);

        // Prices & Chart
        const goldPriceAsk = ref(0);
        const goldPriceBid = ref(0);
        const goldPrice = ref(0); // Using Ask (รับซื้อ) as reference
        
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
            startDate: new Date().toISOString().split('T')[0],
            startTime: '00:00',
            endDate: new Date().toISOString().split('T')[0],
            endTime: '23:59',
            type: 'all'
        });

        const isFilterActive = computed(() => {
            const today = new Date().toISOString().split('T')[0];
            return filter.value.startDate !== today || 
                   filter.value.endDate !== today || 
                   filter.value.startTime !== '00:00' || 
                   filter.value.endTime !== '23:59' || 
                   filter.value.type !== 'all';
        });

        const selectedTransactions = ref([]);

        const isAllSelected = computed(() => {
            return transactions.value.length > 0 && selectedTransactions.value.length === transactions.value.length;
        });

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
            manualPrice: null
        });

        const resetForm = () => {
            calcForm.value = {
                type: 'tong_lom',
                weight: null,
                percent: null,
                customerName: '',
                phone: '',
                manualPrice: null
            };
        };

        const isFormValid = computed(() => {
            return calcForm.value.weight > 0 && calcForm.value.percent !== null;
        });

        const currentAssetPrice = computed(() => {
            if (calcForm.value.type === 'tong_lom' || calcForm.value.type === 'tong_roop' || calcForm.value.type === 'tong_tang') {
                return Number(goldPrice.value) || 0;
            } else if (calcForm.value.type === 'silver') {
                return Number(silverPrice.value) || 0;
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
            
            const gp = refPrice;
            const sp = refPrice;

            if (tForm.type === 'tong_lom') {
                base = gp;
                let activePremium = premiums.value.find(pr => p >= pr.range_min && p <= pr.range_max);
                premium = activePremium ? Number(activePremium.premium_amount) : 0;
                net = (base + premium) * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'tong_roop') {
                base = gp;
                const baseAfterPercent = base * 0.96;
                net = baseAfterPercent * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'tong_tang') {
                base = gp;
                net = (base - 300) * 0.0656 * (p / 100) * w;
            } else if (tForm.type === 'silver') {
                base = sp;
                net = ((base - 13000) / 1000) * (p / 100) * w;
            }

            return {
                basePrice: base,
                premium: premium,
                netPrice: Math.max(0, net)
            };
        });

        const addToBill = () => {
            if(!isFormValid.value) return;
            billItems.value.push({
                id: Date.now() + Math.random(),
                type: calcForm.value.type,
                percent: calcForm.value.percent,
                weight: calcForm.value.weight,
                basePrice: calculatedResult.value.basePrice,
                premium: calculatedResult.value.premium,
                netPrice: calculatedResult.value.netPrice
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
                
            if (filter.value.type !== 'all') {
                query = query.eq('type', filter.value.type);
            }

            const { data, error } = await query;
                
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

        const deleteSelected = async () => {
            if(selectedTransactions.value.length === 0) return;
            if(confirm(`ยืนยันการลบรายการที่เลือกจำนวน ${selectedTransactions.value.length} รายการ?`)) {
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

        const transactionsTotal = computed(() => {
            return transactions.value.reduce((sum, t) => sum + (Number(t.net_price) || 0), 0);
        });

        const saveAndPrint = async () => {
            if (billItems.value.length === 0) return;
            
            const handleAfterPrint = () => {
                billItems.value = [];
                resetForm();
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
            if(!isLoggedIn.value) {
                nextTick(() => {
                    triggerPrint();
                });
                return;
            }
            
            // Logged in (Employee or Admin): Save to DB first
            saving.value = true;
            
            const trData = billItems.value.map(item => ({
                customer_name: calcForm.value.customerName || 'เงินสด',
                phone: calcForm.value.phone || '',
                type: item.type,
                base_price: item.basePrice,
                premium_amount: item.premium,
                percent: item.percent,
                weight: item.weight,
                net_price: item.netPrice,
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
                   if (dataGold && dataGold.gold965) {
                       const ask = parseFloat(dataGold.gold965.ask); // ราคารับซื้อ
                       const bid = parseFloat(dataGold.gold965.bid); // ราคาขายออก
                       priceTrendGold.value = ask - (goldPrice.value || ask);
                       goldPriceAsk.value = ask;
                       goldPriceBid.value = bid;
                       goldPrice.value = ask; 
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
            } catch(err) {
                console.error('Fetch prices failed', err);
            }
        };

        onMounted(() => {
            // anyone needs premiums for correct calculations
            loadPremiums();
            checkAuth();
            
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
            } else if (newTab === 'history' && isAdmin.value) {
                loadTransactions();
            }
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
            filter,
            isFilterActive,
            loadTransactions,
            deleteTransaction,
            deleteSelected,
            selectedTransactions,
            isAllSelected,
            toggleSelectAll,
            transactionsTotal,

            calcForm,
            resetForm,
            isFormValid,
            currentAssetPrice,
            calculatedResult,
            
            billItems,
            addToBill,
            removeBillItem,
            billTotal,
            saveAndPrint,
            
            formatCurrency,
            formatDate,
            getTypeName
        };
    }
}).mount('#app');
