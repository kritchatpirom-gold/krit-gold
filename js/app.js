const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const supabaseUrl = 'https://cjithgqbtwuxfxrauvax.supabase.co';
const supabaseKey = 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';

//const supabaseUrl = 'http://192.168.1.151:54321';
//const supabaseKey = '850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907';
//const supabaseUrl = 'http://192.168.1.124:54121';
//const supabaseKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Robust truncation helper to skip floating-point binary gaps (like .42999... becoming .43)
const floor2 = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const num = Number(v);
    if (isNaN(num)) return 0;
    const s = num.toFixed(4); // Rounds to 4th decimal to clean ghost bits
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
        let pauseCustomerWatch = false;
        const lastSignature = ref(null);
        const productPhoto = ref(null);
        const viewingPhoto = ref(null);
        const readCardLoading = ref(false); // ID Card Reading State
        const showSignatureModal = ref(false);
        const modalHasSignature = ref(false);
        const showCameraModal = ref(false);
        let signaturePad = null;
        let cameraStream = null;

        // Roles
        const isAdmin = computed(() => user.value && user.value.email === 'admin@kritgold.com');
        const isEmployee = computed(() => user.value && user.value.email !== 'admin@kritgold.com');
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
        const silverDeduction = ref(13); // Default 13%
        const useSilverDeduction = ref(true); // Default enabled
        const silverPremiumAmountVip = ref(0);
        const silverPremiumAmountVvip = ref(0);
        const silverPremiumAmountNetwork = ref(0);
        
        const networkGoldPremiumAmount_25_49 = ref(0);
        const networkGoldPremiumPercent_25_49 = ref(0);
        const networkGoldPremiumAmount_50_100 = ref(0);
        const networkGoldPremiumPercent_50_100 = ref(0);

        const silverPremiumAmountNetworkVip = ref(0);
        const networkVipGoldPremiumAmount_25_49 = ref(0);
        const networkVipGoldPremiumPercent_25_49 = ref(0);
        const networkVipGoldPremiumAmount_50_100 = ref(0);
        const networkVipGoldPremiumPercent_50_100 = ref(0);
        const manualSilverPrice = ref(0);
        const useManualSilverPrice = ref(false);
        const employeeLastSilverUpdate = ref(null);
        
        // Attendance State
        const lateDeductionRate = ref(1);
        
        // LINE Notify State
        const lineNotifyToken = ref('');
        const lineTargetId = ref('');
        const testingLine = ref(false);
        const attendanceData = ref({ idCard: '', name: '', photo: '' });
        const attendanceLoading = ref(false);
        const submittingAttendance = ref(false);
        const todayAttendance = ref([]);
        const loadingAttendanceList = ref(false);
        const attendanceFilterMode = ref('today'); // 'today', 'yesterday', 'week', 'month', 'range', 'all'
        const attendanceStartDate = ref(new Date().toLocaleDateString('en-CA'));
        const attendanceEndDate = ref(new Date().toLocaleDateString('en-CA'));
        const attendanceSearchQuery = ref('');
        const attendanceSummaryMonth = ref(new Date().toISOString().substring(0, 7)); // YYYY-MM
        const attendanceSummary = ref([]);
        const loadingAttendanceSummary = ref(false);

        const isSilverPriceSetToday = computed(() => {
            const todayStr = new Date().toLocaleDateString('en-CA'); // format: YYYY-MM-DD
            const todayNum = parseInt(todayStr.replace(/-/g, ''));
            return Number(employeeLastSilverUpdate.value) === todayNum;
        });
        const customerSearchQuery = ref('');

        const adminCustomerSearchResults = ref([]);
        const customerSearchAttempted = ref(false);
        const premiumCustomersList = ref([]);
        let priceChart = null;

        // Drawer Balance
        const drawerBalance = ref({
            b1000: 0, b500: 0, b100: 0, b50: 0, b20: 0,
            c10: 0, c5: 0, c1: 0
        });
        const savingDrawer = ref(false);
        const drawerLogs = ref([]);
        const loadingDrawerLogs = ref(false);
        const showDrawerLogsModal = ref(false);

        // Top Up Modal State
        const showTopUpModal = ref(false);
        const savingTopUp = ref(false);
        const topUpForm = ref({
            b1000: '', b500: '', b100: '', b50: '', b20: '',
            c10: '', c5: '', c1: ''
        });
        
        const topUpTotal = computed(() => {
            return (topUpForm.value.b1000 * 1000) +
                   (topUpForm.value.b500 * 500) +
                   (topUpForm.value.b100 * 100) +
                   (topUpForm.value.b50 * 50) +
                   (topUpForm.value.b20 * 20) +
                   (topUpForm.value.c10 * 10) +
                   (topUpForm.value.c5 * 5) +
                   (topUpForm.value.c1 * 1);
        });

        const drawerTotal = computed(() => {
            return (drawerBalance.value.b1000 * 1000) +
                   (drawerBalance.value.b500 * 500) +
                   (drawerBalance.value.b100 * 100) +
                   (drawerBalance.value.b50 * 50) +
                   (drawerBalance.value.b20 * 20) +
                   (drawerBalance.value.c10 * 10) +
                   (drawerBalance.value.c5 * 5) +
                   (drawerBalance.value.c1 * 1);
        });

        const loadDrawerLogs = async () => {
            loadingDrawerLogs.value = true;
            try {
                const { data, error } = await supabase.from('drawer_logs').select('*').order('created_at', { ascending: false }).limit(100);
                if (error) throw error;
                drawerLogs.value = data || [];
            } catch (err) {
                console.error("Error loading drawer logs:", err);
            } finally {
                loadingDrawerLogs.value = false;
            }
        };

        const openDrawerLogsModal = () => {
            showDrawerLogsModal.value = true;
            loadDrawerLogs();
        };

        const getDrawerTotalFromObj = (obj) => {
            if (!obj) return 0;
            return (obj.b1000 || 0) * 1000 +
                   (obj.b500 || 0) * 500 +
                   (obj.b100 || 0) * 100 +
                   (obj.b50 || 0) * 50 +
                   (obj.b20 || 0) * 20 +
                   (obj.c10 || 0) * 10 +
                   (obj.c5 || 0) * 5 +
                   (obj.c1 || 0) * 1;
        };

        const getDrawerDiff = (oldB, newB) => {
            if (!oldB || !newB) return [];
            const diffs = [];
            const keys = { b1000: 'แบงค์ 1,000', b500: 'แบงค์ 500', b100: 'แบงค์ 100', b50: 'แบงค์ 50', b20: 'แบงค์ 20', c10: 'เหรียญ 10', c5: 'เหรียญ 5', c1: 'เหรียญ 1' };
            for (const [k, label] of Object.entries(keys)) {
                const diff = (newB[k] || 0) - (oldB[k] || 0);
                if (diff !== 0) {
                    diffs.push({ label, diff, absDiff: Math.abs(diff) });
                }
            }
            return diffs;
        };

        const getDrawerBreakdown = (obj) => {
            if (!obj) return [];
            const keys = { b1000: 'แบงค์ 1,000', b500: 'แบงค์ 500', b100: 'แบงค์ 100', b50: 'แบงค์ 50', b20: 'แบงค์ 20', c10: 'เหรียญ 10', c5: 'เหรียญ 5', c1: 'เหรียญ 1' };
            const breakdown = [];
            for (const [k, label] of Object.entries(keys)) {
                if (obj[k] > 0) {
                    breakdown.push({ label, count: obj[k] });
                }
            }
            return breakdown;
        };

        const loadDrawerBalance = async () => {
            try {
                const { data, error } = await supabase.from('drawer_balance').select('*').eq('id', 1).maybeSingle();
                if (data && !error) {
                    drawerBalance.value = {
                        b1000: data.b1000 || 0,
                        b500: data.b500 || 0,
                        b100: data.b100 || 0,
                        b50: data.b50 || 0,
                        b20: data.b20 || 0,
                        c10: data.c10 || 0,
                        c5: data.c5 || 0,
                        c1: data.c1 || 0
                    };
                }
            } catch (err) {
                console.error("Error loading drawer balance:", err);
            }
        };

        // Custom Global Modal System
        const appModal = ref({ show: false, type: 'alert', title: '', message: '', fields: [], resolveFn: null, confirmText: 'ตกลง', cancelText: 'ยกเลิก' });

        const showAppModal = (type, title, message, fields = [], confirmText = 'ตกลง', cancelText = 'ยกเลิก') => {
            return new Promise((resolve) => {
                appModal.value = {
                    show: true,
                    type,
                    title,
                    message,
                    fields: fields.map(f => ({ ...f, value: f.defaultValue || '' })),
                    resolveFn: resolve,
                    confirmText,
                    cancelText
                };
            });
        };

        const resolveModal = (confirmResult) => {
            appModal.value.show = false;
            if (appModal.value.resolveFn) {
                if (appModal.value.type === 'prompt' && confirmResult) {
                    const result = appModal.value.fields.length === 1 ? appModal.value.fields[0].value : appModal.value.fields.map(f => f.value);
                    appModal.value.resolveFn(result);
                } else {
                    appModal.value.resolveFn(confirmResult);
                }
            }
        };

        const logDrawerAction = async (action, amount, oldBalanceObj, newBalanceObj, referenceId = null) => {
            try {
                // Ensure no unneeded properties are saved to jsonb
                const cleanOld = oldBalanceObj ? { ...oldBalanceObj } : null;
                const cleanNew = newBalanceObj ? { ...newBalanceObj } : null;
                if (cleanOld) { delete cleanOld.id; delete cleanOld.updated_at; }
                if (cleanNew) { delete cleanNew.id; delete cleanNew.updated_at; }

                await supabase.from('drawer_logs').insert([{
                    action: action,
                    amount: amount,
                    old_balance: cleanOld,
                    new_balance: cleanNew,
                    reference_id: referenceId
                }]);
            } catch (err) {
                console.error("Error logging drawer action:", err);
            }
        };

        const saveDrawerBalance = async () => {
            if (!isAdmin.value) return;
            savingDrawer.value = true;
            try {
                const { data: oldData } = await supabase.from('drawer_balance').select('*').eq('id', 1).single();
                const oldBalance = oldData ? { ...oldData } : null;
                const newBalance = { ...drawerBalance.value };
                
                let oldTotal = 0;
                if (oldBalance) {
                    oldTotal = (oldBalance.b1000||0)*1000 + (oldBalance.b500||0)*500 + (oldBalance.b100||0)*100 + (oldBalance.b50||0)*50 + (oldBalance.b20||0)*20 + (oldBalance.c10||0)*10 + (oldBalance.c5||0)*5 + (oldBalance.c1||0)*1;
                }
                const newTotal = (newBalance.b1000||0)*1000 + (newBalance.b500||0)*500 + (newBalance.b100||0)*100 + (newBalance.b50||0)*50 + (newBalance.b20||0)*20 + (newBalance.c10||0)*10 + (newBalance.c5||0)*5 + (newBalance.c1||0)*1;
                const diffAmount = newTotal - oldTotal;

                const { error } = await supabase.from('drawer_balance').update({
                    b1000: newBalance.b1000,
                    b500: newBalance.b500,
                    b100: newBalance.b100,
                    b50: newBalance.b50,
                    b20: newBalance.b20,
                    c10: newBalance.c10,
                    c5: newBalance.c5,
                    c1: newBalance.c1,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
                
                if (error) throw error;
                
                await logDrawerAction('MANUAL_UPDATE', diffAmount, oldBalance, newBalance);
                
                await showAppModal('alert', 'สำเร็จ', 'บันทึกยอดเงินในลิ้นชักเรียบร้อยแล้ว');
            } catch (err) {
                console.error("Error saving drawer balance:", err);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
            } finally {
                savingDrawer.value = false;
            }
        };



        const showWithdrawModal = ref(false);
        const savingWithdraw = ref(false);
        const withdrawForm = ref({ b1000: '', b500: '', b100: '', b50: '', b20: '', c10: '', c5: '', c1: '' });
        const withdrawTotal = computed(() => {
            return (withdrawForm.value.b1000 || 0) * 1000 + (withdrawForm.value.b500 || 0) * 500 + 
                   (withdrawForm.value.b100 || 0) * 100 + (withdrawForm.value.b50 || 0) * 50 + 
                   (withdrawForm.value.b20 || 0) * 20 + (withdrawForm.value.c10 || 0) * 10 + 
                   (withdrawForm.value.c5 || 0) * 5 + (withdrawForm.value.c1 || 0) * 1;
        });

        const openTopUpModal = () => {
            topUpForm.value = { b1000: '', b500: '', b100: '', b50: '', b20: '', c10: '', c5: '', c1: '' };
            showTopUpModal.value = true;
        };

        const openWithdrawModal = () => {
            withdrawForm.value = { b1000: '', b500: '', b100: '', b50: '', b20: '', c10: '', c5: '', c1: '' };
            showWithdrawModal.value = true;
        };

        const confirmTopUp = async () => {
            if (!isAdmin.value && !isEmployee.value) return;
            if (topUpTotal.value <= 0) {
                await showAppModal('alert', 'ไม่สามารถเติมเงินได้', 'กรุณาระบุจำนวนเงินที่ต้องการเติม');
                return;
            }
            
            savingTopUp.value = true;
            try {
                const { data: oldData } = await supabase.from('drawer_balance').select('*').eq('id', 1).single();
                const oldBalance = oldData ? { ...oldData } : null;
                
                const newBalance = {
                    b1000: (oldBalance?.b1000 || 0) + (topUpForm.value.b1000 || 0),
                    b500: (oldBalance?.b500 || 0) + (topUpForm.value.b500 || 0),
                    b100: (oldBalance?.b100 || 0) + (topUpForm.value.b100 || 0),
                    b50: (oldBalance?.b50 || 0) + (topUpForm.value.b50 || 0),
                    b20: (oldBalance?.b20 || 0) + (topUpForm.value.b20 || 0),
                    c10: (oldBalance?.c10 || 0) + (topUpForm.value.c10 || 0),
                    c5: (oldBalance?.c5 || 0) + (topUpForm.value.c5 || 0),
                    c1: (oldBalance?.c1 || 0) + (topUpForm.value.c1 || 0)
                };

                const { error } = await supabase.from('drawer_balance').update({
                    ...newBalance,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
                
                if (error) throw error;
                
                drawerBalance.value = newBalance;
                
                await logDrawerAction('TOP_UP', topUpTotal.value, oldBalance, newBalance);
                
                showTopUpModal.value = false;
                await showAppModal('alert', 'สำเร็จ', `เติมเงินเข้าลิ้นชัก ${formatCurrency(topUpTotal.value)} บาท เรียบร้อยแล้ว`);
            } catch (err) {
                console.error("Error topping up drawer:", err);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเติมเงิน: ' + err.message);
            } finally {
                savingTopUp.value = false;
            }
        };

        const confirmWithdraw = async () => {
            if (!isAdmin.value) return;
            if (withdrawTotal.value <= 0) {
                await showAppModal('alert', 'ไม่สามารถนำเงินออกได้', 'กรุณาระบุจำนวนเงินที่ต้องการนำออก');
                return;
            }
            
            savingWithdraw.value = true;
            try {
                const { data: oldData } = await supabase.from('drawer_balance').select('*').eq('id', 1).single();
                const oldBalance = oldData ? { ...oldData } : null;
                
                if (!oldBalance) throw new Error("ไม่พบข้อมูลลิ้นชักเงิน");

                const newBalance = {
                    b1000: (oldBalance.b1000 || 0) - (withdrawForm.value.b1000 || 0),
                    b500: (oldBalance.b500 || 0) - (withdrawForm.value.b500 || 0),
                    b100: (oldBalance.b100 || 0) - (withdrawForm.value.b100 || 0),
                    b50: (oldBalance.b50 || 0) - (withdrawForm.value.b50 || 0),
                    b20: (oldBalance.b20 || 0) - (withdrawForm.value.b20 || 0),
                    c10: (oldBalance.c10 || 0) - (withdrawForm.value.c10 || 0),
                    c5: (oldBalance.c5 || 0) - (withdrawForm.value.c5 || 0),
                    c1: (oldBalance.c1 || 0) - (withdrawForm.value.c1 || 0)
                };

                // Check for negative balances
                for (const key of Object.keys(newBalance)) {
                    if (newBalance[key] < 0) {
                        throw new Error(`จำนวนเงินคงเหลือในลิ้นชักไม่เพียงพอสำหรับประเภท ${key.replace('b', 'แบงค์ ').replace('c', 'เหรียญ ')}`);
                    }
                }

                const { error } = await supabase.from('drawer_balance').update({
                    ...newBalance,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
                
                if (error) throw error;
                
                drawerBalance.value = newBalance;
                
                // Note: diff amount is negative for deduction
                await logDrawerAction('WITHDRAW', -withdrawTotal.value, oldBalance, newBalance);
                
                showWithdrawModal.value = false;
                await showAppModal('alert', 'สำเร็จ', `นำเงินออกจากลิ้นชัก ${formatCurrency(withdrawTotal.value)} บาท เรียบร้อยแล้ว`);
            } catch (err) {
                console.error("Error withdrawing from drawer:", err);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการนำเงินออก: ' + err.message);
            } finally {
                savingWithdraw.value = false;
            }
        };

        const deductDrawerBalance = async (totalAmount, transactionId = null) => {
            let amount = Math.ceil(totalAmount);
            if (amount <= 0) return null;
            
            // Reload fresh balance before deduction
            await loadDrawerBalance();
            const oldBalance = { ...drawerBalance.value };
            
            // Greedy deduction
            const denoms = [
                { key: 'b1000', val: 1000 },
                { key: 'b500', val: 500 },
                { key: 'b100', val: 100 },
                { key: 'b50', val: 50 },
                { key: 'b20', val: 20 },
                { key: 'c10', val: 10 },
                { key: 'c5', val: 5 },
                { key: 'c1', val: 1 }
            ];
            
            const newBalance = { ...drawerBalance.value };
            let amountDeducted = 0;
            
            for (const d of denoms) {
                if (amount >= d.val && newBalance[d.key] > 0) {
                    const needed = Math.floor(amount / d.val);
                    const take = Math.min(needed, newBalance[d.key]);
                    newBalance[d.key] -= take;
                    amount -= (take * d.val);
                    amountDeducted += (take * d.val);
                }
            }
            
            // Update DB with new balance
            try {
                const { error } = await supabase.from('drawer_balance').update({
                    b1000: newBalance.b1000,
                    b500: newBalance.b500,
                    b100: newBalance.b100,
                    b50: newBalance.b50,
                    b20: newBalance.b20,
                    c10: newBalance.c10,
                    c5: newBalance.c5,
                    c1: newBalance.c1,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
                
                if (!error) {
                    drawerBalance.value = newBalance;
                    await logDrawerAction('TRANSACTION_DEDUCT', -amountDeducted, oldBalance, newBalance, transactionId);
                }
            } catch (err) {
                 console.error("Exception deducting drawer balance:", err);
            }
            return oldBalance;
        };

        const restoreDrawerBalance = async (totalAmount, transactionId = null) => {
            let amount = Math.ceil(totalAmount);
            if (amount <= 0) return;
            
            // Reload fresh balance before adding
            await loadDrawerBalance();
            const oldBalance = { ...drawerBalance.value };
            const newBalance = { ...drawerBalance.value };
            let amountRestored = 0;
            let exactRestoreDone = false;
            
            if (transactionId) {
                // Try to find the exact deduction from drawer_logs
                const { data: logs, error } = await supabase
                    .from('drawer_logs')
                    .select('*')
                    .or(`id.eq.${transactionId},reference_id.eq.${transactionId}`)
                    .lte('amount', 0)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!error && logs && logs.length > 0) {
                    const log = logs[0];
                    if (log.old_balance && log.new_balance) {
                        const denomKeys = ['b1000', 'b500', 'b100', 'b50', 'b20', 'c10', 'c5', 'c1'];
                        let diffTotal = 0;
                        const toRestore = {};
                        
                        for (const k of denomKeys) {
                            const diff = (log.old_balance[k] || 0) - (log.new_balance[k] || 0);
                            if (diff > 0) {
                                toRestore[k] = diff;
                                const val = parseInt(k.replace(/[a-zA-Z]/g, ''));
                                diffTotal += (diff * val);
                            } else {
                                toRestore[k] = 0;
                            }
                        }
                        
                        // Verify that the exact bills match the refund amount
                        if (diffTotal === amount) {
                            for (const k of denomKeys) {
                                newBalance[k] += toRestore[k];
                            }
                            amountRestored = diffTotal;
                            amount = 0;
                            exactRestoreDone = true;
                        }
                    }
                }
            }
            
            if (!exactRestoreDone) {
                // Greedy addition fallback
                const denoms = [
                    { key: 'b1000', val: 1000 },
                    { key: 'b500', val: 500 },
                    { key: 'b100', val: 100 },
                    { key: 'b50', val: 50 },
                    { key: 'b20', val: 20 },
                    { key: 'c10', val: 10 },
                    { key: 'c5', val: 5 },
                    { key: 'c1', val: 1 }
                ];
                
                for (const d of denoms) {
                    if (amount >= d.val) {
                        const addNotes = Math.floor(amount / d.val);
                        newBalance[d.key] += addNotes;
                        amount -= (addNotes * d.val);
                        amountRestored += (addNotes * d.val);
                    }
                }
            }
            
            // Update DB with new balance
            try {
                const { error } = await supabase.from('drawer_balance').update({
                    b1000: newBalance.b1000,
                    b500: newBalance.b500,
                    b100: newBalance.b100,
                    b50: newBalance.b50,
                    b20: newBalance.b20,
                    c10: newBalance.c10,
                    c5: newBalance.c5,
                    c1: newBalance.c1,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
                
                if (!error) {
                    drawerBalance.value = newBalance;
                    await logDrawerAction('TRANSACTION_RESTORE', amountRestored, oldBalance, newBalance, transactionId);
                }
            } catch (err) {
                 console.error("Exception restoring drawer balance:", err);
            }
        };

        const refundDrawerLog = async (log) => {
            if (!isAdmin.value) return;
            
            // Only allow refunding negative amounts (money taken out)
            if (log.amount >= 0) {
                await showAppModal('alert', 'ไม่สามารถทำรายการได้', 'สามารถคืนเงินได้เฉพาะรายการที่มีการนำเงินออกเท่านั้น');
                return;
            }
            
            const amountToRefund = Math.abs(log.amount);
            
            const confirm = await showAppModal('prompt', 'ยืนยันการคืนเงิน', `ต้องการคืนเงินจำนวน ${formatCurrency(amountToRefund)} บาท เข้าลิ้นชักใช่หรือไม่?\n\n(อ้างอิงรายการ: ${log.action})`, [], 'ยืนยัน', 'ยกเลิก');
            if (!confirm) return;
            
            try {
                savingDrawer.value = true;
                // Use action TRANSACTION_RESTORE for refund, or create a new action type like REFUND if needed, 
                // but restoreDrawerBalance already logs it as TRANSACTION_RESTORE
                await restoreDrawerBalance(amountToRefund, log.reference_id || log.id);
                await loadDrawerLogs();
                await showAppModal('alert', 'สำเร็จ', `คืนเงินจำนวน ${formatCurrency(amountToRefund)} บาท เข้าลิ้นชักเรียบร้อยแล้ว`);
            } catch (err) {
                console.error("Error refunding:", err);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ไม่สามารถคืนเงินได้: ' + err.message);
            } finally {
                savingDrawer.value = false;
            }
        };

        // DB Data
        const premiums = ref([
            { id: 1, range_min: 0, range_max: 29, premium_amount: 0, premium_percent: 0, premium_type: 'fixed', label: '<30%' },
            { id: 2, range_min: 30, range_max: 49, premium_amount: 0, premium_percent: 0, premium_type: 'fixed', label: '30-49%' },
            { id: 3, range_min: 50, range_max: 69, premium_amount: 0, premium_percent: 0, premium_type: 'fixed', label: '50-69%' },
            { id: 4, range_min: 70, range_max: 98, premium_amount: 0, premium_percent: 0, premium_type: 'fixed', label: '70-98%' },
            { id: 5, range_min: 99, range_max: 100, premium_amount: 0, premium_percent: 0, premium_type: 'fixed', label: '99%' }
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
        const toggleGoldCategory = () => {
            const goldTypes = ['tong_lom', 'tong_roop', 'tong_tang', 'redeem'];
            const allGoldSelected = goldTypes.every(t => filter.value.type.includes(t));
            
            if (allGoldSelected) {
                // Remove all gold types
                filter.value.type = filter.value.type.filter(t => !goldTypes.includes(t));
            } else {
                // Add all gold types
                filter.value.type = [...new Set([...filter.value.type, ...goldTypes])];
            }
        };

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
        const transferAmount = ref(0);

        // Calculator Form
        const calcForm = ref({
            type: 'tong_lom',
            weight: null,
            percent: null,
            customerName: '',
            phone: '',
            customerTier: 'normal',
            idCard: '',
            address: '',
            idCardPhoto: '',
            expireDate: '',
            manualPrice: null,
            manualPremium: null
        });
        const isOldCustomer = ref(false);

        const resetForm = () => {
            calcForm.value.type = 'tong_lom';
            calcForm.value.weight = null;
            calcForm.value.percent = null;
            calcForm.value.customerName = '';
            calcForm.value.phone = '';
            calcForm.value.idCard = '';
            calcForm.value.address = '';
            calcForm.value.idCardPhoto = '';
            calcForm.value.expireDate = '';
            calcForm.value.manualPrice = null;
            calcForm.value.manualPremium = null;
            transferAmount.value = 0;
            clearSignature();
            isOldCustomer.value = false;
        };

        const formatThaiDate = (dateStr) => {
            if (!dateStr || dateStr.length !== 10) return dateStr;
            const [y, m, d] = dateStr.split('-');
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;
        };

        const formatThaiDateTime = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear() + 543;
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            } catch (e) {
                return dateStr;
            }
        };

        const isPhoneValid = computed(() => {
            return /^0\d{9}$/.test(calcForm.value.phone);
        });

        const isIdCardValid = computed(() => {
            const id = calcForm.value.idCard;
            if (!id) return true;
            if (!/^\d{13}$/.test(id)) return false;

            // Official Thai ID Checksum Verification
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(id.charAt(i)) * (13 - i);
            }
            const checkDigit = (11 - (sum % 11)) % 10;
            return parseInt(id.charAt(12)) === checkDigit;
        });

        const isCardExpired = computed(() => {
            if (!calcForm.value.expireDate) return false;
            try {
                const cardDate = new Date(calcForm.value.expireDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Check by day
                return cardDate < today;
            } catch (e) {
                return false;
            }
        });

        const isMerchantCustomer = computed(() => {
            const tier = calcForm.value.customerTier;
            const isTierMerchant = tier === 'vip' || tier === 'vvip' || tier === 'network' || tier === 'network_vip';
            const isNameMerchant = Boolean(calcForm.value.customerName && calcForm.value.customerName.includes('พ่อค้า'));
            return isTierMerchant || isNameMerchant;
        });

        const isPercentValid = computed(() => {
            const type = calcForm.value.type;
            if (type === 'redeem' || type === 'tong_tang') {
                return true;
            }
            if (calcForm.value.percent === null || calcForm.value.percent === undefined || calcForm.value.percent === '') {
                return false;
            }
            const num = Number(calcForm.value.percent);
            if (isNaN(num) || num <= 0 || num > 100) {
                return false;
            }

            // บังคับพนักงานกรอกทศนิยม 2 ตำแหน่งเมื่อเป็นทองหลอมและลูกค้าเป็นพ่อค้า
            if (!isAdmin.value && type === 'tong_lom' && isMerchantCustomer.value) {
                const strVal = String(calcForm.value.percent).trim();
                return /^\d+(\.\d{2})$/.test(strVal);
            }

            return true;
        });

        const isWeightValid = computed(() => {
            const w = calcForm.value.weight;
            if (w === null || w === undefined || w === '') return false;
            const num = Number(w);
            if (isNaN(num) || num <= 0) return false;

            // บังคับพนักงานกรอกทศนิยม 1 ตำแหน่งเมื่อเป็นเงินและลูกค้าเป็นพ่อค้า
            if (!isAdmin.value && calcForm.value.type === 'silver' && isMerchantCustomer.value) {
                const strVal = String(w).trim();
                return /^\d+(\.\d{1})$/.test(strVal);
            }

            return true;
        });

        const isBaseValid = computed(() => {
            return isWeightValid.value && isPercentValid.value;
        });

        const isFormValid = computed(() => {
            const baseValid = isBaseValid.value;

            if (isLoggedIn.value) {
                // Admin bypass: can evaluate and add to bill even if incomplete
                if (isAdmin.value) {
                    return baseValid && isIdCardValid.value;
                }

                // Must have name and valid ID format
                const identityValid = isIdCardValid.value && calcForm.value.customerName.trim().length > 1;

                // Employee mode must have Phone, Photo, and Signature to add to bill
                const hasPhone = isPhoneValid.value;
                const hasPhoto = productPhoto.value !== null;
                const hasSignature = (signaturePad && !signaturePad.isEmpty()) || lastSignature.value !== null;

                return baseValid && identityValid && hasPhone && hasPhoto && hasSignature;
            }
            return baseValid;
        });

        const currentAssetPrice = computed(() => {
            if (calcForm.value.type === 'tong_lom' || calcForm.value.type === 'tong_roop' || calcForm.value.type === 'tong_tang' || calcForm.value.type === 'redeem') {
                return Number(goldPrice.value) || 0;
            } else if (calcForm.value.type === 'silver') {
                const multiplier = useSilverDeduction.value ? (100 - (Number(silverDeduction.value) || 0)) / 100 : 1;
                let price = Math.floor((Number(manualSilverPrice.value) || 0) * multiplier);
                
                if (calcForm.value.customerTier === 'vip') {
                    price += (Number(silverPremiumAmountVip.value) || 0);
                } else if (calcForm.value.customerTier === 'vvip') {
                    price += (Number(silverPremiumAmountVvip.value) || 0);
                } else if (calcForm.value.customerTier === 'network') {
                    price += (Number(silverPremiumAmountNetwork.value) || 0);
                } else if (calcForm.value.customerTier === 'network_vip') {
                    price += (Number(silverPremiumAmountNetworkVip.value) || 0);
                }
                
                return price;
            }
            return 0;
        });

        watch(() => calcForm.value.type, (newType) => {
            calcForm.value.manualPrice = null;
            if (newType === 'tong_roop') {
                calcForm.value.percent = isMerchantCustomer.value ? '96.50' : '96';
            } else if (newType === 'redeem' || newType === 'tong_tang') {
                calcForm.value.percent = null;
            }
        });

        watch(isMerchantCustomer, (isMerchant) => {
            if (calcForm.value.type === 'tong_roop') {
                if (isMerchant && (calcForm.value.percent === '96.00' || calcForm.value.percent === '96' || !calcForm.value.percent)) {
                    calcForm.value.percent = '96.50';
                } else if (!isMerchant && (calcForm.value.percent === '96.50' || calcForm.value.percent === '96.5')) {
                    calcForm.value.percent = '96';
                }
            }
        });

        // Enforce integer for percent (all types) and 2 decimals for weight (all types)
        watch(() => calcForm.value.percent, (val, oldVal) => {
            if (val !== null && val !== undefined && val !== '') {
                // If it's a string, clean up any invalid characters (keep only numbers and one decimal point)
                let strVal = String(val).trim();
                
                // Remove any character that is not a digit or decimal point
                strVal = strVal.replace(/[^0-9.]/g, '');
                
                // Keep only the first decimal point
                const dotIndex = strVal.indexOf('.');
                if (dotIndex !== -1) {
                    strVal = strVal.substring(0, dotIndex + 1) + strVal.substring(dotIndex + 1).replace(/\./g, '');
                }

                if (strVal === '') {
                    if (val !== '') calcForm.value.percent = '';
                    return;
                }

                let num = parseFloat(strVal);
                if (isNaN(num)) {
                    if (val !== '') calcForm.value.percent = '';
                    return;
                }

                if (num > 100) {
                    calcForm.value.percent = 100;
                    return;
                }

                const isPremium = isMerchantCustomer.value;
                const type = calcForm.value.type;

                let allowDecimal = false;
                if (isAdmin.value) {
                    allowDecimal = true;
                } else if (type === 'tong_roop') {
                    allowDecimal = true;
                } else if (type === 'tong_lom' && isPremium) {
                    allowDecimal = true;
                }

                if (allowDecimal) {
                    // Allow decimals up to 2 places, max 100
                    if (strVal.includes('.')) {
                        const parts = strVal.split('.');
                        if (parts[1] && parts[1].length > 2) {
                            strVal = parts[0] + '.' + parts[1].substring(0, 2);
                        }
                    }
                    if (val !== strVal) calcForm.value.percent = strVal;
                } else {
                    // Enforce integer, max 100
                    if (num < 1 && num > 0) num = 1;
                    const intStr = String(Math.floor(num));
                    if (val !== intStr) calcForm.value.percent = intStr;
                }
            }
        });

        watch([() => calcForm.value.weight, () => calcForm.value.type, () => calcForm.value.customerTier, () => calcForm.value.customerName], ([w, t, tier]) => {
            if (w !== null && w !== undefined && w !== '') {
                // If it's a string, clean up any invalid characters (keep only numbers and one decimal point)
                let strVal = String(w).trim().replace(/[^0-9.]/g, '');
                const dotIndex = strVal.indexOf('.');
                if (dotIndex !== -1) {
                    strVal = strVal.substring(0, dotIndex + 1) + strVal.substring(dotIndex + 1).replace(/\./g, '');
                }

                if (strVal === '') {
                    if (w !== '') calcForm.value.weight = '';
                    return;
                }

                let numW = parseFloat(strVal);
                if (isNaN(numW)) {
                    if (w !== '') calcForm.value.weight = '';
                    return;
                }

                // พนักงานให้กรอกทศนิยม 2 ตำแหน่งได้เฉพาะลูกค้า VIP/VVIP/Network/Network VIP/ชื่อพ่อค้า หรือ ทองหลอม/ทองแท่ง ส่วน Admin ได้ 2 ตำแหน่งเสมอ
                // แต่ถ้าเป็นเงิน (silver) ของพ่อค้า ให้จำกัดทศนิยม 1 ตำแหน่ง
                let decimalPoints = 1;
                if (t === 'silver' && isMerchantCustomer.value) {
                    decimalPoints = 1;
                } else if (isAdmin.value || isMerchantCustomer.value || t === 'tong_lom' || t === 'tong_tang') {
                    decimalPoints = 2;
                }

                if (strVal.includes('.')) {
                    const parts = strVal.split('.');
                    if (parts[1] && parts[1].length > decimalPoints) {
                        strVal = parts[0] + '.' + parts[1].substring(0, decimalPoints);
                    }
                }
                if (w !== strVal) calcForm.value.weight = strVal;
            }
        });

        const accumulatedGoldWeight = computed(() => {
            return billItems.value
                .filter(item => item.type !== 'silver')
                .reduce((sum, item) => sum + Number(item.weight), 0);
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
                // ทองหลอมถ้าน้ำหนักรวม >= 5 กรัม หรือเป็นลูกค้าเก่า ให้บวกพรีเมียม
                const totalWeightForPremium = accumulatedGoldWeight.value + w;
                const isVipOrVvip = (tForm.customerTier === 'vip' || tForm.customerTier === 'vvip' || tForm.customerTier === 'network' || tForm.customerTier === 'network_vip');
                const meetsWeightReq = isVipOrVvip || totalWeightForPremium >= 5 || isOldCustomer.value;
                
                let rawPremium = 0;
                let rawPercent = 0;

                let premiumType = 'fixed';

                if (tForm.customerTier === 'network' && meetsWeightReq) {
                    if (p >= 25 && p < 50) {
                        rawPremium = Number(networkGoldPremiumAmount_25_49.value) || 0;
                        rawPercent = Number(networkGoldPremiumPercent_25_49.value) || 0;
                    } else if (p >= 50 && p <= 100) {
                        rawPremium = Number(networkGoldPremiumAmount_50_100.value) || 0;
                        rawPercent = Number(networkGoldPremiumPercent_50_100.value) || 0;
                    }
                    premiumType = rawPercent > 0 ? 'percent' : 'fixed';
                } else if (tForm.customerTier === 'network_vip' && meetsWeightReq) {
                    if (p >= 25 && p < 50) {
                        rawPremium = Number(networkVipGoldPremiumAmount_25_49.value) || 0;
                        rawPercent = Number(networkVipGoldPremiumPercent_25_49.value) || 0;
                    } else if (p >= 50 && p <= 100) {
                        rawPremium = Number(networkVipGoldPremiumAmount_50_100.value) || 0;
                        rawPercent = Number(networkVipGoldPremiumPercent_50_100.value) || 0;
                    }
                    premiumType = rawPercent > 0 ? 'percent' : 'fixed';
                } else if (activePremium && meetsWeightReq) {
                    premiumType = activePremium.premium_type;
                    if (tForm.customerTier === 'vip') {
                        rawPremium = Number(activePremium.premium_amount_vip) || 0;
                        rawPercent = Number(activePremium.premium_percent_vip) || 0;
                    } else if (tForm.customerTier === 'vvip') {
                        rawPremium = Number(activePremium.premium_amount_vvip) || 0;
                        rawPercent = Number(activePremium.premium_percent_vvip) || 0;
                    } else {
                        rawPremium = Number(activePremium.premium_amount) || 0;
                        rawPercent = Number(activePremium.premium_percent) || 0;
                    }
                }
                
                if (premiumType === 'percent' && meetsWeightReq) {
                    premium = Math.floor(base * (rawPercent / 100));
                } else {
                    premium = rawPremium;
                }
                
                if (isAdmin.value && tForm.manualPremium !== null && tForm.manualPremium !== '') {
                    premium = Number(tForm.manualPremium);
                }

                const perGram = floor2((base + premium) * 0.0656);
                const withPurity = floor2(perGram * (p / 100));
                net = floor2(withPurity * w);
            } else if (tForm.type === 'tong_roop') {
                base = gp;
                const baseAfterPercent = floor2(base * (p / 100));
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
                net = floor2(perGram * w);
            } else if (tForm.type === 'silver') {
                const deduct13 = sp;
                base = deduct13;
                
                premium = 0;

                if (isAdmin.value && tForm.manualPremium !== null && tForm.manualPremium !== '') {
                    premium = Number(tForm.manualPremium);
                }

                const perGram = Math.floor((base + premium) / 1000);
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
            if (!isFormValid.value) {
                if (!isAdmin.value && calcForm.value.type === 'tong_lom' && isMerchantCustomer.value && !isPercentValid.value) {
                    showAppModal('alert', 'แจ้งเตือน', 'สำหรับลูกค้าพ่อค้า ต้องกรอกความบริสุทธิ์ (%) ของทองหลอมเป็นทศนิยม 2 ตำแหน่ง (เช่น 96.50 หรือ 96.00) ก่อนเพิ่มเข้าบิล');
                } else if (!isAdmin.value && calcForm.value.type === 'silver' && isMerchantCustomer.value && !isWeightValid.value) {
                    showAppModal('alert', 'แจ้งเตือน', 'สำหรับลูกค้าพ่อค้า ต้องกรอกน้ำหนักของเงินเป็นทศนิยม 1 ตำแหน่ง (เช่น 100.0 หรือ 50.5) ก่อนเพิ่มเข้าบิล');
                }
                return;
            }
            const isEditing = false; // We can add edit logic later if needed
            
            billItems.value.push({
                id: Date.now() + Math.random(),
                type: calcForm.value.type,
                percent: (calcForm.value.type === 'redeem' || calcForm.value.type === 'tong_tang') ? 96.5 : Number(calcForm.value.percent),
                weight: Number(calcForm.value.weight),
                basePrice: calculatedResult.value.basePrice,
                premium: calculatedResult.value.premium,
                netPrice: calculatedResult.value.netPrice,
                customerName: calcForm.value.customerName,
                phone: calcForm.value.phone,
                idCard: calcForm.value.idCard,
                address: calcForm.value.address
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

        const cashAmountToPay = computed(() => {
            return Math.max(0, billTotal.value - (transferAmount.value || 0));
        });

        const isPrintReady = computed(() => {
            if (billItems.value.length === 0) return false;

            // Admin bypass: Admin can bypass Phone/Photo/Sign but MUST have a valid ID format if entered
            if (isAdmin.value) return isIdCardValid.value;

            // Guest mode: Only check if items exist
            if (!isLoggedIn.value) return billItems.value.length > 0;

            // Employee mode: Check Phone, Photo and Signature
            const hasPhone = isPhoneValid.value;
            const hasPhoto = productPhoto.value !== null;
            const hasSignature = (signaturePad && !signaturePad.isEmpty()) || lastSignature.value !== null;

            return hasPhone && hasPhoto && hasSignature;
        });

        const formatCurrency = (val) => {
            if (val === null || val === undefined || val === '') return '0.00';
            const num = Number(val);
            if (isNaN(num)) return '0.00';
            return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleString('th-TH');
        };

        const formatPricePerGram = (val, type) => {
            const digits = type === 'silver' ? 0 : 2;
            if (val === null || val === undefined || val === '') return digits === 0 ? '0' : '0.00';
            const num = Number(val);
            if (isNaN(num)) return digits === 0 ? '0' : '0.00';
            return num.toLocaleString('th-TH', {
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
            const canvas = document.getElementById('signature-pad-modal');

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

                // Create fresh instance with standard pen for signing
                signaturePad = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: 'rgb(0, 51, 153)', // Royal Blue
                    minWidth: 0.5,  // Standard for natural signing
                    maxWidth: 2.5,  // Standard for natural signing
                    velocityFilterWeight: 0.7
                });

                signaturePad.addEventListener("beginStroke", () => {
                    modalHasSignature.value = true;
                });
            } else if (retries < 30) {
                // Keep trying every 100ms for up to 3 seconds (to cover slow transitions)
                setTimeout(() => initSignaturePad(retries + 1), 100);
            }
        };

        const openSignatureModal = () => {
            showSignatureModal.value = true;
            modalHasSignature.value = lastSignature.value !== null;
            nextTick(() => {
                initSignaturePad();
                if (lastSignature.value && signaturePad) {
                    signaturePad.fromDataURL(lastSignature.value);
                }
            });
        };

        const closeSignatureModal = () => {
            showSignatureModal.value = false;
        };

        const saveModalSignature = () => {
            if (signaturePad && !signaturePad.isEmpty()) {
                // Auto-scale to fill the box if requested
                try {
                    const data = signaturePad.toData();
                    if (data && data.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                        // 1. Find bounding box
                        data.forEach(stroke => {
                            stroke.points.forEach(point => {
                                if (point.x < minX) minX = point.x;
                                if (point.y < minY) minY = point.y;
                                if (point.x > maxX) maxX = point.x;
                                if (point.y > maxY) maxY = point.y;
                            });
                        });

                        const sigW = maxX - minX;
                        const sigH = maxY - minY;

                        // Check if signature has some size (not just a single dot)
                        if (sigW > 5 && sigH > 5) {
                            const canvas = signaturePad.canvas;
                            const padding = 20; // px padding
                            const availableW = canvas.offsetWidth - (padding * 2);
                            const availableH = canvas.offsetHeight - (padding * 2);

                            // 2. Calculate scale factors (preserve aspect ratio)
                            const scale = Math.min(availableW / sigW, availableH / sigH);

                            // Apply scaling to points
                            const newData = data.map(stroke => {
                                return {
                                    ...stroke,
                                    points: stroke.points.map(point => ({
                                        ...point,
                                        // Push space to the top, but slightly less than before (0.65 for a better balance)
                                        x: (point.x - minX) * scale + (canvas.offsetWidth - sigW * scale) / 2,
                                        y: (point.y - minY) * scale + (canvas.offsetHeight - sigH * scale) * 0.65
                                    }))
                                };
                            });

                            // 3. Temporarily set to BOLD settings for the final receipt output
                            signaturePad.minWidth = 2.5;
                            signaturePad.maxWidth = 5.5;

                            // 4. Update pad with scaled data (this triggers a redraw with the bold settings)
                            signaturePad.fromData(newData);
                        }
                    }
                } catch (err) {
                    console.error('Error scaling signature:', err);
                    // Fallback to original if scaling fails
                }

                lastSignature.value = signaturePad.toDataURL();
                showSignatureModal.value = false;
            } else {
                alert('กรุณาลงลายเซ็นก่อนยืนยัน');
            }
        };

        const clearModalSignature = () => {
            if (signaturePad) {
                signaturePad.clear();
                modalHasSignature.value = false;
            }
        };

        const clearSignature = () => {
            lastSignature.value = null;
            if (signaturePad) {
                signaturePad.clear();
                modalHasSignature.value = false;
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

        // --- Price Edit Requests ---
        const priceEditStatus = ref(null); // null, 'pending', 'approved', 'rejected'
        const currentPriceEditRequestId = ref(null);
        const adminPendingRequests = ref([]);
        
        const requestPriceEdit = async () => {
            if (!user.value || isAdmin.value) return;
            priceEditStatus.value = 'pending';
            const { data, error } = await supabase.from('price_edit_requests').insert({
                status: 'pending'
            }).select().single();
            
            if (data) {
                currentPriceEditRequestId.value = data.id;
                
                if (lineNotifyToken.value) {
                    const employeeName = user.value.email ? user.value.email.split('@')[0] : 'พนักงาน';
                    let notifyMsg = `\n🔔 ขออนุมัติแก้ไขราคาทอง\n`;
                    notifyMsg += `พนักงาน: ${employeeName}\n`;
                    notifyMsg += `กรุณาตรวจสอบในระบบ`;
                    sendLineNotify(notifyMsg);
                }
            } else if (error) {
                console.error("Error requesting price edit:", error);
                priceEditStatus.value = null;
            }
        };

        const approvePriceEdit = async (id) => {
            await supabase.from('price_edit_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id);
        };
        
        const rejectPriceEdit = async (id) => {
            await supabase.from('price_edit_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id);
        };

        const setupRealtimeRequests = () => {
            supabase.channel('price_edit_requests')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'price_edit_requests' }, payload => {
                    const req = payload.new;
                    
                    if (isAdmin.value) {
                        if (payload.eventType === 'INSERT' && req.status === 'pending') {
                            adminPendingRequests.value.push(req);
                        } else if (payload.eventType === 'UPDATE') {
                            const index = adminPendingRequests.value.findIndex(r => r.id === req.id);
                            if (req.status !== 'pending') {
                                if (index !== -1) adminPendingRequests.value.splice(index, 1);
                            } else if (index === -1) {
                                adminPendingRequests.value.push(req);
                            }
                        } else if (payload.eventType === 'DELETE') {
                            adminPendingRequests.value = adminPendingRequests.value.filter(r => r.id !== payload.old.id);
                        }
                    } 
                    
                    if (!isAdmin.value && currentPriceEditRequestId.value === req.id && payload.eventType === 'UPDATE') {
                        priceEditStatus.value = req.status;
                        if (req.status === 'approved') {
                            // Don't show modal, just change UI state to avoid interrupting flow
                        } else if (req.status === 'rejected') {
                            currentPriceEditRequestId.value = null;
                            priceEditStatus.value = null;
                        }
                    }
                })
                .subscribe();
        };

        const loadPendingRequests = async () => {
            if (!isAdmin.value) return;
            const { data } = await supabase.from('price_edit_requests').select('*').eq('status', 'pending');
            if (data) {
                adminPendingRequests.value = data;
            }
        };

        // Auth
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            user.value = data.session?.user || null;
            if (user.value) {
                if (isAdmin.value && currentTab.value === 'history') loadTransactions();
                
                try {
                    setupRealtimeRequests();
                } catch (e) {
                    console.error('Error setting up realtime (checkAuth):', e);
                }
                
                if (isAdmin.value) {
                    try {
                        loadPendingRequests();
                    } catch (e) {
                        console.error('Error loading pending requests (checkAuth):', e);
                    }
                }
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
                if (isAdmin.value && currentTab.value === 'history') loadTransactions();
                
                try {
                    setupRealtimeRequests();
                } catch (e) {
                    console.error('Error setting up realtime:', e);
                }
                
                if (isAdmin.value) {
                    try {
                        loadPendingRequests();
                    } catch (e) {
                        console.error('Error loading pending requests:', e);
                    }
                }
                
                showAuth.value = false;
                currentTab.value = 'calculator';
                await showAppModal('alert', 'สำเร็จ', 'เข้าสู่ระบบสำเร็จ');
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
            console.log("Loading settings and premiums...");
            try {
                // Load Gold Premiums
                const { data: goldData, error: goldError } = await supabase.from('gold_premiums').select('*').order('range_min', { ascending: true });
                if (goldError) {
                    console.error("Gold premiums fetch error:", goldError.message);
                } else if (goldData && goldData.length) {
                    premiums.value = goldData.map(p => ({
                        ...p,
                        premium_percent: p.premium_percent || 0,
                        premium_type: p.premium_type || 'fixed',
                        premium_amount_vip: p.premium_amount_vip || 0,
                        premium_percent_vip: p.premium_percent_vip || 0,
                        premium_amount_vvip: p.premium_amount_vvip || 0,
                        premium_percent_vvip: p.premium_percent_vvip || 0
                    }));
                    console.log("Gold premiums loaded:", goldData.length, "rows");
                }

                // Load Global Settings (Silver Deduction)
                const { data: settingsData, error: settingsError } = await supabase.from('global_settings').select('*');
                if (settingsError) {
                    console.error("Global settings fetch error:", settingsError.message);
                } else if (settingsData) {
                    const lateRateSetting = settingsData.find(s => s.key === 'late_deduction_rate');
                    if (lateRateSetting && lateRateSetting.value !== null) {
                        lateDeductionRate.value = Number(lateRateSetting.value);
                    }
                    const lineNotifySetting = settingsData.find(s => s.key === 'line_channel_access_token');
                    if (lineNotifySetting && lineNotifySetting.value_text) {
                        lineNotifyToken.value = lineNotifySetting.value_text;
                    }
                    const lineTargetSetting = settingsData.find(s => s.key === 'line_target_id');
                    if (lineTargetSetting && lineTargetSetting.value_text) {
                        lineTargetId.value = lineTargetSetting.value_text;
                    }
                    const silverSetting = settingsData.find(s => s.key === 'silver_deduction');
                    if (silverSetting && silverSetting.value !== null) {
                        silverDeduction.value = Number(silverSetting.value);
                        console.log("Silver deduction setting loaded:", silverDeduction.value);
                    }
                    const useDeductionSetting = settingsData.find(s => s.key === 'use_silver_deduction');
                    if (useDeductionSetting && useDeductionSetting.value !== null) {
                        useSilverDeduction.value = Number(useDeductionSetting.value) === 1;
                    }
                    const manualPriceSetting = settingsData.find(s => s.key === 'manual_silver_price');
                    if (manualPriceSetting && manualPriceSetting.value !== null) {
                        manualSilverPrice.value = Number(manualPriceSetting.value);
                    }
                    const useManualSetting = settingsData.find(s => s.key === 'use_manual_silver_price');
                    if (useManualSetting && useManualSetting.value !== null) {
                        useManualSilverPrice.value = Number(useManualSetting.value) === 1;
                    }
                    const employeeSilverUpdateSetting = settingsData.find(s => s.key === 'employee_last_silver_update');
                    if (employeeSilverUpdateSetting && employeeSilverUpdateSetting.value !== null) {
                        employeeLastSilverUpdate.value = employeeSilverUpdateSetting.value;
                    }

                    const getSetting = (k, def) => {
                        const s = settingsData.find(s => s.key === k);
                        return (s && s.value !== null) ? Number(s.value) : def;
                    };
                    silverPremiumAmountVip.value = getSetting('silver_premium_amount_vip', 0);
                    silverPremiumAmountVvip.value = getSetting('silver_premium_amount_vvip', 0);
                    silverPremiumAmountNetwork.value = getSetting('silver_premium_amount_network', 0);
                    silverPremiumAmountNetworkVip.value = getSetting('silver_premium_amount_network_vip', 0);
                    
                    networkGoldPremiumAmount_25_49.value = getSetting('network_gold_amount_25_49', 0);
                    networkGoldPremiumPercent_25_49.value = getSetting('network_gold_percent_25_49', 0);
                    networkGoldPremiumAmount_50_100.value = getSetting('network_gold_amount_50_100', 0);
                    networkGoldPremiumPercent_50_100.value = getSetting('network_gold_percent_50_100', 0);

                    networkVipGoldPremiumAmount_25_49.value = getSetting('network_vip_gold_amount_25_49', 0);
                    networkVipGoldPremiumPercent_25_49.value = getSetting('network_vip_gold_percent_25_49', 0);
                    networkVipGoldPremiumAmount_50_100.value = getSetting('network_vip_gold_amount_50_100', 0);
                    networkVipGoldPremiumPercent_50_100.value = getSetting('network_vip_gold_percent_50_100', 0);
                }
                
                await loadPremiumCustomers();
            } catch (err) {
                console.error("Critical error loading premiums/settings:", err);
            } finally {
                loadingPremiums.value = false;
            }
        };

        const savePremiums = async () => {
            saving.value = true;
            // Save Gold Premiums
            for (const p of premiums.value) {
                if (p.id) {
                    await supabase.from('gold_premiums').update({ 
                        premium_amount: p.premium_amount,
                        premium_percent: p.premium_percent || 0,
                        premium_type: p.premium_type || 'fixed',
                        premium_amount_vip: p.premium_amount_vip || 0,
                        premium_percent_vip: p.premium_percent_vip || 0,
                        premium_amount_vvip: p.premium_amount_vvip || 0,
                        premium_percent_vvip: p.premium_percent_vvip || 0
                    }).eq('id', p.id);
                }
            }
            // Save Settings
            await supabase.from('global_settings').upsert([
                { key: 'silver_deduction', value: Number(silverDeduction.value) || 0 },
                { key: 'use_silver_deduction', value: useSilverDeduction.value ? 1 : 0 },
                { key: 'manual_silver_price', value: Number(manualSilverPrice.value) || 0 },
                { key: 'use_manual_silver_price', value: useManualSilverPrice.value ? 1 : 0 },
                { key: 'silver_premium_amount_vip', value: Number(silverPremiumAmountVip.value) || 0 },
                { key: 'silver_premium_amount_vvip', value: Number(silverPremiumAmountVvip.value) || 0 },
                { key: 'silver_premium_amount_network', value: Number(silverPremiumAmountNetwork.value) || 0 },
                { key: 'silver_premium_amount_network_vip', value: Number(silverPremiumAmountNetworkVip.value) || 0 },
                { key: 'network_gold_amount_25_49', value: Number(networkGoldPremiumAmount_25_49.value) || 0 },
                { key: 'network_gold_percent_25_49', value: Number(networkGoldPremiumPercent_25_49.value) || 0 },
                { key: 'network_gold_amount_50_100', value: Number(networkGoldPremiumAmount_50_100.value) || 0 },
                { key: 'network_gold_percent_50_100', value: Number(networkGoldPremiumPercent_50_100.value) || 0 },
                { key: 'network_vip_gold_amount_25_49', value: Number(networkVipGoldPremiumAmount_25_49.value) || 0 },
                { key: 'network_vip_gold_percent_25_49', value: Number(networkVipGoldPremiumPercent_25_49.value) || 0 },
                { key: 'network_vip_gold_amount_50_100', value: Number(networkVipGoldPremiumAmount_50_100.value) || 0 },
                { key: 'network_vip_gold_percent_50_100', value: Number(networkVipGoldPremiumPercent_50_100.value) || 0 }
            ]);

            saving.value = false;
            await showAppModal('alert', 'สำเร็จ', 'บันทึกการตั้งค่าสำเร็จ');
        };

        const saveAttendanceSettings = async () => {
            saving.value = true;
            try {
                await supabase.from('global_settings').upsert([
                    { key: 'late_deduction_rate', value: Number(lateDeductionRate.value) || 0 }
                ]);
                await showAppModal('alert', 'สำเร็จ', 'บันทึกการตั้งค่าลงเวลาสำเร็จ');
            } catch(e) {
                console.error(e);
                alert('เกิดข้อผิดพลาดในการบันทึก');
            } finally {
                saving.value = false;
            }
        };

        const saveLineNotifyToken = async () => {
            saving.value = true;
            try {
                await supabase.from('global_settings').upsert([
                    { key: 'line_channel_access_token', value: 0, value_text: lineNotifyToken.value || '' },
                    { key: 'line_target_id', value: 0, value_text: lineTargetId.value || '' }
                ]);
                await showAppModal('alert', 'สำเร็จ', 'บันทึกการตั้งค่า LINE สำเร็จ');
            } catch(e) {
                console.error(e);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกการตั้งค่า LINE ได้');
            } finally {
                saving.value = false;
            }
        };

        const sendLineNotify = async (message) => {
            if (!lineNotifyToken.value || !lineTargetId.value) return;
            try {
                await fetch('/api/line_notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: lineNotifyToken.value,
                        targetId: lineTargetId.value,
                        message: message
                    })
                });
            } catch(e) {
                console.error('LINE Notify Error:', e);
            }
        };

        const testLineNotify = async () => {
            testingLine.value = true;
            try {
                const res = await fetch('/api/line_notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: lineNotifyToken.value,
                        targetId: lineTargetId.value,
                        message: '✅ ทดสอบการเชื่อมต่อ LINE Messaging API จากระบบ Krit-Gold สำเร็จ!'
                    })
                });
                
                if (res.ok) {
                    await showAppModal('alert', 'สำเร็จ', 'ส่งข้อความทดสอบสำเร็จ กรุณาตรวจสอบใน LINE');
                } else {
                    const errorData = await res.json();
                    await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ส่งไม่สำเร็จ: ' + (errorData.error || res.statusText));
                }
            } catch(e) {
                console.error(e);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ API ได้');
            } finally {
                testingLine.value = false;
            }
        };

        const autoSaveSettings = async () => {
            if (isEmployee.value) return; // Employees should not auto-save, they must use the save button
            await supabase.from('global_settings').upsert([
                { key: 'silver_deduction', value: Number(silverDeduction.value) || 0 },
                { key: 'use_silver_deduction', value: useSilverDeduction.value ? 1 : 0 },
                { key: 'manual_silver_price', value: Number(manualSilverPrice.value) || 0 },
                { key: 'use_manual_silver_price', value: useManualSilverPrice.value ? 1 : 0 },
                { key: 'silver_premium_amount_vip', value: Number(silverPremiumAmountVip.value) || 0 },
                { key: 'silver_premium_amount_vvip', value: Number(silverPremiumAmountVvip.value) || 0 },
                { key: 'silver_premium_amount_network', value: Number(silverPremiumAmountNetwork.value) || 0 },
                { key: 'network_gold_amount_25_49', value: Number(networkGoldPremiumAmount_25_49.value) || 0 },
                { key: 'network_gold_percent_25_49', value: Number(networkGoldPremiumPercent_25_49.value) || 0 },
                { key: 'network_gold_amount_50_100', value: Number(networkGoldPremiumAmount_50_100.value) || 0 },
                { key: 'network_gold_percent_50_100', value: Number(networkGoldPremiumPercent_50_100.value) || 0 }
            ]);
            fetchPrices();
        };

        const saveSilverSettings = async () => {
            if (isEmployee.value) {
                if (isSilverPriceSetToday.value) {
                    await showAppModal('alert', 'ไม่สามารถตั้งค่าได้', 'พนักงานสามารถตั้งราคาซิลเวอร์ได้ 1 ครั้งต่อวันเท่านั้น');
                    return;
                }
                const todayStr = new Date().toLocaleDateString('en-CA');
                const todayNum = parseInt(todayStr.replace(/-/g, ''));
                
                saving.value = true;
                const { error } = await supabase.from('global_settings').upsert([
                    { key: 'manual_silver_price', value: Number(manualSilverPrice.value) || 0 },
                    { key: 'use_manual_silver_price', value: useManualSilverPrice.value ? 1 : 0 },
                    { key: 'employee_last_silver_update', value: todayNum }
                ]);
                
                if (error) {
                    saving.value = false;
                    await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกได้: ' + error.message);
                    return;
                }
                
                employeeLastSilverUpdate.value = todayNum;
                saving.value = false;
                await showAppModal('alert', 'สำเร็จ', 'พนักงานอัพเดทราคาซิลเวอร์ประจำวันสำเร็จ');
            } else {
                // Admin manually saves
                saving.value = true;
                await autoSaveSettings();
                saving.value = false;
                await showAppModal('alert', 'สำเร็จ', 'บันทึกการตั้งค่าราคาซิลเวอร์สำเร็จ');
            }
            fetchPrices();
        };

        let autoSaveTimeout;
        watch([
            silverDeduction, useSilverDeduction, manualSilverPrice, useManualSilverPrice, 
            silverPremiumAmountVip, silverPremiumAmountVvip, silverPremiumAmountNetwork, silverPremiumAmountNetworkVip,
            networkGoldPremiumAmount_25_49, networkGoldPremiumPercent_25_49, 
            networkGoldPremiumAmount_50_100, networkGoldPremiumPercent_50_100,
            networkVipGoldPremiumAmount_25_49, networkVipGoldPremiumPercent_25_49,
            networkVipGoldPremiumAmount_50_100, networkVipGoldPremiumPercent_50_100
        ], () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                autoSaveSettings();
            }, 500);
        });

        const searchOldCustomers = async () => {
            if (!customerSearchQuery.value) return;
            customerSearchAttempted.value = false;
            
            const { data, error } = await supabase
                .from('transactions')
                .select('id_card, customer_name')
                .or(`customer_name.ilike.%${customerSearchQuery.value}%,id_card.ilike.%${customerSearchQuery.value}%`)
                // Allow empty id_card, order by newest
                .order('created_at', { ascending: false });
                
            customerSearchAttempted.value = true;
            if (data) {
                const unique = [];
                const seen = new Set();
                for (const item of data) {
                    const uniqueKey = (item.id_card && item.id_card.trim() !== '') ? item.id_card : item.customer_name;
                    if (!seen.has(uniqueKey) && item.customer_name) {
                        seen.add(uniqueKey);
                        unique.push({ ...item, selectedTier: 'vip' });
                    }
                }
                adminCustomerSearchResults.value = unique.slice(0, 10);
            } else {
                adminCustomerSearchResults.value = [];
            }
        };

        const addCustomerTier = async (customer) => {
            if (!customer.customer_name || customer.customer_name.trim() === '') {
                await showAppModal('alert', 'ไม่สามารถเพิ่มได้', 'ลูกค้าจำเป็นต้องมีชื่อ');
                return;
            }
            
            let finalIdCard = customer.id_card;
            if (!finalIdCard || finalIdCard.trim() === '') {
                finalIdCard = 'NO_ID_' + customer.customer_name.trim();
            }

            const { error } = await supabase.from('customers').upsert({
                id_card: finalIdCard,
                customer_name: customer.customer_name,
                tier: customer.selectedTier
            });
            if (!error) {
                await showAppModal('alert', 'สำเร็จ', 'เพิ่มลูกค้าเรียบร้อยแล้ว');
                adminCustomerSearchResults.value = adminCustomerSearchResults.value.filter(c => c.id_card !== customer.id_card);
                await loadPremiumCustomers();
            } else {
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึก');
            }
        };

        const removeCustomerTier = async (id_card) => {
            if (!(await showAppModal('confirm', 'ยืนยัน', 'ยืนยันการลบลูกค้ารายนี้ออกจาก VIP/VVIP?'))) return;
            const { error } = await supabase.from('customers').delete().eq('id_card', id_card);
            if (!error) {
                await loadPremiumCustomers();
            }
        };

        const loadPremiumCustomers = async () => {
            const { data } = await supabase.from('customers')
                .select('*')
                .in('tier', ['vip', 'vvip', 'network', 'network_vip'])
                .order('updated_at', { ascending: false });
            if (data) {
                premiumCustomersList.value = data;
            }
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

            if (data) {
                transactions.value = data.map(t => {
                    const fixUrl = (url) => {
                        if (!url || url === 'null' || url === 'undefined' || typeof url !== 'string') return null;
                        if (url.startsWith('data:')) return url;
                        try {
                            const urlObj = new URL(url);
                            const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/(.*)/);
                            if (match && match[1]) {
                                return `${supabaseUrl}/storage/v1/object/public/${match[1]}`;
                            }
                            return url;
                        } catch(e) {
                            if (url.includes('storage/v1/object/public/')) {
                                const match = url.match(/\/storage\/v1\/object\/public\/(.*)/);
                                if (match && match[1]) return `${supabaseUrl}/storage/v1/object/public/${match[1]}`;
                            }
                            if (url.startsWith('transaction_assets/')) {
                                return `${supabaseUrl}/storage/v1/object/public/${url}`;
                            }
                            return `${supabaseUrl}/storage/v1/object/public/transaction_assets/${url}`;
                        }
                    };
                    t.signature = fixUrl(t.signature);
                    t.id_card_photo = fixUrl(t.id_card_photo);
                    t.photo = fixUrl(t.photo);
                    return t;
                });
            } else {
                transactions.value = [];
            }
            loadingTransactions.value = false;
        };

        const preloadImage = (url) => {
            return new Promise((resolve) => {
                if (!url || url.startsWith('data:')) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = url;
            });
        };

        const reprintGroup = async (g, clearAfter = false) => {
            const backupBillItems = [...billItems.value];
            const backupCalcForm = { ...calcForm.value };
            const backupTransferAmount = transferAmount.value;
            const backupSignature = lastSignature.value;
            
            billItems.value = g.items.map(t => ({
                id: t.id,
                type: t.type,
                weight: parseFloat(t.weight) || 0,
                percent: parseFloat(t.percent) || 0,
                basePrice: parseFloat(t.base_price) || 0,
                premium: parseFloat(t.premium_amount) || 0,
                netPrice: parseFloat(t.net_price) || 0
            }));

            pauseCustomerWatch = true;

            calcForm.value.customerName = g.customer_name || '';
            calcForm.value.phone = g.phone || '';
            calcForm.value.idCard = g.id_card || '';
            calcForm.value.address = g.address || '';
            
            transferAmount.value = g.items.reduce((sum, t) => sum + (parseFloat(t.transfer_amount) || 0), 0);
            lastSignature.value = g.signature ? fixUrl(g.signature) : null;

            await nextTick();
            await preloadImage(lastSignature.value);
            
            setTimeout(() => {
                let restored = false;
                const restoreData = () => {
                    if (restored) return;
                    restored = true;
                    window.removeEventListener('afterprint', restoreData);
                    document.removeEventListener('click', restoreData);
                    document.removeEventListener('touchstart', restoreData);
                    
                    // ALWAYS clear the form. Never restore backup data.
                    billItems.value = [];
                    transferAmount.value = 0;
                    resetForm();
                    clearSignature();
                    removePhoto();
                    
                    // Double ensure Vue reactivity queue is flushed
                    setTimeout(() => {
                        resetForm();
                        clearSignature();
                        removePhoto();
                        pauseCustomerWatch = false;
                    }, 500);
                };
                
                window.addEventListener('afterprint', restoreData);
                const mql = window.matchMedia('print');
                const mqlListener = (e) => {
                    if (!e.matches) {
                        restoreData();
                        mql.removeEventListener('change', mqlListener);
                    }
                };
                mql.addEventListener('change', mqlListener);
                
                const focusHandler = () => {
                    restoreData();
                    window.removeEventListener('focus', focusHandler);
                };
                setTimeout(() => {
                    window.addEventListener('focus', focusHandler);
                    // iOS fallback: user interacting with page means print dialog is closed
                    document.addEventListener('click', restoreData);
                    document.addEventListener('touchstart', restoreData);
                }, 1000);

                window.print();
                
                // Fallback for mobile
                setTimeout(restoreData, 15000);
            }, 200); // Already preloaded, short delay for layout
        };

        const reprintLatestReceipt = async () => {
            try {
                // Fetch the latest 10 transactions (to capture the whole bill)
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (error) throw error;
                if (!data || data.length === 0) {
                    await showAppModal('alert', 'ไม่พบข้อมูล', 'ไม่มีรายการล่าสุดให้ปริ้นย้อนหลัง');
                    return;
                }
                
                // Group them exactly like groupedTransactions
                const groups = {};
                data.forEach(t => {
                    const dateKey = t.created_at ? t.created_at.substring(0, 16) : 'unknown';
                    const key = `${dateKey}_${t.customer_name || 'noname'}_${t.phone || 'nophone'}`;
                    
                    if (!groups[key]) {
                        groups[key] = {
                            key: key,
                            ids: [],
                            created_at: t.created_at,
                            customer_name: t.customer_name,
                            phone: t.phone,
                            address: t.address,
                            signature: t.signature,
                            photo: t.photo,
                            id_card_photo: t.id_card_photo,
                            items: [],
                            net_price: 0
                        };
                    } else {
                        if (t.signature) groups[key].signature = t.signature;
                        if (t.photo) groups[key].photo = t.photo;
                        if (t.id_card_photo) groups[key].id_card_photo = t.id_card_photo;
                    }
                    groups[key].ids.push(t.id);
                    groups[key].items.push(t);
                    groups[key].net_price += parseFloat(t.net_price) || 0;
                });
                
                const groupList = Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                if (groupList.length > 0) {
                    await reprintGroup(groupList[0], true);
                }
            } catch (err) {
                console.error("Error reprinting latest receipt:", err);
                await showAppModal('alert', 'เกิดข้อผิดพลาด', 'ไม่สามารถปริ้นย้อนหลังได้: ' + err.message);
            }
        };

        const editTrxModal = ref({
            show: false,
            id: null,
            customer_name: '',
            phone: '',
            type: 'tong_lom',
            base_price: 0,
            premium_amount: 0,
            percent: 0,
            weight: 0,
            net_price: 0,
            original_net_price: 0
        });

        const calculateEditTrxNetPrice = () => {
            const tForm = editTrxModal.value;
            if (tForm.type === 'tong_roop' && (!tForm.percent || tForm.percent <= 0)) {
                tForm.percent = 96.00;
            }
            const w = Number(tForm.weight) || 0;
            const p = Number(tForm.percent) || 0;
            const base = Number(tForm.base_price) || 0;
            const premium = Number(tForm.premium_amount) || 0;
            let net = 0;

            const gp = Math.floor(base);

            if (tForm.type === 'tong_lom') {
                const perGram = floor2((gp + premium) * 0.0656);
                const withPurity = floor2(perGram * (p / 100));
                net = floor2(withPurity * w);
            } else if (tForm.type === 'tong_roop') {
                const baseAfterPercent = floor2(gp * (p / 100));
                const perGram = floor2(baseAfterPercent * 0.0656);
                net = floor2(perGram * w);
            } else if (tForm.type === 'redeem') {
                const baseAfterPercent = floor2(gp * 0.95);
                const perGram = floor2(baseAfterPercent * 0.0656);
                net = floor2(perGram * w);
            } else if (tForm.type === 'tong_tang') {
                const perGram = floor2((gp - 300) * 0.0656);
                net = floor2(perGram * w);
            } else if (tForm.type === 'silver') {
                const sp = gp;
                const perGram = Math.floor((sp + premium) / 1000);
                const withPercent = Math.floor(perGram * (p / 100));
                net = Math.floor(withPercent * w);
            }

            tForm.net_price = floor2(Math.max(0, net));
        };

        const onEditBasePrice = () => {
            const tForm = editTrxModal.value;
            const p = Number(tForm.percent) || 0;
            const base = Number(tForm.base_price) || 0;
            
            if (tForm.type === 'tong_lom') {
                let activePremium = premiums.value.find(pr => p >= pr.range_min && p <= pr.range_max);
                if (activePremium) {
                    if (activePremium.premium_type === 'percent') {
                        tForm.premium_amount = Math.floor(Math.floor(base) * (Number(activePremium.premium_percent) / 100));
                    }
                }
            }
            calculateEditTrxNetPrice();
        };

        const editTransaction = (t) => {
            const parsedPercent = parseFloat(t.percent);
            editTrxModal.value = {
                show: true,
                id: t.id,
                customer_name: t.customer_name || '',
                phone: t.phone || '',
                type: t.type || 'tong_lom',
                base_price: parseFloat(t.base_price) || 0,
                premium_amount: parseFloat(t.premium_amount) || 0,
                percent: (parsedPercent > 0) ? parsedPercent : (t.type === 'tong_roop' ? 96.00 : 0),
                weight: parseFloat(t.weight) || 0,
                net_price: parseFloat(t.net_price) || 0,
                original_net_price: parseFloat(t.net_price) || 0
            };
        };

        const saveEditTransaction = async () => {
            const tForm = editTrxModal.value;
            const diffAmount = tForm.original_net_price - tForm.net_price;

            let savePercent = Number(tForm.percent) || 0;
            if (['redeem', 'tong_tang'].includes(tForm.type)) {
                savePercent = 96.5;
            }

            let savePremium = Number(tForm.premium_amount) || 0;
            if (tForm.type !== 'tong_lom' && tForm.type !== 'silver') {
                savePremium = 0;
            }

            const basePrice = Number(tForm.base_price) || 0;
            const weight = Number(tForm.weight) || 0;
            const netPrice = Number(tForm.net_price) || 0;

            const { error } = await supabase.from('transactions').update({
                customer_name: tForm.customer_name,
                phone: tForm.phone,
                type: tForm.type,
                base_price: basePrice,
                premium_amount: savePremium,
                weight: weight,
                percent: savePercent,
                net_price: netPrice
            }).eq('id', tForm.id);

            if (!error) {
                if (diffAmount !== 0) {
                    await restoreDrawerBalance(diffAmount, tForm.id);
                }
                loadTransactions();
                loadDeliveryData(); // Refresh stock
                editTrxModal.value.show = false;
            } else {
                await showAppModal('alert', 'เกิดข้อผิดพลาด', error.message);
            }
        };

        const deleteTransaction = async (id) => {
            if (await showAppModal('confirm', 'ยืนยันการลบ', 'ยืนยันการลบรายการนี้ใช่หรือไม่?')) {
                const deleteAssets = await showAppModal('confirm', 'ลบภาพส่วนตัว', 'คุณต้องการลบภาพบัตรประชาชนและภาพลายเซ็นออกจากระบบด้วยหรือไม่?\n\n(กด ใช่ เพื่อลบรูปด้วย / กด ไม่ เพื่อเก็บรูปไว้)', [], 'ใช่', 'ไม่');
                // Fetch the transaction to get net_price and transfer_amount
                const { data: trx } = await supabase.from('transactions').select('net_price, transfer_amount').eq('id', id).single();
                
                // Delete assets from storage first
                await deleteTransactionAssets(id, deleteAssets);
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (!error) {
                    if (trx && trx.net_price) {
                        const transferPart = Number(trx.transfer_amount || 0);
                        const cashRefund = Number(trx.net_price) - transferPart;
                        if (cashRefund > 0) {
                            if (await showAppModal('confirm', 'คืนเงินเข้าลิ้นชัก', `คุณต้องการคืนเงินสดจำนวน ${cashRefund} บาท เข้าลิ้นชักหรือไม่?\n\n(กดยกเลิก หากรายการนี้จ่ายเป็นเงินโอนและไม่ต้องการคืนเข้าลิ้นชัก)`)) {
                                await restoreDrawerBalance(cashRefund, id);
                            }
                        }
                    }
                    loadTransactions();
                }
                else await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาดในการลบ: ' + error.message);
            }
        };

        const deleteGroup = async (g) => {
            const ids = g.items.map(t => t.id);
            if (await showAppModal('confirm', 'ยืนยันการลบ', `ยืนยันการลบบิลนี้ (${g.items.length} รายการ) ใช่หรือไม่?`)) {
                const deleteAssets = await showAppModal('confirm', 'ลบภาพส่วนตัว', 'คุณต้องการลบภาพบัตรประชาชนและภาพลายเซ็นออกจากระบบด้วยหรือไม่?\n\n(กด ใช่ เพื่อลบรูปด้วย / กด ไม่ เพื่อเก็บรูปไว้)', [], 'ใช่', 'ไม่');
                // Fetch the transaction to get net_price and transfer_amount
                const { data: trxs } = await supabase.from('transactions').select('net_price, transfer_amount').in('id', ids);
                
                await deleteTransactionAssets(ids, deleteAssets);
                const { error } = await supabase.from('transactions').delete().in('id', ids);
                
                if (!error) {
                    if (trxs && trxs.length > 0) {
                        let totalRefund = 0;
                        trxs.forEach(trx => {
                            const transferPart = Number(trx.transfer_amount || 0);
                            const cashRefund = Number(trx.net_price) - transferPart;
                            if (cashRefund > 0) totalRefund += cashRefund;
                        });
                        if (totalRefund > 0) {
                            if (await showAppModal('confirm', 'คืนเงินเข้าลิ้นชัก', `คุณต้องการคืนเงินสดจำนวน ${totalRefund} บาท เข้าลิ้นชักหรือไม่?\n\n(กดยกเลิก หากรายการนี้จ่ายเป็นเงินโอนและไม่ต้องการคืนเข้าลิ้นชัก)`)) {
                                await restoreDrawerBalance(totalRefund);
                            }
                        }
                    }
                    loadTransactions();
                } else {
                    await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาดในการลบ: ' + error.message);
                }
            }
        };

        const deleteSelected = async () => {
            if (selectedTransactions.value.length === 0) return;
            if (await showAppModal('confirm', 'ยืนยันการลบ', `ยืนยันการลบรายการที่เลือกจำนวน ${selectedTransactions.value.length} รายการ ใช่หรือไม่?`)) {
                const deleteAssets = await showAppModal('confirm', 'ลบภาพส่วนตัว', 'คุณต้องการลบภาพบัตรประชาชนและภาพลายเซ็นออกจากระบบด้วยหรือไม่?\n\n(กด ใช่ เพื่อลบรูปด้วย / กด ไม่ เพื่อเก็บรูปไว้)', [], 'ใช่', 'ไม่');
                loadingTransactions.value = true;
                
                // Fetch to get net prices and transfer amounts
                const { data: trxs } = await supabase.from('transactions').select('net_price, transfer_amount').in('id', selectedTransactions.value);
                const totalRefund = trxs ? trxs.reduce((sum, t) => {
                    const transferPart = Number(t.transfer_amount || 0);
                    const cashPart = (Number(t.net_price) || 0) - transferPart;
                    return sum + (cashPart > 0 ? cashPart : 0);
                }, 0) : 0;

                // Delete assets from storage first
                await deleteTransactionAssets(selectedTransactions.value, deleteAssets);
                const { error } = await supabase
                    .from('transactions')
                    .delete()
                    .in('id', selectedTransactions.value);

                if (!error) {
                    if (totalRefund > 0) {
                        if (await showAppModal('confirm', 'คืนเงินเข้าลิ้นชัก', `คุณต้องการคืนเงินสดจำนวน ${totalRefund} บาท เข้าลิ้นชักหรือไม่?\n\n(กดยกเลิก หากรายการนี้จ่ายเป็นเงินโอนและไม่ต้องการคืนเข้าลิ้นชัก)`)) {
                            await restoreDrawerBalance(totalRefund);
                        }
                    }
                    selectedTransactions.value = [];
                    await loadTransactions();
                } else {
                    await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาดในการลบ: ' + error.message);
                    loadingTransactions.value = false;
                }
            }
        };

        const exportCSV = () => {
            if (transactions.value.length === 0) return;

            let csvContent = 'วันที่,เวลา,ลูกค้า,เบอร์โทรศัพท์,ที่อยู่,ประเภทสินทรัพย์,เปอร์เซ็นต์/น้ำหนัก,ยอดสุทธิ (บาท)\n';

            transactions.value.forEach(t => {
                const dt = new Date(t.created_at);
                const dDate = dt.toLocaleDateString('th-TH');
                const dTime = dt.toLocaleTimeString('th-TH');

                const name = `"${t.customer_name || 'เงินสด'}"`;
                const phone = `"${t.phone || '-'}"`;
                const address = `"${t.address || '-'}"`;
                const type = `"${getTypeName(t.type)}"`;

                let detail = '-';
                if (t.type === 'tong_lom' || t.type === 'tong_roop') detail = `"${t.percent}% / ${t.weight} กรัม"`;
                else if (t.type === 'tong_tang' || t.type === 'silver') detail = `"${t.weight} กรัม"`;

                csvContent += `${dDate},${dTime},${name},${phone},${address},${type},${detail},${t.net_price}\n`;
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

        const groupedTransactions = computed(() => {
            const groups = {};
            transactions.value.forEach(t => {
                const dateKey = t.created_at ? t.created_at.substring(0, 16) : 'unknown';
                const key = `${dateKey}_${t.customer_name || 'noname'}_${t.phone || 'nophone'}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        ids: [],
                        created_at: t.created_at,
                        customer_name: t.customer_name,
                        phone: t.phone,
                        address: t.address,
                        signature: t.signature,
                        photo: t.photo,
                        id_card_photo: t.id_card_photo,
                        items: [],
                        net_price: 0
                    };
                } else {
                    if (t.signature) groups[key].signature = t.signature;
                    if (t.photo) groups[key].photo = t.photo;
                    if (t.id_card_photo) groups[key].id_card_photo = t.id_card_photo;
                }
                groups[key].ids.push(t.id);
                groups[key].items.push(t);
                groups[key].net_price += (Number(t.net_price) || 0);
            });
            // Sort by created_at descending
            return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });

        const toggleGroupSelection = (g, checked) => {
            if (checked) {
                g.ids.forEach(id => {
                    if (!selectedTransactions.value.includes(id)) {
                        selectedTransactions.value.push(id);
                    }
                });
            } else {
                selectedTransactions.value = selectedTransactions.value.filter(id => !g.ids.includes(id));
            }
        };

        const transactionsTotal = computed(() => {
            return transactions.value.reduce((sum, item) => sum + (Number(item.net_price) || 0), 0);
        });

        const totalWeight = computed(() => {
            return transactions.value.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
        });

        // Helper to convert Base64 to Blob and upload to Supabase Storage
        const uploadToBucket = async (base64Data, filename) => {
            if (!base64Data || !base64Data.includes('base64,')) return base64Data; // If already a URL or empty

            try {
                const parts = base64Data.split(';base64,');
                const contentType = parts[0].split(':')[1];
                const raw = window.atob(parts[1]);
                const rawLength = raw.length;
                const uInt8Array = new Uint8Array(rawLength);

                for (let i = 0; i < rawLength; ++i) {
                    uInt8Array[i] = raw.charCodeAt(i);
                }

                const blob = new Blob([uInt8Array], { type: contentType });
                const ext = contentType.split('/')[1] || 'jpg';
                const filePath = `assets/${Date.now()}_${filename}_${Math.random().toString(36).substring(7)}.${ext}`;

                const { data, error } = await supabase.storage
                    .from('transaction_assets')
                    .upload(filePath, blob, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    console.error('Supabase Storage Upload Error Details:', error);
                    throw error;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('transaction_assets')
                    .getPublicUrl(filePath);

                console.log(`Upload Success: ${filename} -> ${publicUrl}`);
                return publicUrl;
            } catch (err) {
                console.error(`Upload Failed for ${filename}:`, err);
                // Fallback to base64 but warn the developer
                return base64Data;
            }
        };

        const extractStoragePath = (url) => {
            if (!url || !url.includes('transaction_assets/')) return null;
            // Extract everything after 'transaction_assets/'
            const parts = url.split('transaction_assets/');
            if (parts.length < 2) return null;
            // The path might contain query params if it's a signed URL, but here it's public
            return parts[1].split('?')[0];
        };

        const deleteTransactionAssets = async (transactionIds, deletePersonalData = true) => {
            try {
                const ids = Array.isArray(transactionIds) ? transactionIds : [transactionIds];
                if (ids.length === 0) return;

                // Fetch the records to get asset URLs
                const { data: records, error } = await supabase
                    .from('transactions')
                    .select('id_card_photo, signature, photo')
                    .in('id', ids);

                if (error) {
                    console.error('Error fetching transactions for asset deletion:', error);
                    return;
                }

                if (!records || records.length === 0) return;

                const pathsToDelete = [];
                records.forEach(r => {
                    if (deletePersonalData) {
                        if (r.id_card_photo) {
                            const path = extractStoragePath(r.id_card_photo);
                            if (path) pathsToDelete.push(path);
                        }
                        if (r.signature) {
                            const path = extractStoragePath(r.signature);
                            if (path) pathsToDelete.push(path);
                        }
                    }
                    if (r.photo) {
                        const path = extractStoragePath(r.photo);
                        if (path) pathsToDelete.push(path);
                    }
                });

                if (pathsToDelete.length > 0) {
                    console.log('Deleting assets from storage:', pathsToDelete);
                    const { error: storageError } = await supabase.storage
                        .from('transaction_assets')
                        .remove(pathsToDelete);

                    if (storageError) {
                        console.error('Error deleting assets from storage:', storageError);
                    } else {
                        console.log('Successfully deleted assets from storage');
                    }
                }
            } catch (err) {
                console.error('Unexpected error in deleteTransactionAssets:', err);
            }
        };

        const openDrawer = async () => {
            try {
                const response = await fetch('http://localhost:8080/open_drawer', {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });
                const result = await response.json();
                console.log('Drawer Trigger:', result);
            } catch (err) {
                console.error('Failed to open drawer:', err);
            }
        };

        const saveAndPrint = async () => {
            if (!isPrintReady.value) {
                if (billItems.value.length === 0) return;
                alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (เบอร์โทร, รูปถ่ายสินค้า, ลายเซ็น)');
                return;
            }

            // Capture signature
            if (signaturePad && !signaturePad.isEmpty()) {
                lastSignature.value = signaturePad.toDataURL();
            }

            let preDeductBalance = null;

            // Banknote breakdown calculation
            const getBanknoteBreakdown = (totalAmount, customBalance = null) => {
                let amount = Math.ceil(totalAmount);
                const breakdown = [];
                
                const denoms = [
                    { label: 'แบงก์ 1,000', key: 'b1000', val: 1000 },
                    { label: 'แบงก์ 500', key: 'b500', val: 500 },
                    { label: 'แบงก์ 100', key: 'b100', val: 100 },
                    { label: 'แบงก์ 50', key: 'b50', val: 50 },
                    { label: 'แบงก์ 20', key: 'b20', val: 20 },
                    { label: 'เหรียญ 10', key: 'c10', val: 10 },
                    { label: 'เหรียญ 5', key: 'c5', val: 5 },
                    { label: 'เหรียญ 1', key: 'c1', val: 1 }
                ];

                const useDrawer = isLoggedIn.value && (customBalance || drawerBalance.value);
                const balance = useDrawer ? { ...(customBalance || drawerBalance.value) } : null;

                let remaining = amount;
                for (const d of denoms) {
                    if (remaining >= d.val) {
                        const needed = Math.floor(remaining / d.val);
                        let take = needed;
                        if (useDrawer) {
                            take = Math.min(needed, balance[d.key] || 0);
                        }
                        if (take > 0) {
                            breakdown.push({
                                label: d.label,
                                val: d.val,
                                count: take
                            });
                            remaining -= (take * d.val);
                            if (useDrawer) {
                                balance[d.key] -= take;
                            }
                        }
                    }
                }

                if (remaining > 0) {
                    for (const d of denoms) {
                        if (remaining >= d.val) {
                            const needed = Math.floor(remaining / d.val);
                            breakdown.push({
                                label: d.label + ' (เงินสำรองนอกลิ้นชัก)',
                                val: d.val,
                                count: needed
                            });
                            remaining -= (needed * d.val);
                        }
                    }
                }

                return breakdown;
            };

            const paidCash = cashAmountToPay.value;
            const paidTransfer = transferAmount.value;

            let afterPrintExecuted = false;
            const handleAfterPrint = async () => {
                if (afterPrintExecuted) return;
                afterPrintExecuted = true;
                
                window.removeEventListener('afterprint', handleAfterPrint);

                // Clear all state immediately after print dialog closes
                // so the user can start the next queue right away
                billItems.value = [];
                transferAmount.value = 0;
                resetForm();
                clearSignature();
                removePhoto();

                if (currentPriceEditRequestId.value) {
                    supabase.from('price_edit_requests').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', currentPriceEditRequestId.value).then(() => {
                        priceEditStatus.value = null;
                        currentPriceEditRequestId.value = null;
                    });
                }

                if (paidCash > 0) {
                    const breakdown = getBanknoteBreakdown(paidCash, preDeductBalance);
                    let msg = `บันทึกข้อมูลและพิมพ์บิลเรียบร้อยแล้ว!\n\n`;
                    msg += `ยอดเงินสดที่ต้องจ่ายลูกค้า: ${formatCurrency(paidCash)} บาท\n\n`;
                    msg += `กรุณาจ่ายเงินสดตามรายการดังนี้:\n`;
                    breakdown.forEach(item => {
                        msg += `- ${item.label}: ${item.count} ${item.label.includes('เหรียญ') ? 'เหรียญ' : 'ใบ'}\n`;
                    });
                    
                    // Open the cash drawer immediately as the payment window is displayed (only if logged in)
                    if (isLoggedIn.value) {
                        openDrawer();
                    }
                    
                    await showAppModal('alert', 'ตรวจสอบการจ่ายเงินสด', msg);
                } else if (paidTransfer > 0) {
                    await showAppModal('alert', 'เสร็จสิ้นการทำรายการ', `บันทึกข้อมูลและพิมพ์บิลเรียบร้อยแล้ว!\n\nยอดชำระผ่านการโอนทั้งหมด: ${formatCurrency(paidTransfer)} บาท`);
                }
            };

            const triggerPrint = async () => {
                await preloadImage(lastSignature.value);
                window.addEventListener('afterprint', handleAfterPrint);
                const mql = window.matchMedia('print');
                const mqlListener = (e) => {
                    if (!e.matches) {
                        handleAfterPrint();
                        mql.removeEventListener('change', mqlListener);
                    }
                };
                mql.addEventListener('change', mqlListener);
                
                // Fallback for mobile Safari where afterprint does not fire reliably.
                // Mobile Safari print dialog opens in a separate view, causing window to lose focus.
                const focusHandler = () => {
                    handleAfterPrint();
                    window.removeEventListener('focus', focusHandler);
                };
                
                const interactionHandler = () => {
                    handleAfterPrint();
                    document.removeEventListener('click', interactionHandler);
                    document.removeEventListener('touchstart', interactionHandler);
                };

                setTimeout(() => {
                    window.addEventListener('focus', focusHandler);
                    document.addEventListener('click', interactionHandler);
                    document.addEventListener('touchstart', interactionHandler);
                }, 1000);

                window.print();

                // Hard fallback
                setTimeout(() => {
                    handleAfterPrint();
                    document.removeEventListener('click', interactionHandler);
                    document.removeEventListener('touchstart', interactionHandler);
                }, 15000);
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

            try {
                // Upload assets to Bucket first (ONLY once per bill)
                const idCardUrl = calcForm.value.idCardPhoto ? await uploadToBucket(calcForm.value.idCardPhoto, 'id_card') : '';
                const productUrl = productPhoto.value ? await uploadToBucket(productPhoto.value, 'product') : null;
                const signatureUrl = lastSignature.value ? await uploadToBucket(lastSignature.value, 'signature') : null;

                let allocatedTransfer = 0;
                const trData = billItems.value.map((item, idx) => {
                    let itemTransfer = 0;
                    if (billTotal.value > 0) {
                        if (idx === billItems.value.length - 1) {
                            itemTransfer = Number((transferAmount.value - allocatedTransfer).toFixed(2));
                        } else {
                            itemTransfer = Number(((item.netPrice / billTotal.value) * transferAmount.value).toFixed(2));
                            allocatedTransfer += itemTransfer;
                        }
                    }
                    return {
                        customer_name: item.customerName || 'เงินสด',
                        phone: item.phone || '',
                        id_card: item.idCard || '',
                        address: item.address || '',
                        // Save URLs only on the first row to optimize storage
                        id_card_photo: idx === 0 ? idCardUrl : '',
                        type: item.type,
                        base_price: item.basePrice,
                        premium_amount: item.premium,
                        percent: item.percent,
                        weight: item.weight,
                        net_price: item.netPrice,
                        transfer_amount: itemTransfer,
                        signature: idx === 0 ? signatureUrl : null,
                        photo: idx === 0 ? productUrl : null,
                        created_at: new Date().toISOString()
                    };
                });

                const { data: insertedTrxs, error } = await supabase.from('transactions').insert(trData).select();
                if (error) throw error;
                const transactionId = insertedTrxs && insertedTrxs.length > 0 ? insertedTrxs[0].id : null;

                // Send LINE Notify
                if (lineNotifyToken.value) {
                    try {
                        let notifyMsg = '\n🔔 รายการใหม่!\n';
                        notifyMsg += `ลูกค้า: ${trData[0].customer_name}\n`;
                        if (trData[0].phone) notifyMsg += `เบอร์โทร: ${trData[0].phone}\n`;
                        notifyMsg += `----------------\n`;
                        
                        trData.forEach((item, index) => {
                            let tName = item.type;
                            if (item.type === 'tong_lom') tName = 'ทองหลอม';
                            if (item.type === 'tong_roop') tName = 'ทองรูปพรรณ';
                            if (item.type === 'tong_tang') tName = 'ทองแท่ง';
                            if (item.type === 'silver') tName = 'เงิน';
                            if (item.type === 'silver_jewelry') tName = 'เครื่องประดับเงิน';
                            if (item.type === 'platinum') tName = 'ทองคำขาว';
                            
                            notifyMsg += `${index + 1}. ${tName}\n`;
                            if (item.weight) notifyMsg += `⚖️ น้ำหนัก: ${item.weight} กรัม\n`;
                            if (item.percent) notifyMsg += `✨ เปอร์เซ็นต์: ${item.percent}%\n`;
                            notifyMsg += `💎 ราคาทอง(ฐาน): ${formatCurrency(item.base_price)} ฿\n`;
                            notifyMsg += `💰 ยอดสุทธิ: ${formatCurrency(item.net_price)} ฿\n`;
                            notifyMsg += `----------------\n`;
                        });
                        
                        notifyMsg += `📌 รวมทั้งบิล: ${formatCurrency(billTotal.value)} ฿\n`;
                        if (cashAmountToPay.value > 0) notifyMsg += `💵 เงินสด: ${formatCurrency(cashAmountToPay.value)} ฿\n`;
                        if (transferAmount.value > 0) notifyMsg += `📱 โอนเงิน: ${formatCurrency(transferAmount.value)} ฿`;
                        
                        sendLineNotify(notifyMsg);
                    } catch(err) {
                        console.error('Error sending line notify:', err);
                    }
                }

                // Deduct drawer balance
                preDeductBalance = await deductDrawerBalance(cashAmountToPay.value, transactionId);

                saving.value = false;
                nextTick(() => {
                    triggerPrint();
                });
            } catch (error) {
                saving.value = false;
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
            }
        };

        // --- Thai ID Reader Integration ---
        const readIdCard = async () => {
            if (readCardLoading.value) return;
            readCardLoading.value = true;

            try {
                // Fetch from the local bridge server
                const response = await fetch('http://localhost:8080/read', {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });

                if (!response.ok) throw new Error('ระบบเบื้องหลัง (Bridge) ไม่ตอบสนอง');

                const result = await response.json();
                console.log('Bridge Response:', result);

                if (result.status === 'success' && result.data) {
                    const data = result.data;
                    // Populate fields
                    calcForm.value.customerName = data.full_name || '';
                    calcForm.value.idCard = data.cid || '';
                    calcForm.value.address = data.address || '';
                    let photoBase64 = data.photo_base64 || '';
                    if (photoBase64 && !photoBase64.startsWith('data:')) {
                        photoBase64 = 'data:image/jpeg;base64,' + photoBase64;
                    }
                    calcForm.value.idCardPhoto = photoBase64;
                    calcForm.value.expireDate = data.expire_date || '';

                    // Clear previous customer-specific state before fetching
                    calcForm.value.phone = '';
                    lastSignature.value = null;
                    isOldCustomer.value = false;

                    console.log('Read ID Card Success:', data.full_name);

                    // Fetch existing customer phone and signature if available
                    if (data.cid && isLoggedIn.value) {
                        try {
                            const { data: pastTx, error } = await supabase
                                .from('transactions')
                                .select('phone, signature')
                                .eq('id_card', data.cid)
                                .order('created_at', { ascending: false })
                                .limit(10);
                                
                            if (!error && pastTx && pastTx.length > 0) {
                                isOldCustomer.value = true;
                                const validPhoneTx = pastTx.find(tx => tx.phone && tx.phone.trim() !== '' && tx.phone !== 'null' && tx.phone !== 'undefined');
                                const validSigTx = pastTx.find(tx => tx.signature && tx.signature.trim() !== '' && tx.signature !== 'null' && tx.signature !== 'undefined');
                                
                                if (validPhoneTx) calcForm.value.phone = validPhoneTx.phone;
                                if (validSigTx) lastSignature.value = fixUrl(validSigTx.signature);
                                
                                if (validPhoneTx || validSigTx) console.log('Loaded previous customer data');
                            }
                            
                            const { data: custData } = await supabase.from('customers').select('tier').eq('id_card', data.cid).single();
                            if (custData && custData.tier) {
                                calcForm.value.customerTier = custData.tier;
                            } else {
                                calcForm.value.customerTier = 'normal';
                            }
                        } catch (err) {
                            console.error('Error fetching past customer data:', err);
                        }
                    }
                } else {
                    alert('เกิดข้อผิดพลาด: ' + (result.message || 'ไม่สามารถอ่านข้อมูลได้'));
                }
            } catch (err) {
                console.error('Bridge Connection Error:', err);
                alert('ไม่สามารถเชื่อมต่อกับเครื่องอ่านบัตรได้ กรุณารันคำสั่งรันระบบเบื้องหลัง หรือตรวจสอบการเชื่อมต่อเครื่องอ่านบัตร');
            } finally {
                readCardLoading.value = false;
            }
        };

        // --- Fetch Customer by Manual Input ---
        let fetchCustomerTimeout = null;
        const showCustomerSearch = ref(false);
        const customerSearchResults = ref([]);
        
        const fixUrl = (url) => {
            if (!url || url === 'null' || url === 'undefined' || typeof url !== 'string') return null;
            if (url.startsWith('data:')) return url;
            try {
                const urlObj = new URL(url);
                const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/(.*)/);
                if (match && match[1]) {
                    return `${supabaseUrl}/storage/v1/object/public/${match[1]}`;
                }
                return url;
            } catch(e) {
                if (url.includes('storage/v1/object/public/')) {
                    const match = url.match(/\/storage\/v1\/object\/public\/(.*)/);
                    if (match && match[1]) return `${supabaseUrl}/storage/v1/object/public/${match[1]}`;
                }
                if (url.startsWith('transaction_assets/')) {
                    return `${supabaseUrl}/storage/v1/object/public/${url}`;
                }
                return `${supabaseUrl}/storage/v1/object/public/transaction_assets/${url}`;
            }
        };

        const fetchCustomerByField = async (field, value) => {
            if (!isLoggedIn.value || !value || value.trim().length < 3) {
                showCustomerSearch.value = false;
                return;
            }
            try {
                let query = supabase
                    .from('transactions')
                    .select('customer_name, phone, id_card, id_card_photo, signature, address')
                    .order('created_at', { ascending: false })
                    .limit(50);
                    
                if (field === 'customer_name') {
                    query = query.ilike('customer_name', `%${value.trim()}%`);
                } else {
                    query = query.eq(field, value.trim());
                }

                const { data: pastTx, error } = await query;
                    
                if (!error && pastTx && pastTx.length > 0) {
                    const uniqueCustomersMap = new Map();
                    pastTx.forEach(tx => {
                        if (!tx.customer_name) return;
                        const key = tx.id_card ? tx.id_card : (tx.phone ? tx.phone : tx.customer_name);
                        if (!uniqueCustomersMap.has(key)) {
                            const customerTxs = pastTx.filter(t => (t.id_card && t.id_card === key) || (t.phone && t.phone === key) || (t.customer_name === key));
                            
                            const latestPhone = customerTxs.find(t => t.phone && t.phone.trim() !== '' && t.phone !== 'null' && t.phone !== 'undefined');
                            const latestIdCardTx = customerTxs.find(t => t.id_card && t.id_card.trim() !== '' && t.id_card !== 'null' && t.id_card !== 'undefined');
                            const latestPhotoTx = customerTxs.find(t => t.id_card_photo && t.id_card_photo.trim() !== '' && t.id_card_photo !== 'null' && t.id_card_photo !== 'undefined');
                            const latestSigTx = customerTxs.find(t => t.signature && t.signature.trim() !== '' && t.signature !== 'null' && t.signature !== 'undefined');
                            const latestAddress = customerTxs.find(t => t.address && t.address.trim() !== '' && t.address !== 'null' && t.address !== 'undefined');

                            uniqueCustomersMap.set(key, {
                                customer_name: tx.customer_name,
                                phone: latestPhone ? latestPhone.phone : '',
                                id_card: latestIdCardTx ? latestIdCardTx.id_card : '',
                                address: latestAddress ? latestAddress.address : '',
                                id_card_photo: latestPhotoTx ? latestPhotoTx.id_card_photo : '',
                                signature: latestSigTx ? latestSigTx.signature : ''
                            });
                        }
                    });

                    const uniqueCustomers = Array.from(uniqueCustomersMap.values());

                    if (uniqueCustomers.length === 1) {
                        applyCustomerData(uniqueCustomers[0], field);
                        showCustomerSearch.value = false;
                    } else if (uniqueCustomers.length > 1) {
                        customerSearchResults.value = uniqueCustomers;
                        showCustomerSearch.value = true;
                    } else {
                        showCustomerSearch.value = false;
                    }
                } else {
                    showCustomerSearch.value = false;
                }
            } catch (err) {
                console.error('Error fetching customer by ' + field + ':', err);
            }
        };

        const applyCustomerData = async (customer, field) => {
            let loadedAny = false;
            
            // Overwrite with full name if different
            if (customer.customer_name && calcForm.value.customerName !== customer.customer_name) {
                calcForm.value.customerName = customer.customer_name;
                loadedAny = true;
            }
            // Overwrite with full phone if different
            if (customer.phone && calcForm.value.phone !== customer.phone) {
                calcForm.value.phone = customer.phone;
                loadedAny = true;
            }
            if (customer.id_card && (!calcForm.value.idCard || calcForm.value.idCard === '')) {
                calcForm.value.idCard = customer.id_card;
                loadedAny = true;
            }
            if (customer.address && (!calcForm.value.address || calcForm.value.address === '')) {
                calcForm.value.address = customer.address;
                loadedAny = true;
            }
            if (customer.id_card_photo && (!calcForm.value.idCardPhoto || calcForm.value.idCardPhoto === '')) {
                calcForm.value.idCardPhoto = fixUrl(customer.id_card_photo);
                loadedAny = true;
            }
            if (customer.signature && !lastSignature.value) {
                lastSignature.value = fixUrl(customer.signature);
                loadedAny = true;
            }
            if (loadedAny) {
                isOldCustomer.value = true;
                console.log('Loaded customer data');
            }
            
            if (customer.id_card && !customer.id_card.startsWith('NO_ID_')) {
                const { data: custData } = await supabase.from('customers').select('tier').eq('id_card', customer.id_card).single();
                if (custData && custData.tier) {
                    calcForm.value.customerTier = custData.tier;
                } else {
                    calcForm.value.customerTier = 'normal';
                }
            } else if (customer.customer_name) {
                const { data } = await supabase.from('customers').select('tier').eq('customer_name', customer.customer_name.trim());
                if (data && data.length > 0) {
                    const vipTier = data.find(c => c.tier === 'vip' || c.tier === 'vvip' || c.tier === 'network' || c.tier === 'network_vip');
                    if (vipTier) {
                        calcForm.value.customerTier = vipTier.tier;
                    } else {
                        calcForm.value.customerTier = 'normal';
                    }
                } else {
                    calcForm.value.customerTier = 'normal';
                }
            } else {
                calcForm.value.customerTier = 'normal';
            }
        };

        const selectCustomer = async (customer) => {
            calcForm.value.customerName = customer.customer_name;
            if (customer.phone) calcForm.value.phone = customer.phone;
            if (customer.id_card) calcForm.value.idCard = customer.id_card;
            if (customer.address) calcForm.value.address = customer.address;
            if (customer.id_card_photo) calcForm.value.idCardPhoto = fixUrl(customer.id_card_photo);
            if (customer.signature) lastSignature.value = fixUrl(customer.signature);
            isOldCustomer.value = true;
            
            if (customer.id_card && !customer.id_card.startsWith('NO_ID_')) {
                const { data: custData } = await supabase.from('customers').select('tier').eq('id_card', customer.id_card).single();
                if (custData && custData.tier) {
                    calcForm.value.customerTier = custData.tier;
                } else {
                    calcForm.value.customerTier = 'normal';
                }
            } else if (customer.customer_name) {
                const { data } = await supabase.from('customers').select('tier').eq('customer_name', customer.customer_name.trim());
                if (data && data.length > 0) {
                    const vipTier = data.find(c => c.tier === 'vip' || c.tier === 'vvip' || c.tier === 'network' || c.tier === 'network_vip');
                    if (vipTier) {
                        calcForm.value.customerTier = vipTier.tier;
                    } else {
                        calcForm.value.customerTier = 'normal';
                    }
                } else {
                    calcForm.value.customerTier = 'normal';
                }
            } else {
                calcForm.value.customerTier = 'normal';
            }
            
            showCustomerSearch.value = false;
        };

        watch(() => calcForm.value.phone, (newVal) => {
            if (pauseCustomerWatch) return;
            clearTimeout(fetchCustomerTimeout);
            if (newVal && newVal.length >= 9) { // Trigger search when phone is almost complete
                fetchCustomerTimeout = setTimeout(() => {
                    fetchCustomerByField('phone', newVal);
                }, 600);
            }
        });

        watch(() => calcForm.value.customerName, async (newVal) => {
            if (pauseCustomerWatch) return;
            clearTimeout(fetchCustomerTimeout);
            
            if (newVal && newVal.trim().length >= 2) {
                const { data } = await supabase.from('customers').select('tier').eq('customer_name', newVal.trim());
                if (data && data.length > 0) {
                    const vipTier = data.find(c => c.tier === 'vip' || c.tier === 'vvip' || c.tier === 'network' || c.tier === 'network_vip');
                    if (vipTier) {
                        calcForm.value.customerTier = vipTier.tier;
                    } else {
                        calcForm.value.customerTier = 'normal';
                    }
                } else {
                    calcForm.value.customerTier = 'normal';
                }
            } else {
                calcForm.value.customerTier = 'normal';
            }

            if (newVal && newVal.length >= 3) {
                fetchCustomerTimeout = setTimeout(() => {
                    fetchCustomerByField('customer_name', newVal);
                }, 800);
            }
        });

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
                if (!useManualSilverPrice.value) {
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
                } else {
                    silverPrice.value = manualSilverPrice.value;
                    silverPriceSell.value = manualSilverPrice.value;
                    silverPriceBuy.value = manualSilverPrice.value;
                    priceTrendSilver.value = 0;
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

        const resetAttendanceData = () => {
            attendanceData.value = { idCard: '', name: '', photo: '' };
        };

        const readCardForAttendance = async () => {
            if (attendanceLoading.value) return;
            attendanceLoading.value = true;
            try {
                const response = await fetch('http://localhost:8080/read', {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });
                if (!response.ok) throw new Error('ระบบเบื้องหลัง (Bridge) ไม่ตอบสนอง');
                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    attendanceData.value.name = result.data.full_name || '';
                    attendanceData.value.idCard = result.data.cid || '';
                    let photoBase64 = result.data.photo_base64 || '';
                    if (photoBase64 && !photoBase64.startsWith('data:')) {
                        photoBase64 = 'data:image/jpeg;base64,' + photoBase64;
                    }
                    attendanceData.value.photo = photoBase64;
                } else {
                    alert('เกิดข้อผิดพลาด: ' + (result.message || 'ไม่สามารถอ่านข้อมูลได้'));
                }
            } catch (err) {
                console.error('Bridge Connection Error:', err);
                alert('ไม่สามารถเชื่อมต่อกับเครื่องอ่านบัตรได้ กรุณาตรวจสอบว่าโปรแกรมอ่านบัตรทำงานอยู่หรือไม่');
            } finally {
                attendanceLoading.value = false;
            }
        };

        const deleteAttendance = async (id) => {
            if (!isAdmin.value) return;
            const confirmDelete = await showAppModal('confirm', 'ยืนยันการลบ', 'คุณต้องการลบข้อมูลการลงเวลานี้ใช่หรือไม่?', [], 'ลบข้อมูล', 'ยกเลิก');
            if (!confirmDelete) return;
            
            try {
                const { error } = await supabase.from('attendance').delete().eq('id', id);
                if (error) throw error;
                
                // Reload data
                loadTodayAttendance();
                if (isAdmin.value && currentTab.value === 'attendance') {
                    loadAttendanceSummary();
                }
            } catch (err) {
                console.error('Error deleting attendance:', err);
                alert('เกิดข้อผิดพลาดในการลบข้อมูล');
            }
        };

        const filteredAttendanceList = computed(() => {
            if (!attendanceSearchQuery.value || !attendanceSearchQuery.value.trim()) {
                return todayAttendance.value;
            }
            const q = attendanceSearchQuery.value.trim().toLowerCase();
            return todayAttendance.value.filter(log => 
                (log.name && log.name.toLowerCase().includes(q)) ||
                (log.id_card && log.id_card.toLowerCase().includes(q))
            );
        });

        const attendanceStats = computed(() => {
            const list = filteredAttendanceList.value;
            let lateCount = 0;
            let lateMins = 0;
            let otMins = 0;
            let totalDeduction = 0;

            list.forEach(item => {
                if (item.late_minutes > 0) {
                    lateCount++;
                    lateMins += Number(item.late_minutes) || 0;
                    totalDeduction += Number(item.deduction_amount) || 0;
                }
                if (item.ot_minutes > 0) {
                    otMins += Number(item.ot_minutes) || 0;
                }
            });

            return {
                totalCount: list.length,
                lateCount,
                lateMins,
                otMins,
                totalDeduction
            };
        });

        const loadTodayAttendance = async () => {
            loadingAttendanceList.value = true;
            try {
                let query = supabase
                    .from('attendance')
                    .select('*')
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false });

                const now = new Date();
                const bkkTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const getBkkDateStr = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                let startStr = '';
                let endStr = '';

                if (attendanceFilterMode.value === 'today') {
                    startStr = getBkkDateStr(bkkTime);
                    endStr = startStr;
                } else if (attendanceFilterMode.value === 'yesterday') {
                    const yDate = new Date(bkkTime);
                    yDate.setDate(yDate.getDate() - 1);
                    startStr = getBkkDateStr(yDate);
                    endStr = startStr;
                } else if (attendanceFilterMode.value === 'week') {
                    const wStart = new Date(bkkTime);
                    const day = wStart.getDay();
                    const diff = wStart.getDate() - day + (day === 0 ? -6 : 1); // Monday
                    wStart.setDate(diff);
                    startStr = getBkkDateStr(wStart);
                    endStr = getBkkDateStr(bkkTime);
                } else if (attendanceFilterMode.value === 'month') {
                    const mStart = new Date(bkkTime.getFullYear(), bkkTime.getMonth(), 1);
                    const mEnd = new Date(bkkTime.getFullYear(), bkkTime.getMonth() + 1, 0);
                    startStr = getBkkDateStr(mStart);
                    endStr = getBkkDateStr(mEnd);
                } else if (attendanceFilterMode.value === 'range') {
                    startStr = attendanceStartDate.value;
                    endStr = attendanceEndDate.value;
                }

                if (attendanceFilterMode.value !== 'all') {
                    if (startStr && endStr) {
                        query = query.gte('date', startStr).lte('date', endStr);
                    } else if (startStr) {
                        query = query.gte('date', startStr);
                    } else if (endStr) {
                        query = query.lte('date', endStr);
                    }
                } else {
                    query = query.limit(300);
                }

                const { data, error } = await query;
                if (error) throw error;
                todayAttendance.value = data || [];
            } catch (err) {
                console.error('Error loading attendance', err);
            } finally {
                loadingAttendanceList.value = false;
            }
        };

        const submitCheckIn = async () => {
            if (submittingAttendance.value || !attendanceData.value.idCard) return;
            submittingAttendance.value = true;
            try {
                const now = new Date();
                const bkkTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const checkInTimeStr = String(bkkTime.getHours()).padStart(2, '0') + ':' + String(bkkTime.getMinutes()).padStart(2, '0') + ':' + String(bkkTime.getSeconds()).padStart(2, '0');
                const todayStr = bkkTime.getFullYear() + '-' + String(bkkTime.getMonth() + 1).padStart(2, '0') + '-' + String(bkkTime.getDate()).padStart(2, '0');

                // Calculate late minutes based on 08:40
                let lateMinutes = 0;
                const currentMins = bkkTime.getHours() * 60 + bkkTime.getMinutes();
                const targetMins = 8 * 60 + 40; // 08:40
                if (currentMins > targetMins) {
                    lateMinutes = currentMins - targetMins;
                }
                
                const deduction = lateMinutes * lateDeductionRate.value;
                const empName = attendanceData.value.name || 'ไม่ระบุชื่อ';
                const idCard = attendanceData.value.idCard || '-';

                const { error } = await supabase.from('attendance').insert([{
                    id_card: idCard,
                    name: empName,
                    date: todayStr,
                    check_in_time: checkInTimeStr,
                    late_minutes: lateMinutes,
                    deduction_amount: deduction
                }]);

                if (error) throw error;
                
                // ส่งการแจ้งเตือนทาง LINE
                try {
                    let notifyMsg = `⏰ แจ้งเตือน: ลงเวลาเข้างาน\n`;
                    notifyMsg += `👤 พนักงาน: ${empName}\n`;
                    notifyMsg += `🆔 รหัสบัตร: ${idCard}\n`;
                    notifyMsg += `📅 วันที่: ${todayStr}\n`;
                    notifyMsg += `🕒 เวลาเข้างาน: ${checkInTimeStr} น.\n`;
                    if (lateMinutes > 0) {
                        notifyMsg += `⚠️ สถานะ: มาสาย ${lateMinutes} นาที (หัก ${deduction} บาท)`;
                    } else {
                        notifyMsg += `✅ สถานะ: ตรงเวลา`;
                    }
                    sendLineNotify(notifyMsg);
                } catch (lineErr) {
                    console.error('Error sending check-in line notify:', lineErr);
                }

                let alertMessage = 'บันทึกเวลาเข้างานเรียบร้อยแล้ว\nเวลาเข้างานของคุณคือ: ' + checkInTimeStr;
                if (lateMinutes > 0) {
                    alertMessage += `\n\n⚠️ คุณมาสาย ${lateMinutes} นาที\nยอดหัก: ${deduction} บาท`;
                } else {
                    alertMessage += '\n\n✅ วันนี้คุณมาตรงเวลาเยี่ยมมากครับ!';
                }
                
                await showAppModal('alert', 'สำเร็จ', alertMessage);
                resetAttendanceData();
                loadTodayAttendance();
            } catch (err) {
                console.error('Error submitting attendance', err);
                alert('เกิดข้อผิดพลาดในการบันทึกเวลา');
            } finally {
                submittingAttendance.value = false;
            }
        };

        const submitCheckOut = async () => {
            if (submittingAttendance.value || !attendanceData.value.idCard) return;
            submittingAttendance.value = true;
            try {
                const now = new Date();
                const bkkTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
                const checkOutTimeStr = String(bkkTime.getHours()).padStart(2, '0') + ':' + String(bkkTime.getMinutes()).padStart(2, '0') + ':' + String(bkkTime.getSeconds()).padStart(2, '0');
                const todayStr = bkkTime.getFullYear() + '-' + String(bkkTime.getMonth() + 1).padStart(2, '0') + '-' + String(bkkTime.getDate()).padStart(2, '0');

                // Check if checked in today
                const { data: existingData, error: findError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('id_card', attendanceData.value.idCard)
                    .eq('date', todayStr)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (findError || !existingData) {
                    alert('ไม่พบข้อมูลการเข้างานของวันนี้ กรุณาบันทึกเวลาเข้างานก่อน');
                    return;
                }

                // Calculate OT: เมื่อออกงานตั้งแต่ 18:00 น. เป็นต้นไป ให้นับ OT ตั้งแต่เวลา 17:30 น.
                let otMinutes = 0;
                const currentMins = bkkTime.getHours() * 60 + bkkTime.getMinutes();
                const otThresholdMins = 18 * 60; // 18:00
                const otStartMins = 17 * 60 + 30; // 17:30

                if (currentMins >= otThresholdMins) {
                    otMinutes = currentMins - otStartMins;
                }

                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({
                        check_out_time: checkOutTimeStr,
                        ot_minutes: otMinutes
                    })
                    .eq('id', existingData.id);

                if (updateError) throw updateError;
                
                // ส่งการแจ้งเตือนทาง LINE
                try {
                    const empName = attendanceData.value.name || existingData.name || 'ไม่ระบุชื่อ';
                    const idCard = attendanceData.value.idCard || existingData.id_card || '-';
                    let notifyMsg = `🚪 แจ้งเตือน: ลงเวลาออกงาน\n`;
                    notifyMsg += `👤 พนักงาน: ${empName}\n`;
                    notifyMsg += `🆔 รหัสบัตร: ${idCard}\n`;
                    notifyMsg += `📅 วันที่: ${todayStr}\n`;
                    notifyMsg += `🕒 เวลาออกงาน: ${checkOutTimeStr} น.\n`;
                    if (existingData.check_in_time) {
                        notifyMsg += `⏰ เวลาเข้างาน: ${existingData.check_in_time} น.\n`;
                    }
                    if (otMinutes > 0) {
                        notifyMsg += `🕒 OT: ${otMinutes} นาที`;
                    } else {
                        notifyMsg += `✅ สถานะ: ออกงานปกติ`;
                    }
                    sendLineNotify(notifyMsg);
                } catch (lineErr) {
                    console.error('Error sending check-out line notify:', lineErr);
                }

                let alertMessage = 'บันทึกเวลาออกงานเรียบร้อยแล้ว\nเวลาออกงานของคุณคือ: ' + checkOutTimeStr;
                if (otMinutes > 0 && isAdmin.value) {
                    alertMessage += `\n\n🕒 ทำ OT ไปทั้งหมด ${otMinutes} นาที`;
                }
                
                await showAppModal('alert', 'สำเร็จ', alertMessage);
                resetAttendanceData();
                loadTodayAttendance();
            } catch (err) {
                console.error('Error submitting checkout', err);
                alert('เกิดข้อผิดพลาดในการบันทึกเวลาออกงาน');
            } finally {
                submittingAttendance.value = false;
            }
        };

        const loadAttendanceSummary = async () => {
            if (!isAdmin.value) return;
            loadingAttendanceSummary.value = true;
            try {
                const startDate = `${attendanceSummaryMonth.value}-01`;
                const dateParts = attendanceSummaryMonth.value.split('-');
                const endDateObj = new Date(dateParts[0], dateParts[1], 0);
                const endDate = `${attendanceSummaryMonth.value}-${String(endDateObj.getDate()).padStart(2, '0')}`;

                const { data, error } = await supabase
                    .from('attendance')
                    .select('*')
                    .gte('date', startDate)
                    .lte('date', endDate);
                    
                if (error) throw error;
                
                const summaryMap = {};
                (data || []).forEach(log => {
                    if (!summaryMap[log.id_card]) {
                        summaryMap[log.id_card] = {
                            id_card: log.id_card,
                            name: log.name,
                            total_late_minutes: 0,
                            total_ot_minutes: 0,
                            total_deduction: 0,
                            late_days: 0,
                            total_days: 0
                        };
                    }
                    summaryMap[log.id_card].total_days += 1;
                    if (log.late_minutes > 0) {
                        summaryMap[log.id_card].total_late_minutes += log.late_minutes;
                        summaryMap[log.id_card].total_deduction += Number(log.deduction_amount) || 0;
                        summaryMap[log.id_card].late_days += 1;
                    }
                    if (log.ot_minutes > 0) {
                        summaryMap[log.id_card].total_ot_minutes += log.ot_minutes;
                    }
                });
                
                attendanceSummary.value = Object.values(summaryMap).sort((a, b) => b.total_deduction - a.total_deduction);
            } catch(e) {
                console.error("Error loading attendance summary:", e);
            } finally {
                loadingAttendanceSummary.value = false;
            }
        };

        watch(attendanceSummaryMonth, () => {
            if (currentTab.value === 'attendance' && isAdmin.value) {
                loadAttendanceSummary();
            }
        });

        watch(attendanceFilterMode, (newVal) => {
            if (newVal !== 'range') {
                loadTodayAttendance();
            }
        });

        watch(currentTab, (newTab) => {
            if (newTab === 'attendance') {
                loadTodayAttendance();
                if (isAdmin.value) loadAttendanceSummary();
                // Update time display every second when on attendance tab
                const timeInterval = setInterval(() => {
                    const el = document.getElementById('attendanceCurrentTime');
                    if (el) {
                        el.innerText = new Date().toLocaleTimeString('th-TH');
                    }
                    if (currentTab.value !== 'attendance') {
                        clearInterval(timeInterval);
                    }
                }, 1000);
            }
        });

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

            // Prevent mouse wheel from changing focused number input values
            document.addEventListener('wheel', (e) => {
                if (document.activeElement && document.activeElement.type === 'number') {
                    e.preventDefault();
                }
            }, { passive: false });

            loadPremiums();
            loadDrawerBalance();
            checkAuth();

            nextTick(() => {
                setTimeout(() => {
                    initChart();
                    if (isLoggedIn.value && currentTab.value === 'calculator') initSignaturePad();
                }, 500); // 500ms delay for Chrome CSS transition

                fetchPrices();
                setInterval(fetchPrices, 5000); // 5 sec interval
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
            } else if (newTab === 'drawer') {
                loadDrawerBalance();
            }
            mobileMenuOpen.value = false;
        });

        const openCamera = () => {
            showCameraModal.value = true;
            nextTick(async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error('เบราว์เซอร์ไม่รองรับการเข้าถึงกล้อง หรือไม่ได้ใช้งานผ่าน HTTPS/localhost');
                    }
                    const constraints = {
                        video: {
                            facingMode: 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    };
                    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                    const video = document.getElementById('webcam-preview');
                    if (video) {
                        video.srcObject = cameraStream;
                    }
                } catch (err) {
                    console.error('Error accessing camera:', err);
                    alert('ไม่สามารถเปิดกล้องได้: ' + err.message);
                    showCameraModal.value = false;
                }
            });
        };

        const closeCamera = () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            showCameraModal.value = false;
        };

        const takeSnapshot = () => {
            const video = document.getElementById('webcam-preview');
            const canvas = document.getElementById('camera-canvas');
            if (video && canvas) {
                const ctx = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Compress and set as product photo
                productPhoto.value = canvas.toDataURL('image/jpeg', 0.8);

                closeCamera();
            }
        };

        // --- New Delivery Rounds & Profit Feature ---
        const unsentTransactions = ref([]);
        const groupedUnsent = ref({
            'tong_tang': { label: 'ทองคำแท่ง', items: [], selectedIds: [] },
            'tong_roop': { label: 'ทองรูปพรรณ/ไถ่ถอน', items: [], selectedIds: [] },
            'gold_50_99': { label: 'ทอง (50-99%)', items: [], selectedIds: [] },
            'gold_25_49': { label: 'ทอง (25-49%)', items: [], selectedIds: [] },
            'gold_1_24': { label: 'ทอง (1-24%)', items: [], selectedIds: [] },
            'silver': { label: 'เงิน', items: [], selectedIds: [] }
        });

        const pendingIngots = ref([]);
        const meltingIngots = computed(() => pendingIngots.value.filter(ing => ing.status === 'melting'));
        const completedIngots = computed(() => pendingIngots.value.filter(ing => !ing.status || ing.status === 'completed'));
        const deliveryRoundsHistory = ref([]);
        const historyViewTab = ref('normal');

        const normalDeliveryRounds = computed(() => {
            return deliveryRoundsHistory.value.filter(r => !r.delivery_ingots.every(ing => ing.category && String(ing.category).startsWith('อื่นๆ:')));
        });

        const otherDeliveryRounds = computed(() => {
            return deliveryRoundsHistory.value.filter(r => r.delivery_ingots.every(ing => ing.category && String(ing.category).startsWith('อื่นๆ:')));
        });
        const loadingDeliveryData = ref(false);
        const stockDateFilterMode = ref('all');
        const stockStartDate = ref(new Date().toLocaleDateString('en-CA'));
        const stockEndDate = ref(new Date().toLocaleDateString('en-CA'));
        
        const historyDateFilterMode = ref('all');
        const historyStartDate = ref(new Date().toLocaleDateString('en-CA'));
        const historyEndDate = ref(new Date().toLocaleDateString('en-CA'));
        const historyStatusFilter = ref('all');
        
        const selectedTransactionIds = ref([]);

        const extraProfits = ref([]);
        const newExtraProfit = ref({
            profit_date: new Date().toLocaleDateString('en-CA'),
            amount: '',
            note: ''
        });

        const extraProfitDateFilterMode = ref('all');
        const extraProfitStartDate = ref(new Date().toLocaleDateString('en-CA'));
        const extraProfitEndDate = ref(new Date().toLocaleDateString('en-CA'));
        
        const extraProfitSumForHistoryPeriod = ref(0);

        const loadDeliveryData = async () => {
            loadingDeliveryData.value = true;
            try {
                let query = supabase.from('transactions')
                    .select('*')
                    .is('ingot_id', null);

                if (stockDateFilterMode.value === 'showcase') {
                    query = query.eq('in_showcase', true);
                } else {
                    query = query.eq('in_showcase', false);
                    if (stockDateFilterMode.value === 'range') {
                        const startOfDay = new Date(stockStartDate.value + 'T00:00:00+07:00');
                        const endOfDay = new Date(stockEndDate.value + 'T23:59:59+07:00');
                        query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
                    }
                }

                query = query.order('created_at', { ascending: false });

                const { data: unsent } = await query;
                unsentTransactions.value = unsent || [];

                selectedTransactionIds.value = [];

                // Reset groups
                const groups = {
                    'tong_tang': { label: 'ทองคำแท่ง', items: [] },
                    'tong_roop': { label: 'ทองรูปพรรณ/ไถ่ถอน', items: [] },
                    'gold_50_99': { label: 'ทอง (50-99%)', items: [] },
                    'gold_25_49': { label: 'ทอง (25-49%)', items: [] },
                    'gold_1_24': { label: 'ทอง (1-24%)', items: [] },
                    'silver': { label: 'เงิน', items: [] }
                };
                
                unsentTransactions.value.forEach(t => {
                    let key = '';
                    if (t.type === 'silver') {
                        key = 'silver';
                    } else if (t.type === 'tong_tang') {
                        key = 'tong_tang';
                    } else if (t.type === 'tong_roop' || t.type === 'redeem') {
                        key = 'tong_roop';
                    } else {
                        const p = parseFloat(t.percent || 0);
                        if (p >= 50) key = 'gold_50_99';
                        else if (p >= 25 && p < 50) key = 'gold_25_49';
                        else if (p >= 0 && p < 25) key = 'gold_1_24';
                    }
                    if (key) {
                        groups[key].items.push(t);
                    }
                });
                groupedUnsent.value = groups;

                // 2. Fetch pending ingots
                const { data: pending } = await supabase.from('delivery_ingots').select('*, transactions(net_price, weight, percent)').is('round_id', null).order('created_at', { ascending: true });
                if (pending) {
                    pending.forEach(ing => {
                        ing.total_cost = ing.transactions.reduce((sum, t) => sum + Number(t.net_price), 0);
                        ing.raw_weight = ing.transactions.reduce((sum, t) => sum + Number(t.weight), 0);
                        let sumW = 0, sumWP = 0;
                        ing.transactions.forEach(t => {
                            const w = Number(t.weight) || 0;
                            const p = Number(t.percent) || 0;
                            sumW += w;
                            sumWP += (w * p);
                        });
                        ing.avg_percent = sumW > 0 ? (sumWP / sumW) : 0;
                    });
                    pending.sort((a, b) => {
                        const isASilver = a.category === 'silver';
                        const isBSilver = b.category === 'silver';
                        if (isASilver && !isBSilver) return 1;
                        if (!isASilver && isBSilver) return -1;
                        return 0;
                    });
                }
                pendingIngots.value = pending || [];

                // 3. Fetch rounds history (Admin ONLY)
                if (isAdmin.value) {
                    let roundsQuery = supabase.from('delivery_rounds').select('*, delivery_ingots(*, transactions(net_price, weight, percent))').order('created_at', { ascending: false });
                    
                    if (historyStatusFilter.value !== 'all') {
                        roundsQuery = roundsQuery.eq('status', historyStatusFilter.value);
                    }
                    
                    let epQuery = supabase.from('extra_profits').select('amount');
                    
                    if (historyDateFilterMode.value !== 'all') {
                        let start = new Date();
                        let end = new Date();
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);

                        if (historyDateFilterMode.value === 'yesterday') {
                            start.setDate(start.getDate() - 1);
                            end.setDate(end.getDate() - 1);
                        } else if (historyDateFilterMode.value === 'week') {
                            const day = start.getDay();
                            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
                            start.setDate(diff);
                        } else if (historyDateFilterMode.value === 'month') {
                            start.setDate(1);
                        } else if (historyDateFilterMode.value === 'year') {
                            start.setMonth(0, 1);
                        } else if (historyDateFilterMode.value === 'range') {
                            start = new Date(historyStartDate.value + 'T00:00:00+07:00');
                            end = new Date(historyEndDate.value + 'T23:59:59+07:00');
                        }
                        
                        roundsQuery = roundsQuery.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
                        
                        const startStr = start.toLocaleDateString('en-CA');
                        const endStr = end.toLocaleDateString('en-CA');
                        epQuery = epQuery.gte('profit_date', startStr).lte('profit_date', endStr);
                    } else {
                        roundsQuery = roundsQuery.limit(30);
                        epQuery = epQuery.limit(1000);
                    }
                    
                    const [roundsRes, epRes] = await Promise.all([roundsQuery, epQuery]);
                    
                    const rounds = roundsRes.data;
                    if (rounds) {
                        rounds.forEach(r => {
                            let totalCost = 0;
                            let goldCost = 0;
                            let silverCost = 0;
                            r.delivery_ingots.forEach(ing => {
                                const cost = ing.transactions.reduce((sum, t) => sum + Number(t.net_price), 0);
                                ing.raw_weight = ing.transactions.reduce((sum, t) => sum + Number(t.weight), 0);
                                let sumW = 0, sumWP = 0;
                                ing.transactions.forEach(t => {
                                    const w = Number(t.weight) || 0;
                                    const p = Number(t.percent) || 0;
                                    sumW += w;
                                    sumWP += (w * p);
                                });
                                ing.avg_percent = sumW > 0 ? (sumWP / sumW) : 0;
                                totalCost += cost;
                                if (ing.category === 'silver') silverCost += cost;
                                else goldCost += cost;
                            });
                            r.delivery_ingots.sort((a, b) => {
                                const isASilver = a.category === 'silver';
                                const isBSilver = b.category === 'silver';
                                if (isASilver && !isBSilver) return 1;
                                if (!isASilver && isBSilver) return -1;
                                return 0;
                            });
                            r.total_cost = totalCost;
                            r.gold_cost = goldCost;
                            r.silver_cost = silverCost;
                            r.net_profit = (Number(r.gold_payment || 0) + Number(r.silver_payment || 0)) - totalCost;
                            r.inputGold = r.gold_payment > 0 ? r.gold_payment : '';
                            r.inputSilver = r.silver_payment > 0 ? r.silver_payment : '';
                        });
                    }
                    deliveryRoundsHistory.value = rounds || [];
                    
                    const epData = epRes.data;
                    extraProfitSumForHistoryPeriod.value = epData ? epData.reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;
                } else {
                    deliveryRoundsHistory.value = [];
                    extraProfitSumForHistoryPeriod.value = 0;
                }

                await loadExtraProfits();
            } catch (err) {
                console.error("Error loading delivery data:", err);
            } finally {
                loadingDeliveryData.value = false;
            }
        };

        const loadExtraProfits = async () => {
            try {
                let query = supabase.from('extra_profits')
                    .select('*')
                    .order('profit_date', { ascending: false });

                if (extraProfitDateFilterMode.value !== 'all') {
                    let start = new Date();
                    let end = new Date();
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);

                    if (extraProfitDateFilterMode.value === 'yesterday') {
                        start.setDate(start.getDate() - 1);
                        end.setDate(end.getDate() - 1);
                    } else if (extraProfitDateFilterMode.value === 'week') {
                        const day = start.getDay();
                        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
                        start.setDate(diff);
                    } else if (extraProfitDateFilterMode.value === 'month') {
                        start.setDate(1);
                    } else if (extraProfitDateFilterMode.value === 'year') {
                        start.setMonth(0, 1);
                    } else if (extraProfitDateFilterMode.value === 'range') {
                        start = new Date(extraProfitStartDate.value + 'T00:00:00+07:00');
                        end = new Date(extraProfitEndDate.value + 'T23:59:59+07:00');
                    }
                    
                    const startStr = start.toLocaleDateString('en-CA');
                    const endStr = end.toLocaleDateString('en-CA');
                    query = query.gte('profit_date', startStr).lte('profit_date', endStr);
                } else {
                    query = query.limit(30);
                }

                const { data, error } = await query;
                if (error) throw error;
                extraProfits.value = data || [];
            } catch (err) {
                console.error('Error loading extra profits:', err);
            }
        };

        const addExtraProfit = async () => {
            if (!newExtraProfit.value.profit_date || !newExtraProfit.value.amount) {
                alert('กรุณากรอกวันที่และจำนวนเงินให้ครบถ้วน');
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('extra_profits')
                    .insert([{
                        profit_date: newExtraProfit.value.profit_date,
                        amount: parseFloat(newExtraProfit.value.amount),
                        note: newExtraProfit.value.note || ''
                    }])
                    .select();
                if (error) throw error;
                
                newExtraProfit.value.amount = '';
                newExtraProfit.value.note = '';
                await loadExtraProfits();
            } catch (err) {
                console.error('Error adding extra profit:', err);
                alert('เกิดข้อผิดพลาดในการบันทึกกำไรเพิ่มเติม: ' + err.message);
            }
        };

        const deleteExtraProfit = async (id) => {
            const confirmed = await showAppModal('confirm', 'ยืนยัน', 'ต้องการลบรายการกำไรเพิ่มเติมนี้ใช่หรือไม่?');
            if (!confirmed) return;
            try {
                const { error } = await supabase
                    .from('extra_profits')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                await loadExtraProfits();
            } catch (err) {
                console.error('Error deleting extra profit:', err);
                alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
            }
        };
        
        watch([stockDateFilterMode, stockStartDate, stockEndDate, historyDateFilterMode, historyStartDate, historyEndDate, historyStatusFilter, extraProfitDateFilterMode, extraProfitStartDate, extraProfitEndDate], () => {
            loadDeliveryData();
        });

        const historyGoldProfit = computed(() => {
            return deliveryRoundsHistory.value.reduce((sum, r) => {
                if (r.status === 'completed') {
                    return sum + (Number(r.gold_payment || 0) - Number(r.gold_cost || 0));
                }
                return sum;
            }, 0);
        });

        const historySilverProfit = computed(() => {
            return deliveryRoundsHistory.value.reduce((sum, r) => {
                if (r.status === 'completed') {
                    return sum + (Number(r.silver_payment || 0) - Number(r.silver_cost || 0));
                }
                return sum;
            }, 0);
        });

        const historyTotalProfit = computed(() => {
            return historyGoldProfit.value + historySilverProfit.value + extraProfitSumForHistoryPeriod.value;
        });

        const selectedStats = computed(() => {
            const selected = unsentTransactions.value.filter(i => selectedTransactionIds.value.includes(i.id));
            let totalWeight = 0;
            let weightedPercentSum = 0;
            let totalCost = 0;
            
            selected.forEach(i => {
                const w = Number(i.weight) || 0;
                const p = Number(i.percent) || 0;
                totalWeight += w;
                weightedPercentSum += (w * p);
                totalCost += Number(i.net_price) || 0;
            });
            
            return {
                count: selected.length,
                weight: totalWeight,
                cost: totalCost,
                avgPercent: totalWeight > 0 ? (weightedPercentSum / totalWeight) : 0
            };
        });

        const toggleSelectAllCategory = (category) => {
            const group = groupedUnsent.value[category];
            const groupIds = group.items.map(i => i.id);
            const allSelected = groupIds.length > 0 && groupIds.every(id => selectedTransactionIds.value.includes(id));
            
            if (allSelected) {
                selectedTransactionIds.value = selectedTransactionIds.value.filter(id => !groupIds.includes(id));
            } else {
                groupIds.forEach(id => {
                    if (!selectedTransactionIds.value.includes(id)) {
                        selectedTransactionIds.value.push(id);
                    }
                });
            }
        };

        const createIngot = async () => {
            if (selectedTransactionIds.value.length === 0) {
                await showAppModal('alert', 'แจ้งเตือน', 'กรุณาเลือกรายการที่ต้องการหลอม');
                return;
            }
            
            const selectedItems = unsentTransactions.value.filter(i => selectedTransactionIds.value.includes(i.id));
            const hasSilver = selectedItems.some(i => i.type === 'silver');
            const hasGold = selectedItems.some(i => i.type !== 'silver');

            let type = 'gold';
            if (hasSilver && !hasGold) type = 'silver';
            else if (hasSilver && hasGold) {
                const confirmed = await showAppModal('confirm', 'ยืนยัน', 'คุณเลือกทั้งเงินและทองรวมกัน ต้องการหลอมรวมกันจริงๆ ใช่หรือไม่?');
                if (!confirmed) return;
                
                const userInput = await showAppModal('prompt', 'ระบุประเภท', 'กรุณาระบุประเภทก้อนหลอม (พิมพ์ gold หรือ silver):', [
                    { label: 'ประเภท (gold/silver)', type: 'text', defaultValue: 'gold' }
                ]);
                if (!userInput) return;
                type = userInput;
            }
            const isAllTongTang = selectedItems.every(i => i.type === 'tong_tang');
            let category = type === 'silver' ? 'กำลังหลอม (เงิน)' : 'กำลังหลอม (ทอง)';

            loadingDeliveryData.value = true;
            try {
                // Insert Ingot with 'melting' status
                const { data: ingotData, error: ingotError } = await supabase.from('delivery_ingots').insert([{
                    category: category,
                    status: 'melting'
                }]).select();
                
                if (ingotError) throw ingotError;
                const newIngotId = ingotData[0].id;

                // Update transactions
                const { error: txError } = await supabase.from('transactions').update({ ingot_id: newIngotId }).in('id', selectedTransactionIds.value);
                if (txError) throw txError;

                await loadDeliveryData();
            } catch (err) {
                console.error("Error creating ingot:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const completeMelting = async (ingot) => {
            const isAllTongTang = ingot.transactions && ingot.transactions.every(i => i.type === 'tong_tang');
            
            const defaultWeight = ingot.raw_weight > 0 ? parseFloat(ingot.raw_weight.toFixed(2)) : '';
            const defaultPercent = isAllTongTang ? '96.5' : '';
            
            const inputs = await showAppModal('prompt', 'ข้อมูลก้อนหลอม', 'กรุณาระบุน้ำหนักและเปอร์เซ็นต์ของก้อนที่หลอมเสร็จแล้ว:', [
                { label: 'น้ำหนัก (กรัม)', type: 'number', defaultValue: defaultWeight },
                { label: 'เปอร์เซ็นต์ (%)', type: 'number', defaultValue: defaultPercent }
            ]);
            
            if (!inputs || inputs.length < 2) return;
            const weight = inputs[0];
            const percent = inputs[1];
            
            if (!weight || !percent) return;

            const isSilver = ingot.category && ingot.category.includes('เงิน');
            let newCategory = 'silver';
            if (!isSilver) {
                const p = parseFloat(percent);
                if (p >= 60) newCategory = 'gold_60_100';
                else if (p >= 30) newCategory = 'gold_30_59';
                else newCategory = 'gold_20_29';
            }

            loadingDeliveryData.value = true;
            try {
                const { error: updateError } = await supabase.from('delivery_ingots').update({
                    category: newCategory,
                    status: 'completed',
                    melted_weight: parseFloat(weight),
                    melted_percent: parseFloat(percent)
                }).eq('id', ingot.id);
                
                if (updateError) throw updateError;
                
                await loadDeliveryData();
            } catch (err) {
                console.error("Error completing melting:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const markAsShowcase = async () => {
            if (selectedTransactionIds.value.length === 0) {
                await showAppModal('alert', 'แจ้งเตือน', 'กรุณาเลือกรายการที่ต้องการเก็บโชว์ในตู้');
                return;
            }
            
            const productName = await showAppModal('prompt', 'โชว์ในตู้', `ต้องการเก็บรายการที่เลือกจำนวน ${selectedTransactionIds.value.length} รายการเข้าตู้โชว์\n\nกรุณาระบุชื่อสินค้า (สามารถเว้นว่างได้):`, [
                { label: 'ชื่อสินค้า', type: 'text', defaultValue: '' }
            ]);

            if (typeof productName !== 'string') return;

            loadingDeliveryData.value = true;
            try {
                const updateData = { in_showcase: true };
                if (productName.trim() !== '') {
                    updateData.details = productName.trim();
                }
                const { error } = await supabase.from('transactions').update(updateData).in('id', selectedTransactionIds.value);
                if (error) throw error;
                await loadDeliveryData();
            } catch (err) {
                console.error("Error setting showcase:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const markAsOther = async () => {
            if (selectedTransactionIds.value.length === 0) {
                await showAppModal('alert', 'แจ้งเตือน', 'กรุณาเลือกรายการที่ต้องการจัดการ');
                return;
            }

            const reason = await showAppModal('prompt', 'เอาทองไปไหน?', 'โปรดระบุรายละเอียด (เช่น ส่งคืนลูกค้า, ขายออก, อื่นๆ):', [
                { label: 'รายละเอียด', type: 'text', defaultValue: '' }
            ]);

            if (!reason || typeof reason !== 'string' || reason.trim() === '') return;

            loadingDeliveryData.value = true;
            try {
                const selectedItems = unsentTransactions.value.filter(i => selectedTransactionIds.value.includes(i.id));
                const totalCost = selectedItems.reduce((sum, i) => sum + Number(i.net_price), 0);
                const totalWeight = selectedItems.reduce((sum, i) => sum + Number(i.weight), 0);

                const { data: roundData, error: roundError } = await supabase.from('delivery_rounds').insert([{
                    status: 'completed',
                    gold_payment: totalCost, 
                    created_at: new Date().toISOString()
                }]).select();
                
                if (roundError) throw roundError;
                const roundId = roundData[0].id;

                const { data: ingotData, error: ingotError } = await supabase.from('delivery_ingots').insert([{
                    category: `อื่นๆ: ${reason}`,
                    melted_weight: totalWeight,
                    melted_percent: 0,
                    round_id: roundId
                }]).select();

                if (ingotError) throw ingotError;
                const ingotId = ingotData[0].id;

                const { error: txError } = await supabase.from('transactions').update({ ingot_id: ingotId }).in('id', selectedTransactionIds.value);
                if (txError) throw txError;

                await loadDeliveryData();
            } catch (err) {
                console.error("Error setting other purpose:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const removeFromShowcase = async () => {
            if (selectedTransactionIds.value.length === 0) {
                await showAppModal('alert', 'แจ้งเตือน', 'กรุณาเลือกรายการที่ต้องการย้ายกลับคิวรอหลอม');
                return;
            }
            const confirmed = await showAppModal('confirm', 'ยืนยัน', `ต้องการย้ายรายการที่เลือกจำนวน ${selectedTransactionIds.value.length} รายการกลับไปคิวรอหลอม ใช่หรือไม่?`);
            if (!confirmed) return;

            loadingDeliveryData.value = true;
            try {
                const { error } = await supabase.from('transactions').update({ in_showcase: false }).in('id', selectedTransactionIds.value);
                if (error) throw error;
                await loadDeliveryData();
            } catch (err) {
                console.error("Error restoring from showcase:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const deleteIngot = async (ingotId) => {
            const confirmed = await showAppModal('confirm', 'ยืนยัน', 'ต้องการลบก้อนนี้และคืนของเข้าสต็อกใช่หรือไม่?');
            if (!confirmed) return;
            loadingDeliveryData.value = true;
            try {
                const { error } = await supabase.from('delivery_ingots').delete().eq('id', ingotId);
                if (error) throw error;
                await loadDeliveryData();
            } catch (err) {
                console.error("Error deleting ingot:", err);
                loadingDeliveryData.value = false;
            }
        };

        const createDeliveryRound = async () => {
            if (pendingIngots.value.length === 0) {
                await showAppModal('alert', 'แจ้งเตือน', 'ไม่มีก้อนหลอมให้ส่ง');
                return;
            }
            
            const dateInput = await showAppModal('prompt', 'จัดส่งรอบนี้', 'กรุณาเลือกวันที่จัดส่ง:', [
                { label: 'วันที่จัดส่ง', type: 'date', defaultValue: new Date().toLocaleDateString('en-CA') }
            ]);
            
            if (!dateInput) return; // User cancelled
            
            // Allow override of created_at
            let createdAtIso = new Date().toISOString();
            if (dateInput) {
                const dateObj = new Date(dateInput);
                const now = new Date();
                dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                createdAtIso = dateObj.toISOString();
            }

            loadingDeliveryData.value = true;
            try {
                // Check if a round exists on this date
                const startOfDay = new Date(dateInput);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(dateInput);
                endOfDay.setHours(23, 59, 59, 999);

                const { data: existingRounds, error: existingError } = await supabase
                    .from('delivery_rounds')
                    .select('id')
                    .gte('created_at', startOfDay.toISOString())
                    .lte('created_at', endOfDay.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (existingError) throw existingError;

                let targetRoundId;
                if (existingRounds && existingRounds.length > 0) {
                    targetRoundId = existingRounds[0].id;
                } else {
                    const { data: roundData, error: roundError } = await supabase.from('delivery_rounds').insert([{
                        status: 'pending',
                        created_at: createdAtIso
                    }]).select();
                    if (roundError) throw roundError;
                    targetRoundId = roundData[0].id;
                }

                const ingotIds = pendingIngots.value.map(i => i.id);
                const { error: updateError } = await supabase.from('delivery_ingots').update({ round_id: targetRoundId }).in('id', ingotIds);
                if (updateError) throw updateError;

                await loadDeliveryData();
            } catch (err) {
                console.error("Error creating round:", err);
                alert('เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const savePayment = async (roundId, goldAmount, silverAmount) => {
            const gold = parseFloat(goldAmount) || 0;
            const silver = parseFloat(silverAmount) || 0;
            if (gold === 0 && silver === 0) {
                if(!confirm('ยอดเงินเป็น 0 ยืนยันการบันทึกใช่หรือไม่?')) return;
            }

            loadingDeliveryData.value = true;
            try {
                const { error } = await supabase.from('delivery_rounds').update({
                    gold_payment: gold,
                    silver_payment: silver,
                    status: 'completed',
                    completed_at: new Date().toISOString()
                }).eq('id', roundId);
                if (error) throw error;

                await loadDeliveryData();
            } catch (err) {
                console.error("Error saving payment:", err);
                alert('เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const deleteDeliveryRound = async (roundId) => {
            const confirmed = await showAppModal('confirm', 'คำเตือน', 'การลบรอบนี้จะคืนก้อนหลอมทั้งหมดกลับไปเป็นสถานะ "รอส่ง"\nคุณแน่ใจหรือไม่?');
            if (!confirmed) return;
            loadingDeliveryData.value = true;
            try {
                const { error } = await supabase.from('delivery_rounds').delete().eq('id', roundId);
                if (error) throw error;
                await loadDeliveryData();
            } catch (err) {
                console.error("Error deleting round:", err);
                loadingDeliveryData.value = false;
            }
        };

        const returnIngotToPending = async (ingotId) => {
            const confirmed = await showAppModal('confirm', 'ยืนยัน', 'ต้องการคืนก้อนหลอมนี้ไปยังรายการก้อนรอส่งสมาคมใช่หรือไม่?');
            if (!confirmed) return;
            loadingDeliveryData.value = true;
            try {
                const { error } = await supabase
                    .from('delivery_ingots')
                    .update({ round_id: null })
                    .eq('id', ingotId);
                if (error) throw error;
                await loadDeliveryData();
            } catch (err) {
                console.error("Error returning ingot to pending:", err);
                await showAppModal('alert', 'ผิดพลาด', 'เกิดข้อผิดพลาด: ' + err.message);
                loadingDeliveryData.value = false;
            }
        };

        const allPremiumType = computed({
            get() {
                if (!premiums.value || premiums.value.length === 0) return 'fixed';
                return premiums.value.every(p => p.premium_type === 'percent') ? 'percent' : 'fixed';
            },
            set(val) {
                premiums.value.forEach(p => {
                    p.premium_type = val;
                });
            }
        });

        const setAllPremiumTypes = (type) => {
            allPremiumType.value = type;
        };

        watch(currentTab, (newTab) => {
            if (newTab === 'delivery') {
                loadDeliveryData();
            }
        });

        // --- Pre-melt Calculator Feature ---
        const preMeltItems = ref([{ id: Date.now(), type: 'gold', weight: null, percent: null }]);

        const addPreMeltItem = () => {
            preMeltItems.value.push({ id: Date.now() + Math.random(), type: 'gold', weight: null, percent: null });
        };

        const removePreMeltItem = (id) => {
            if (preMeltItems.value.length > 1) {
                preMeltItems.value = preMeltItems.value.filter(i => i.id !== id);
            }
        };

        const calculatePreMeltAppraisal = (totalWeight, avgPercent, isGold) => {
            if (totalWeight <= 0) return 0;
            const gp = Math.floor(goldPrice.value || 0);
            const sp = Math.floor(manualSilverPrice.value || 0);
            
            if (isGold) {
                let base = gp;
                let premium = 0;
                let activePremium = premiums.value.find(pr => avgPercent >= pr.range_min && avgPercent <= pr.range_max);
                const meetsWeightReq = totalWeight >= 5 || isOldCustomer.value;
                if (activePremium && meetsWeightReq) {
                    if (activePremium.premium_type === 'percent') {
                        premium = Math.floor(base * (Number(activePremium.premium_percent) / 100));
                    } else {
                        premium = Number(activePremium.premium_amount);
                    }
                }
                const perGram = floor2((base + premium) * 0.0656);
                const withPurity = floor2(perGram * (avgPercent / 100));
                return floor2(withPurity * totalWeight);
            } else {
                const multiplier = useSilverDeduction.value ? (100 - (Number(silverDeduction.value) || 0)) / 100 : 1;
                const spDeducted = Math.floor(sp * multiplier);
                
                const perGram = Math.floor(spDeducted / 1000);
                const withPercent = Math.floor(perGram * (avgPercent / 100));
                return Math.floor(withPercent * totalWeight);
            }
        };

        const preMeltGoldSummary = computed(() => {
            const items = preMeltItems.value.filter(i => i.type === 'gold');
            let sumW = 0, sumWP = 0;
            items.forEach(i => {
                const w = Number(i.weight) || 0;
                const p = Number(i.percent) || 0;
                sumW += w;
                sumWP += (w * p);
            });
            const avgP = sumW > 0 ? (sumWP / sumW) : 0;
            const flooredAvgP = Math.floor(avgP);
            return {
                weight: sumW,
                avgPercent: flooredAvgP,
                price: calculatePreMeltAppraisal(sumW, flooredAvgP, true)
            };
        });

        const preMeltSilverSummary = computed(() => {
            const items = preMeltItems.value.filter(i => i.type === 'silver');
            let sumW = 0, sumWP = 0;
            items.forEach(i => {
                const w = Number(i.weight) || 0;
                const p = Number(i.percent) || 0;
                sumW += w;
                sumWP += (w * p);
            });
            const avgP = sumW > 0 ? (sumWP / sumW) : 0;
            const flooredAvgP = Math.floor(avgP);
            return {
                weight: sumW,
                avgPercent: flooredAvgP,
                price: calculatePreMeltAppraisal(sumW, flooredAvgP, false)
            };
        });


        // --- TV Preview Feature ---
        const showTVModal = ref(false);
        const tvOrientation = ref('landscape');
        const isTVMouseIdle = ref(false);
        let tvIdleTimer = null;

        const toggleTVOrientation = () => {
            tvOrientation.value = tvOrientation.value === 'landscape' ? 'portrait' : 'landscape';
            handleTVMouseMove();
        };

        const handleTVMouseMove = () => {
            isTVMouseIdle.value = false;
            if (tvIdleTimer) clearTimeout(tvIdleTimer);
            tvIdleTimer = setTimeout(() => {
                isTVMouseIdle.value = true;
            }, 3000);
        };

        const openTVMode = async () => {
            tvOrientation.value = 'portrait';
            showTVModal.value = true;
            handleTVMouseMove(); // Start idle timer immediately
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {
                console.error("Fullscreen API not supported", e);
            }
        };

        const closeTVMode = async () => {
            showTVModal.value = false;
            try {
                if (document.fullscreenElement && document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            } catch (e) {
                console.error("Exit fullscreen failed", e);
            }
        };

        return {
            showTVModal,
            openTVMode,
            closeTVMode,
            tvOrientation,
            toggleTVOrientation,
            isTVMouseIdle,
            handleTVMouseMove,
            preMeltItems,
            addPreMeltItem,
            removePreMeltItem,
            preMeltGoldSummary,
            preMeltSilverSummary,
            currentTab,
            attendanceData,
            attendanceLoading,
            submittingAttendance,
            todayAttendance,
            loadingAttendanceList,
            attendanceFilterMode,
            attendanceStartDate,
            attendanceEndDate,
            attendanceSearchQuery,
            filteredAttendanceList,
            attendanceStats,
            attendanceSummaryMonth,
            attendanceSummary,
            loadingAttendanceSummary,
            lateDeductionRate,
            lineNotifyToken,
            lineTargetId,
            testingLine,
            saveLineNotifyToken,
            testLineNotify,
            loadAttendanceSummary,
            resetAttendanceData,
            readCardForAttendance,
            loadTodayAttendance,
            deleteAttendance,
            submitCheckIn,
            submitCheckOut,
            saveAttendanceSettings,
            showTopUpModal,
            savingTopUp,
            topUpForm,
            topUpTotal,
            openTopUpModal,
            confirmTopUp,
            showWithdrawModal,
            savingWithdraw,
            withdrawForm,
            withdrawTotal,
            openWithdrawModal,
            confirmWithdraw,
            user,
            isLoggedIn,
            isAdmin,
            isEmployee,
            showAuth,
            readCardLoading,
            readIdCard,
            isCardExpired,
            formatThaiDate,
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

            showCameraModal,
            openCamera,
            closeCamera,
            takeSnapshot,

            customerSearchQuery,
            customerSearchResults,
            adminCustomerSearchResults,
            customerSearchAttempted,
            premiumCustomersList,
            searchOldCustomers,
            addCustomerTier,
            removeCustomerTier,
            loadPremiumCustomers,

            priceTrendGold,
            priceTrendSilver,
            appModal,
            showAppModal,
            resolveModal,
            silverDeduction,
            useSilverDeduction,
            silverPremiumAmountVip,
            silverPremiumAmountVvip,
            silverPremiumAmountNetwork,
            silverPremiumAmountNetworkVip,
            networkGoldPremiumAmount_25_49,
            networkGoldPremiumPercent_25_49,
            networkGoldPremiumAmount_50_100,
            networkGoldPremiumPercent_50_100,
            networkVipGoldPremiumAmount_25_49,
            networkVipGoldPremiumPercent_25_49,
            networkVipGoldPremiumAmount_50_100,
            networkVipGoldPremiumPercent_50_100,
            manualSilverPrice,
            useManualSilverPrice,
            isSilverPriceSetToday,
            saveSilverSettings,

            premiums,
            allPremiumType,
            setAllPremiumTypes,
            loadingPremiums,
            savePremiums,
            autoSaveSettings,
            saving,

            transactions,
            groupedTransactions,
            toggleGroupSelection,
            loadingTransactions,
            transactionsTotal,
            totalWeight,
            drawerBalance,
            drawerTotal,
            savingDrawer,
            drawerLogs,
            loadingDrawerLogs,
            showDrawerLogsModal,
            openDrawerLogsModal,
            refundDrawerLog,
            getDrawerTotalFromObj,
            getDrawerDiff,
            getDrawerBreakdown,
            saveDrawerBalance,
            isPrintReady,
            uploadToBucket,
            formatCurrency,
            formatThaiDateTime,
              filter,
            toggleGoldCategory,
              isFilterActive,
              deleteTransaction,
              deleteGroup,
              editTransaction,
              editTrxModal,
              calculateEditTrxNetPrice,
              onEditBasePrice,
              saveEditTransaction,
              reprintGroup,
              reprintLatestReceipt,
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
            isBaseValid,
            isMerchantCustomer,
            isPercentValid,
            isWeightValid,
            currentAssetPrice,
            calculatedResult,
            isPhoneValid,
            isIdCardValid,
            formatPricePerGram,
            fetchCustomerByField,
            showCustomerSearch,
            customerSearchResults,
            selectCustomer,

            billItems,
            addToBill,
            removeBillItem,
            billTotal,
            transferAmount,
            cashAmountToPay,
            saveAndPrint,
            openDrawer,

            formatDate,
            getTypeName,
            lastSignature,
            clearSignature,
            productPhoto,
            handlePhotoChange,
            removePhoto,
            viewingPhoto,
            deleteTransactionAssets,
            showSignatureModal,
            modalHasSignature,
            openSignatureModal,
            closeSignatureModal,
            clearModalSignature,
            saveModalSignature,
            
            groupedUnsent,
            pendingIngots,
            meltingIngots,
            completedIngots,
            completeMelting,
            deliveryRoundsHistory,
            historyViewTab,
            normalDeliveryRounds,
            otherDeliveryRounds,
            loadingDeliveryData,
            stockDateFilterMode,
            stockStartDate,
            stockEndDate,
            historyDateFilterMode,
            historyStartDate,
            historyEndDate,
            historyStatusFilter,
            historyGoldProfit,
            historySilverProfit,
            historyTotalProfit,
            selectedTransactionIds,
            selectedStats,
            loadDeliveryData,
            toggleSelectAllCategory,
            createIngot,
            markAsShowcase,
            markAsOther,
            removeFromShowcase,
            deleteIngot,
            createDeliveryRound,
            savePayment,
            deleteDeliveryRound,
            returnIngotToPending,

            extraProfits,
            newExtraProfit,
            loadExtraProfits,
            addExtraProfit,
            deleteExtraProfit,
            extraProfitDateFilterMode,
            extraProfitStartDate,
            extraProfitEndDate,
            priceEditStatus,
            currentPriceEditRequestId,
            adminPendingRequests,
            requestPriceEdit,
            approvePriceEdit,
            rejectPriceEdit
        };
    }
}).mount('#app');
