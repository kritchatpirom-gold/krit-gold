const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const supabaseUrl = 'https://cjithgqbtwuxfxrauvax.supabase.co';
const supabaseKey = 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';
//const supabaseUrl = 'http://127.0.0.1:54321';
//const supabaseUrl = 'http://192.168.1.112:54321';
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
        const readCardLoading = ref(false); // ID Card Reading State
        const showSignatureModal = ref(false);
        const modalHasSignature = ref(false);
        const showCameraModal = ref(false);
        let signaturePad = null;
        let cameraStream = null;

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
            address: '',
            idCardPhoto: '',
            expireDate: '',
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
                address: '',
                idCardPhoto: '',
                expireDate: '',
                manualPrice: null
            };
        };

        const formatThaiDate = (dateStr) => {
            if (!dateStr || dateStr.length !== 10) return dateStr;
            const [y, m, d] = dateStr.split('-');
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;
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

        const isFormValid = computed(() => {
            let baseValid = false;
            // Asset type and weight are always required
            if (calcForm.value.type === 'tong_roop' || calcForm.value.type === 'redeem') {
                baseValid = calcForm.value.weight > 0;
            } else {
                baseValid = calcForm.value.weight > 0 && calcForm.value.percent !== null;
            }

            if (isLoggedIn.value) {
                // Must have name and valid ID format
                const identityValid = isIdCardValid.value && calcForm.value.customerName.trim().length > 1;

                // Both Admin and Employee modes must have Phone, Photo, and Signature to add to bill
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
                // Delete assets from storage first
                await deleteTransactionAssets(id);
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (!error) loadTransactions();
                else alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
            }
        };

        const deleteSelected = async () => {
            if (selectedTransactions.value.length === 0) return;
            if (confirm(`ยืนยันการลบรายการที่เลือกจำนวน ${selectedTransactions.value.length} รายการ?`)) {
                loadingTransactions.value = true;
                // Delete assets from storage first
                await deleteTransactionAssets(selectedTransactions.value);
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

        const deleteTransactionAssets = async (transactionIds) => {
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
                    if (r.id_card_photo) {
                        const path = extractStoragePath(r.id_card_photo);
                        if (path) pathsToDelete.push(path);
                    }
                    if (r.signature) {
                        const path = extractStoragePath(r.signature);
                        if (path) pathsToDelete.push(path);
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
                // and might not reliably fire afterprint, giving them 30 secs to render PDF.
                setTimeout(() => {
                    handleAfterPrint();
                }, 30000);
            };

            // If completely public guest (no login), just print without calling DB
            if (!isLoggedIn.value) {
                // Open drawer even for guest if they print?
                openDrawer();
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

                const trData = billItems.value.map((item, idx) => ({
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
                    signature: idx === 0 ? signatureUrl : null,
                    photo: idx === 0 ? productUrl : null,
                    created_at: new Date().toISOString()
                }));

                const { error } = await supabase.from('transactions').insert(trData);
                if (error) throw error;

                // Open the drawer!
                openDrawer();

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
                    calcForm.value.idCardPhoto = data.photo_base64 || '';
                    calcForm.value.expireDate = data.expire_date || '';

                    console.log('Read ID Card Success:', data.full_name);
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

        const openCamera = () => {
            showCameraModal.value = true;
            nextTick(async () => {
                try {
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

        return {
            currentTab,
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
            isPrintReady,
            uploadToBucket,
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
            saveModalSignature,
            clearModalSignature
        };
    }
}).mount('#app');
