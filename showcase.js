
(function () {
    window.App.Showcase = {
        async render() {
            // Fetch Produced Batches (Inventory of Dough)
            const batches = await window.App.Storage.getAllItems('production_logs') || [];
            // Optimistic Fetch for Fallback Cost Calculation
            const recipes = await window.App.Storage.getAllItems('recipes') || [];
            const ingredients = await window.App.Storage.getAllItems('ingredients') || [];

            // Sort by newest first
            batches.sort((a, b) => b.startTime - a.startTime);

            return `
            <div class="section-header" style="margin-bottom: 20px;">
                <h2>Vitrin</h2>
                <p style="color: var(--color-text-secondary);">Hazır Hamur Stoğu</p>
            </div>
                
                ${batches.length === 0 ? `
                    <div class="empty-state">
                        <ion-icon name="cube-outline"></ion-icon>
                        <p>Vitrinde hazır hamur yok.</p>
                        <p style="font-size: 0.85rem; color: #777;">Reçete Odası'ndan yeni üretim başlatabilirsiniz.</p>
                        <button class="btn btn-primary" onclick="window.App.navigateTo('recipes')" style="margin-top: 10px;">Reçete Seç</button>
                    </div>
                ` : `
                    <div class="batch-grid">
                        ${batches.map(batch => this.renderBatchCard(batch, recipes, ingredients)).join('')}
                    </div>
                `}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                <p style="color: var(--color-text-secondary); font-size: 0.8rem; margin-bottom: 15px;">Veri Yönetimi</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn" id="btn-backup-export" style="background: rgba(255,255,255,0.05); color: #fff; width: auto; font-size: 0.8rem;">
                        <ion-icon name="cloud-download-outline" style="margin-right:5px;"></ion-icon> Yedek Al
                    </button>
                    <button class="btn" id="btn-backup-import" style="background: rgba(255,255,255,0.05); color: #fff; width: auto; font-size: 0.8rem;">
                        <ion-icon name="cloud-upload-outline" style="margin-right:5px;"></ion-icon> Geri Yükle
                    </button>
                    <input type="file" id="file-import" accept=".json" style="display: none;">
                </div>
            </div>
            `;
        },

        // Helper to get params for speed calc (Ported from Production)
        getBatchParams(batch, temp, allIngredients = []) {
            if (!batch.snapshot || !batch.snapshot.ingredients) return null;

            let totalFlour = batch.snapshot.flourAmount || 1000;
            let totalYeast = 0;
            let yeastType = 'instant';
            let totalSalt = 0;
            let totalFat = 0;
            let totalMilk = 0;
            let water = batch.snapshot.waterAmount || 600;

            batch.snapshot.ingredients.forEach(i => {
                // Lookup full item details
                const item = allIngredients.find(inv => inv.id === i.id);
                if (item) {
                    const nameLower = item.name.toLowerCase();
                    // Check specific type or name match
                    if (item.type === 'yeast' || nameLower.includes('maya') || nameLower.includes('yeast')) {
                        totalYeast += i.amount;
                        if (nameLower.includes('yaş') || nameLower.includes('fresh')) yeastType = 'fresh';
                        else if (nameLower.includes('ekşi') || nameLower.includes('sour')) yeastType = 'sourdough';
                    }
                    if (item.type === 'salt' || nameLower.includes('tuz') || nameLower.includes('salt')) {
                        totalSalt += i.amount;
                    }
                    if (item.type === 'sugar' || nameLower.includes('şeker') || nameLower.includes('sugar')) {
                        // totalSugar += i.amount; // If needed later
                    }
                    // Fat logic
                    if (item.type === 'oil' || item.type === 'fat' || nameLower.includes('yağ') || nameLower.includes('oil') || nameLower.includes('butter') || nameLower.includes('tereyağ')) {
                        totalFat += i.amount;
                    }
                    // Milk logic
                    if (item.type === 'milk' || nameLower.includes('süt') || nameLower.includes('milk')) {
                        totalMilk += i.amount;
                    }
                } else {
                    // Fallback
                    if (i.type === 'yeast') {
                        totalYeast += i.amount;
                        if (i.yeastType) yeastType = i.yeastType;
                    }
                    if (i.type === 'salt') totalSalt += i.amount;
                    // Fallback for fat/milk tags if they exist in snapshot legacy
                }
            });

            return {
                totalFlour,
                yeastAmount: totalYeast,
                yeastType,
                saltAmount: totalSalt,
                waterAmount: water,
                roomTemp: temp,
                // Richness Params
                fatRatio: (totalFat / totalFlour) * 100,
                milkRatio: (totalMilk / totalFlour) * 100
            };
        },

        renderBatchCard(batch, recipes = [], ingredients = []) {
            let recipe = batch.snapshot;

            // 1. Status Text & Colors (Hoisted)
            let statusColor = '#999';
            let statusIcon = 'ellipse';
            let statusLabel = 'Oda';

            if (batch.status === 'fridge') {
                statusColor = '#3498db';
                statusIcon = 'snow';
                statusLabel = 'Dolapta';
            } else if (batch.status === 'room_final') {
                statusColor = '#e67e22';
                statusIcon = 'flame';
                statusLabel = 'Tezgahta';
            } else {
                statusColor = '#f1c40f';
                statusIcon = 'time';
                statusLabel = 'Odada';
            }

            // Fallback: If no snapshot, try to find original recipe
            if (!recipe) {
                const found = recipes.find(r => r.id === batch.recipeId);
                if (found) {
                    recipe = { ...found, recipeName: found.name }; // Mock snapshot
                } else {
                    // Error state card
                    return `
                    <div class="card batch-card" style="border-left: 6px solid #e74c3c; padding: 20px;">
                        <h3 style="color:#e74c3c">Veri Hatası</h3>
                        <p style="color:#aaa; font-size:0.85rem">Bu üretim kaydının verileri bozuk veya silinmiş.</p>
                        <button class="btn btn-text btn-delete-batch" style="color:#e74c3c; margin-top:10px" onclick="window.App.Storage.deleteItem('production_logs', ${batch.id}).then(()=>window.location.reload())">Kaydı Sil</button>
                    </div>`;
                }
            }

            // --- Cost Display Logic ---
            let displayCost = '0.00';
            let isEstimated = false;

            if (batch.snapshot.unitCost !== undefined) {
                // Use snapshotted cost
                displayCost = Number(batch.snapshot.unitCost).toFixed(2);
            } else {
                // Fallback: Calculate on the fly for legacy items
                isEstimated = true;
                const originalRecipe = recipes.find(r => r.id === batch.recipeId);
                if (originalRecipe) {
                    // Quick Calc Logic (Simplified version of recipes.js)
                    let totalCost = 0;
                    const normalize = window.App.Utils.normalizeAmount;

                    // 1. Flour
                    if (originalRecipe.flours && originalRecipe.flours.length > 0) {
                        originalRecipe.flours.forEach(f => {
                            const item = ingredients.find(i => i.id === f.id);
                            if (item && item.packageUnit) {
                                const base = normalize(item.packageSize, item.packageUnit);
                                if (base > 0) totalCost += (item.price / base) * f.amount;
                            }
                        });
                    } else if (originalRecipe.flourId) {
                        const item = ingredients.find(i => i.id === originalRecipe.flourId);
                        if (item && item.packageUnit) {
                            const base = normalize(item.packageSize, item.packageUnit);
                            if (base > 0) totalCost += (item.price / base) * originalRecipe.flourAmount;
                        }
                    }

                    // 2. Extras
                    if (originalRecipe.ingredients) {
                        originalRecipe.ingredients.forEach(ri => {
                            const item = ingredients.find(i => i.id === ri.id);
                            if (item && item.packageUnit) {
                                const base = normalize(item.packageSize, item.packageUnit);
                                if (base > 0) totalCost += (item.price / base) * ri.amount;
                            }
                        });
                    }

                    const yc = Math.floor((originalRecipe.totalWeight || 0) / (originalRecipe.ballWeight || 250));
                    if (yc > 0) displayCost = (totalCost / yc).toFixed(2);
                }
            }
            // --------------------------

            // 1. Calculate Accrued Work (Fermentation Progress)
            const BASELINE_WORK = 180; // Total work units to Peak
            const TOLERANCE_WORK = 180; // Total work units for Tolerance Window (post-peak usability)
            let accruedWork = 0;
            const currentTemp = (batch.status === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);

            // A. Past History
            if (batch.history) {
                batch.history.forEach(h => {
                    const pTemp = (h.phase === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);
                    const params = this.getBatchParams(batch, pTemp, ingredients);
                    let speed = 1.0;
                    if (params && window.App.Engine) {
                        speed = window.App.Engine.calculateFermentationSpeed(params);
                    } else {
                        speed = (h.phase === 'fridge') ? 0.15 : 1.0;
                    }
                    const durationMin = h.duration / 60000;
                    accruedWork += (durationMin * speed);
                });
            }

            // B. Current Phase
            let phaseStartTime = batch.startTime;
            if (batch.status === 'fridge') phaseStartTime = batch.fridgeStartTime;
            if (batch.status === 'room_final') phaseStartTime = batch.finalRoomStartTime;

            const now = Date.now();
            const phaseMs = now - phaseStartTime;
            const currentDurationMin = phaseMs / 60000;

            const currentParams = this.getBatchParams(batch, currentTemp, ingredients);
            let currentSpeed = 1.0;
            if (currentParams && window.App.Engine) {
                currentSpeed = window.App.Engine.calculateFermentationSpeed(currentParams);
            } else {
                currentSpeed = (batch.status === 'fridge') ? 0.15 : 1.0;
            }

            accruedWork += (currentDurationMin * currentSpeed);



            // 2. Determine Phase & Predict Remaining
            let progressPct = 0;
            let remainingText = "";
            let remainingColor = "#aaa";
            let barColor = statusColor; // Default to phase color
            let progressLabel = "Mayalanma";

            if (accruedWork < BASELINE_WORK) {
                // PHASE 1: MATURATION (Mayalanma)
                progressPct = Math.min(100, (accruedWork / BASELINE_WORK) * 100);
                const remainingWork = BASELINE_WORK - accruedWork;

                let timeToPeakMin = 0;
                if (currentSpeed > 0) timeToPeakMin = remainingWork / currentSpeed;

                const h = Math.floor(timeToPeakMin / 60);
                const m = Math.floor(timeToPeakMin % 60);
                remainingText = `${h}s ${m}d sonra HAZIR`;
                remainingColor = "#fff";
                progressLabel = "Mayalanma";
                barColor = statusColor;

            } else {
                // PHASE 2: TOLERANCE (Kullanım Penceresi)
                const consumedTolerance = accruedWork - BASELINE_WORK;
                const remainingToleranceWork = Math.max(0, TOLERANCE_WORK - consumedTolerance);

                // Calculate Tolerance % (How much of the window is GONE)
                progressPct = Math.min(100, (consumedTolerance / TOLERANCE_WORK) * 100);

                let timeToSpoilMin = 0;
                if (currentSpeed > 0) timeToSpoilMin = remainingToleranceWork / currentSpeed;

                const h = Math.floor(timeToSpoilMin / 60);
                const m = Math.floor(timeToSpoilMin % 60);

                if (timeToSpoilMin > 0) {
                    remainingText = `<ion-icon name="hourglass-outline" style="vertical-align:text-bottom"></ion-icon> ${h}s ${m}d Kullanılabilir`;
                    remainingColor = "var(--color-success)";
                    progressLabel = "Tolerans (Kalan Süre)";

                    // Dynamic Bar Color based on consumption
                    if (progressPct < 50) barColor = "var(--color-success)"; // Fresh
                    else if (progressPct < 80) barColor = "#f1c40f"; // Warning
                    else barColor = "#e74c3c"; // Critical
                } else {
                    remainingText = "AŞIRI MAYALANMA!";
                    remainingColor = "#e74c3c";
                    progressLabel = "Süre Doldu";
                    barColor = "#e74c3c";
                }
            }


            // 3. (Restored) Calculate Total Age
            const ageMs = Date.now() - batch.startTime;

            return `
                <div class="card recipe-card batch-card" data-id="${batch.id}" style="
                    border-left: 6px solid ${statusColor};
                    cursor:pointer;
                    position:relative;
                    overflow:hidden;
                    display:flex;
                    flex-direction:column;
                    height:100%;
                    padding:20px;
                ">
                    <div style="
                        position:absolute;
                        top:0; right:0;
                        padding:6px 12px;
                        background:${statusColor};
                        color:${batch.status === 'fridge' ? '#fff' : '#000'};
                        font-size:0.75rem; 
                        font-weight:bold; 
                        border-bottom-left-radius:12px;
                        display:flex;
                        align-items:center;
                        gap:4px;
                    ">
                        <ion-icon name="${statusIcon}-outline"></ion-icon> ${statusLabel}
                    </div>

                    <div style="margin-bottom:15px;">
                        <h3 style="font-size:1.6rem; margin-bottom: 8px; font-weight:700;">${recipe.recipeName || recipe.name}</h3>
                        <div style="display:flex; align-items:center; color:#aaa; font-size:0.95rem;">
                            <ion-icon name="calendar-clear-outline" style="margin-right:6px; color:var(--color-primary);"></ion-icon>
                            Bugün ${new Date(batch.startTime).toLocaleTimeString().slice(0, 5)}
                        </div>
                    </div>

                    <!-- Dynamic Progress Bar -->
                    <div style="margin-bottom:20px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px; color:#aaa;">
                                <span>${progressLabel}: <span style="color:${barColor}; font-weight:bold;">%${Math.round(progressPct)}</span></span>
                                <span id="batch-remaining-${batch.id}" style="color:${remainingColor}; font-weight:bold; font-size:0.75rem;">${remainingText}</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;">
                                <div id="batch-progress-${batch.id}" style="width:${progressPct}%; background:${barColor}; height:100%; transition: width 0.5s;"></div>
                            </div>
                    </div>
                    
                    <div style="margin-top:auto;">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                             <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; display:flex; flex-direction:column; justify-content:center;">
                                <!-- Total Timer -->
                                <div style="text-align:center; margin-bottom:8px;">
                                    <div style="font-size:0.7rem; color:#777; text-transform:uppercase; margin-bottom:2px;">TOPLAM</div>
                                    <div class="batch-timer-display" data-start-time="${batch.startTime}" style="font-size:1.1rem; font-weight:bold; color:#fff; font-variant-numeric: tabular-nums;">
                                        ${this.fmt(ageMs)}
                                    </div>
                                </div>
                                <!-- Phase Timer -->
                                <div style="text-align:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                                    <div style="font-size:0.7rem; color:${statusColor}; text-transform:uppercase; margin-bottom:2px;">${statusLabel}</div>
                                    <div class="batch-timer-display" data-start-time="${phaseStartTime}" style="font-size:1.1rem; font-weight:bold; color:${statusColor}; font-variant-numeric: tabular-nums;">
                                        ${this.fmt(phaseMs)}
                                    </div>
                                </div>
                             </div>
                             <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;">
                                <div style="font-size:0.75rem; color:#777; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Ağırlık</div>
                                <div style="font-size:1.4rem; color:#ddd;">
                                    ${recipe.totalWeight}g
                                </div>
                             </div>
                        </div>

                        <div style="font-size:0.85rem; color:#666; display:flex; gap:15px; flex-wrap: wrap;">
                             <span><ion-icon name="water-outline" style="vertical-align:text-bottom"></ion-icon> %${recipe.hydration} Su</span>
                             <span><ion-icon name="pizza-outline" style="vertical-align:text-bottom"></ion-icon> ${recipe.yieldCount} Adet</span>
                             <span style="color: var(--color-success); font-weight: bold;">
                                <ion-icon name="cash-outline" style="vertical-align:text-bottom"></ion-icon>
                                ${displayCost}₺ ${isEstimated ? '<span title="Güncel fiyatlarla tahmini" style="font-size:0.7em; cursor:help;">(Tahmini)</span>' : ''}
                             </span>
                        </div>
                    </div>
                </div >
                `;
        },

        async openBatchModal(id) {
            const batch = await window.App.Storage.getItemById('production_logs', id);
            if (!batch) return;

            // Fetch related data for details
            const recipe = await window.App.Storage.getItemById('recipes', batch.recipeId);
            const allIngredients = await window.App.Storage.getAllItems('ingredients') || [];

            // Discrepancy Fix: Ensure snapshot exists (Mirroring renderBatchCard logic)
            if (!batch.snapshot && recipe) {
                batch.snapshot = JSON.parse(JSON.stringify(recipe)); // Deep-ish copy to avoid ref issues
                batch.snapshot.recipeName = recipe.name;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay open';
            modal.style.zIndex = '2000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h2 style="margin:0;">${batch.recipeName}</h2>
                        <button class="icon-btn btn-close-modal"><ion-icon name="close-outline"></ion-icon></button>
                    </div>
                    
                    <div id="batch-details-container">
                        ${this.renderBatchDetails(batch, recipe, allIngredients)}
                    </div>

            <div style="margin-top:20px; text-align:right; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                <button class="btn btn-text btn-delete-batch" data-id="${batch.id}" style="color:#e74c3c; font-size:0.9rem;">
                    <ion-icon name="trash-outline" style="margin-right:5px;"></ion-icon> Kaydı Sil
                </button>
            </div>
                </div>
                `;

            document.body.appendChild(modal);

            // Close Handler
            modal.querySelector('.btn-close-modal').onclick = () => modal.remove();

            // Re-bindable Events Pattern
            const bindEvents = () => {
                const container = modal.querySelector('#batch-details-container') || modal; // Fallback to modal for first bind if needed, but container exists

                // Re-bind delete (outside container, but safe to re-bind or keep static. It's static outside container)
                // Actually delete button is OUTSIDE container in my new HTML above. So static bind is fine.

                // Action Buttons
                container.querySelectorAll('.btn-action-modal').forEach(btn => {
                    btn.onclick = async () => {
                        const action = btn.dataset.action;
                        await this.handleAction(action, batch.id);
                        modal.remove();

                        if (action === 'complete') {
                            await window.App.showAlert('Bilgi', 'Hamur kullanıldı ve stoktan düşüldü.');
                            this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                            return;
                        }
                        this.openBatchModal(batch.id); // Re-open full modal for actions that change state significantly
                        this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                    };
                });

                // Temperature Input - Dynamic Update
                container.querySelectorAll('.temp-input-field').forEach(input => {
                    input.onchange = async () => {
                        const id = input.dataset.id;
                        const type = input.dataset.type; // 'room' or 'fridge'
                        const val = parseFloat(input.value);

                        if (!isNaN(val)) {
                            // 1. Update Memory
                            if (type === 'room') batch.roomTemp = val;
                            if (type === 'fridge') batch.fridgeTemp = val;

                            // 2. Persist
                            await this.updateBatchTemp(id, type, val);

                            // 3. Re-Render Visuals (Scientific Recalc)
                            const newHTML = this.renderBatchDetails(batch, recipe, allIngredients);
                            document.getElementById('batch-details-container').innerHTML = newHTML;

                            // 4. Re-Bind Events (elements replaced)
                            bindEvents();
                        }
                    };
                });
            };

            // Static Binds (Outside Container)
            modal.querySelector('.btn-delete-batch').onclick = async () => {
                if (await window.App.showConfirm('Onay', 'Silmek istiyor musunuz?')) {
                    window.App.Storage.deleteItem('production_logs', batch.id).then(() => {
                        modal.remove();
                        this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                    });
                }
            };

            // Initial Bind
            bindEvents();

            // --- LIVE UPDATE LOGIC ---
            const updateTimers = () => {
                const now = Date.now();
                // We need to re-calculate times based on the original batch object + elapsed time
                // Since 'batch' object here is a snapshot from when modal opened, strict correctness requires
                // either updating 'batch' locally or re-fetching.
                // For 'elapsed' visuals, we can just calc diffs.

                // However, simpler is to call a helper that returns the text values
                const times = this.calculateBatchTimes(batch);

                const elPhase = modal.querySelector('#timer-phase-val');
                const elTotal = modal.querySelector('#timer-total-val');
                const elRoom = modal.querySelector('#timer-room-val');
                const elFridge = modal.querySelector('#timer-fridge-val');

                if (elPhase) elPhase.innerText = this.fmt(times.currentPhaseDuration); // Kept for compat if needed, or remove
                if (elTotal) elTotal.innerText = this.fmt(times.totalDuration);
                if (elRoom) elRoom.innerText = this.fmt(times.totalRoomTime);
                if (elFridge) elFridge.innerText = this.fmt(times.totalFridgeTime);
            };

            // Initial call
            // updateTimers(); // rendered with initial values already

            // Interval
            const intervalId = setInterval(updateTimers, 1000);

            // Cleanup on close
            const originalClose = modal.querySelector('.btn-close-modal').onclick;
            modal.querySelector('.btn-close-modal').onclick = () => {
                clearInterval(intervalId);
                originalClose();
            };
            // Also cleanup if removed via other means (actions) - we handle this by ensuring modal.remove() stops things?
            // Actually the actions call modal.remove(). logic above in actions needs to handle this or we rely on garbage collection?
            // Intervals don't garbage collect automatically if checking DOM.
            // Better: attach intervalId to modal for manual cleanup reference or wrap remove.
            modal._intervalId = intervalId;

            // Patch remove to clear interval
            const _remove = modal.remove.bind(modal);
            modal.remove = () => {
                clearInterval(intervalId);
                _remove();
            };
        },

        // Helper to format duration
        fmt(ms) {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            return `${h}s ${m}d ${s} sn`;
        },

        calculateBatchTimes(batch) {
            const now = Date.now();
            let totalRoomTime = 0;
            let totalFridgeTime = 0;

            // 1. Sum up history
            if (batch.history && batch.history.length > 0) {
                batch.history.forEach(h => {
                    if (h.phase === 'room') totalRoomTime += h.duration;
                    if (h.phase === 'fridge') totalFridgeTime += h.duration;
                });
            }

            // 2. Add current active phase duration
            let currentPhaseDuration = 0;
            if (batch.status === 'room') {
                currentPhaseDuration = now - batch.startTime;
                totalRoomTime += currentPhaseDuration;
            } else if (batch.status === 'fridge') {
                currentPhaseDuration = now - batch.fridgeStartTime;
                totalFridgeTime += currentPhaseDuration;
            } else if (batch.status === 'room_final') {
                currentPhaseDuration = now - batch.finalRoomStartTime;
                totalRoomTime += currentPhaseDuration;
            }

            const totalDuration = now - batch.startTime;

            return { totalRoomTime, totalFridgeTime, currentPhaseDuration, totalDuration };
        },

        renderBatchDetails(batch, recipe, allIngredients) {
            const times = this.calculateBatchTimes(batch);

            // 1. Calculate Accrued Work (Fermentation Progress)
            const BASELINE_WORK = 180; // Total work units to Peak
            const TOLERANCE_WORK = 180; // Total work units for Tolerance Window (post-peak usability)
            let accruedWork = 0;

            // Temperature defaults (ensure they are set before currentTemp is used)
            if (!batch.roomTemp) batch.roomTemp = 24;
            if (!batch.fridgeTemp) batch.fridgeTemp = 4;

            const currentTemp = (batch.status === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);

            // A. Past History
            if (batch.history) {
                batch.history.forEach(h => {
                    const pTemp = (h.phase === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);
                    const params = this.getBatchParams(batch, pTemp, allIngredients);
                    let speed = 1.0;
                    if (params && window.App.Engine) {
                        speed = window.App.Engine.calculateFermentationSpeed(params);
                    } else {
                        speed = (h.phase === 'fridge') ? 0.15 : 1.0;
                    }
                    const durationMin = h.duration / 60000;
                    accruedWork += (durationMin * speed);
                });
            }

            // B. Current Phase
            let phaseStartTime = batch.startTime;
            if (batch.status === 'fridge') phaseStartTime = batch.fridgeStartTime;
            if (batch.status === 'room_final') phaseStartTime = batch.finalRoomStartTime;

            const now = Date.now();
            const phaseMs = now - phaseStartTime;
            const currentDurationMin = phaseMs / 60000;

            const currentParams = this.getBatchParams(batch, currentTemp, allIngredients);
            let currentSpeed = 1.0;
            if (currentParams && window.App.Engine) {
                currentSpeed = window.App.Engine.calculateFermentationSpeed(currentParams);
            } else {
                currentSpeed = (batch.status === 'fridge') ? 0.15 : 1.0;
            }

            accruedWork += (currentDurationMin * currentSpeed);

            // 2. Determine Phase & Predict Remaining
            let progressPct = 0;
            let remainingText = "";
            let remainingColor = "#aaa";
            let statusText = "";
            let phaseColor = "#555";
            let progressLabel = "Mayalanma";
            let barColor = "#555"; // Initial fallback

            if (batch.status === 'fridge') {
                statusText = "DOLAP (FERMANTASYON)";
                phaseColor = '#3498db';
                barColor = '#3498db';
            } else if (batch.status === 'room_final') {
                statusText = "ODA (FERMANTASYON)";
                phaseColor = '#e67e22';
                barColor = '#e67e22';
            } else {
                statusText = "ODA (FERMANTASYON)";
                phaseColor = '#f1c40f';
                barColor = '#f1c40f';
            }


            if (accruedWork < BASELINE_WORK) {
                // PHASE 1: MATURATION (Mayalanma)
                progressPct = Math.min(100, (accruedWork / BASELINE_WORK) * 100);
                const remainingWork = BASELINE_WORK - accruedWork;

                let timeToPeakMin = 9999;
                if (currentSpeed > 0) {
                    timeToPeakMin = remainingWork / currentSpeed;
                    const h = Math.floor(timeToPeakMin / 60);
                    const m = Math.floor(timeToPeakMin % 60);
                    remainingText = `${h}s ${m}d sonra HAZIR`;
                    remainingColor = "#fff";
                } else {
                    remainingText = "STOP (Hız: 0)";
                    remainingColor = "#e74c3c";
                }
                progressLabel = "Mayalanma";

            } else {
                // PHASE 2: TOLERANCE (Kullanım Penceresi)
                const consumedTolerance = accruedWork - BASELINE_WORK;
                const remainingToleranceWork = Math.max(0, TOLERANCE_WORK - consumedTolerance);

                // Calculate Tolerance % (How much of the window is GONE)
                progressPct = Math.min(100, (consumedTolerance / TOLERANCE_WORK) * 100);

                let timeToSpoilMin = 0;
                if (currentSpeed > 0) timeToSpoilMin = remainingToleranceWork / currentSpeed;

                const h = Math.floor(timeToSpoilMin / 60);
                const m = Math.floor(timeToSpoilMin % 60);

                if (timeToSpoilMin > 0) {
                    remainingText = `<ion-icon name="hourglass-outline" style="vertical-align:text-bottom"></ion-icon> ${h}s ${m}d Kullanılabilir`;
                    remainingColor = "var(--color-success)";
                    progressLabel = "Tolerans (Kalan Süre)";

                    // Dynamic Bar Color based on consumption
                    if (progressPct < 50) barColor = "var(--color-success)"; // Fresh
                    else if (progressPct < 80) barColor = "#f1c40f"; // Warning
                    else barColor = "#e74c3c"; // Critical
                } else {
                    remainingText = "AŞIRI MAYALANMA!";
                    remainingColor = "#e74c3c";
                    progressLabel = "Süre Doldu";
                    barColor = "#e74c3c";
                }
            }

            let mainActionBtn = "";
            let tempType = 'room';

            if (batch.status === 'room') {
                mainActionBtn = `<button class="btn btn-primary btn-action-modal" data-action="to_fridge" style="width:100%; padding:15px; font-size:1.1rem;">❄️ Dolaba Al</button>`;
                tempType = 'room';
            }
            else if (batch.status === 'fridge') {
                mainActionBtn = `<button class="btn btn-warning btn-action-modal" data-action="from_fridge" style="width:100%; color:black; padding:15px; font-size:1.1rem;">🔥 Dolaptan Çıkar</button>`;
                tempType = 'fridge';
            }
            else if (batch.status === 'room_final') {
                mainActionBtn = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button class="btn btn-secondary btn-action-modal" data-action="to_fridge">
                            ❄️ Dolaba Geri Al
                        </button>
                        <button class="btn btn-primary btn-action-modal" data-action="complete" style="background:#27ae60;">
                            ✅ Tamamla
                        </button>
                    </div>
                `;
                tempType = 'room';
            }


            // Ingredients and tags logic
            let milkAmount = 0;
            let oilAmount = 0;
            let labelsHTML = '';

            if (recipe && recipe.ingredients) {
                recipe.ingredients.forEach(ri => {
                    const invItem = allIngredients.find(i => i.id === ri.id);
                    if (invItem) {
                        const nameLower = invItem.name.toLowerCase();
                        if (nameLower.includes('süt') || nameLower.includes('milk') || invItem.type === 'milk') {
                            milkAmount += ri.amount;
                        }
                        if (nameLower.includes('yağ') || nameLower.includes('oil') || nameLower.includes('zeytin') || nameLower.includes('olive')) {
                            oilAmount += ri.amount;
                        }
                    }
                });
            }

            const hydration = batch.snapshot.hydration || 60;
            let charLabel = 'Orta';
            let charColor = '#f1c40f';
            if (hydration >= 70) { charLabel = 'Yumuşak'; charColor = '#2ecc71'; }
            else if (hydration > 80) { charLabel = 'Focaccia'; charColor = '#9b59b6'; }
            else if (hydration < 60) { charLabel = 'Sert'; charColor = '#e74c3c'; }

            labelsHTML += `<span class="badge" style="background:${charColor}; color:#000; margin-right:5px;">${charLabel}</span>`;
            if (milkAmount > 0) labelsHTML += `<span class="badge" style="background:#ecf0f1; color:#2c3e50; margin-right:5px;">🥛 Sütlü</span>`;
            if (oilAmount > 0) labelsHTML += `<span class="badge" style="background:#e67e22; color:#fff; margin-right:5px;">🛢️ Yağlı</span>`;


            return `
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                     <div style="text-align:center; margin-bottom:20px;">
                        <span class="badge" style="background:${phaseColor}; color:${batch.status === 'fridge' ? '#fff' : '#000'}; font-size:1.2rem; padding:8px 16px;">${statusText}</span>
                     </div>
                     
                     <!-- Modal Progress Bar -->
                    <div style="margin-bottom:20px; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px; color:#aaa;">
                                <span>${progressLabel}: <span style="color:#fff; font-weight:bold;">%${Math.round(progressPct)}</span></span>
                                <span style="color:${remainingColor}; font-weight:bold;">${remainingText}</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.1); height:10px; border-radius:5px; overflow:hidden;">
                                <div style="width:${progressPct}%; background:${barColor}; height:100%; transition: width 0.5s;"></div>
                            </div>
                    </div>

                    <!-- DEBUG INFO (Visible) -->
                    <div style="font-size:0.6rem; color:#666; margin-top:5px; border-top:1px solid #333; padding-top:2px; font-family:monospace; margin-bottom:10px;">
                        DEBUG: S=${Math.round(currentSpeed * 1000) / 1000} | W=${Math.round(accruedWork)}/${BASELINE_WORK} | R=${Math.round(BASELINE_WORK - accruedWork)}
                    </div>

                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-bottom:10px;">
                        <!-- Left Timer Block -->
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                             ${batch.status === 'room_final' ? `
                                <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">TEZGAH SÜRESİ</div>
                                <div id="timer-room-val" style="font-size:1.2rem; font-weight:bold; color:#e67e22; font-variant-numeric: tabular-nums;">
                                    ${this.fmt(times.currentPhaseDuration)}
                                </div>
                                <div style="font-size:0.7rem; color:#777; margin-top:2px;">Toplam Oda: ${this.fmt(times.totalRoomTime)}</div>
                             ` : `
                                <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">ODA SÜRESİ</div>
                                <div id="timer-room-val" style="font-size:1.2rem; font-weight:bold; color:#f1c40f; font-variant-numeric: tabular-nums;">
                                    ${batch.status === 'room' ? this.fmt(times.currentPhaseDuration) : this.fmt(times.totalRoomTime)}
                                </div>
                             `}
                        </div>

                        <!-- Right Timer Block -->
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">DOLAP SÜRESİ</div>
                            <div id="timer-fridge-val" style="font-size:1.2rem; font-weight:bold; color:#3498db; font-variant-numeric: tabular-nums;">
                                ${batch.status === 'fridge' ? this.fmt(times.currentPhaseDuration) : this.fmt(times.totalFridgeTime)}
                            </div>
                            ${(times.totalFridgeTime > 0 && batch.status !== 'fridge') ? `
                                <div style="font-size:0.7rem; color:#777; margin-top:2px;">Toplam: ${this.fmt(times.totalFridgeTime)}</div>
                            ` : ''}
                        </div>
                     </div>

                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">GÜNCEL ISI</div>
                            <div style="display:flex; align-items:center; justify-content:center;">
                                <input type="number" class="temp-input-field" data-id="${batch.id}" data-type="${tempType}" value="${currentTemp}" 
                                style="width: 50px; background:transparent; border:none;  border-bottom:1px solid #555; color:#fff; font-size:1.4rem; font-weight:bold; text-align:center; padding:0;">
                                <span style="font-size:1.2rem; color:#aaa; margin-left:2px;">°C</span>
                            </div>
                        </div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">TOPLAM YAŞ</div>
                            <div id="timer-total-val" style="font-size:1.2rem; font-weight:bold; overflow:hidden; white-space:nowrap; font-variant-numeric: tabular-nums;">${this.fmt(times.totalDuration)}</div>
                        </div>
                     </div>
                </div>
                
                <div style="margin-bottom:25px;">
                    ${mainActionBtn}
                </div>

                <div style="font-size:0.95rem; color:#ccc; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;">
                        ${labelsHTML}
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="color:#888;">💧 Su:</span>
                        <span style="font-family:monospace;">${batch.snapshot.waterAmount} g</span>
                    </div>
                    ${milkAmount > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="color:#888;">🥛 Süt:</span>
                        <span style="font-family:monospace;">${milkAmount} g</span>
                    </div>` : ''}
                    ${oilAmount > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="color:#888;">🛢️ Yağ:</span>
                        <span style="font-family:monospace;">${oilAmount} g</span>
                    </div>` : ''}

                     <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                        <span style="color:#888;">🧂 Un:</span>
                        <span style="font-family:monospace;">${batch.snapshot.flourName}</span>
                    </div>
                     <div style="display:flex; justify-content:space-between;">
                        <span style="color:#888;">Toplam Ağırlık:</span>
                        <span style="font-weight:bold;">${batch.snapshot.totalWeight} g</span>
                    </div>
                </div>
            `;
        },


        async updateBatchTemp(id, type, val) {
            const batch = await window.App.Storage.getItemById('production_logs', id);
            if (!batch) return;

            if (type === 'room') batch.roomTemp = val;
            if (type === 'fridge') batch.fridgeTemp = val;

            await window.App.Storage.updateItem('production_logs', batch);
        },

        async handleAction(action, id) {
            const batch = await window.App.Storage.getItemById('production_logs', id);
            if (!batch) return;

            const now = Date.now();

            if (action === 'to_fridge') {
                // Ending a Room Phase (either initial 'room' or 'room_final')
                let duration = 0;
                if (batch.status === 'room_final' && batch.finalRoomStartTime) {
                    duration = now - batch.finalRoomStartTime;
                } else {
                    duration = now - batch.startTime;
                }

                batch.history = batch.history || [];
                batch.history.push({ phase: 'room', duration: duration });

                batch.status = 'fridge';
                batch.fridgeStartTime = now;
            }
            else if (action === 'from_fridge') {
                // Ending Fridge Phase
                let duration = 0;
                if (batch.fridgeStartTime) {
                    duration = now - batch.fridgeStartTime;
                }

                batch.history = batch.history || [];
                batch.history.push({ phase: 'fridge', duration: duration });

                batch.status = 'room_final';
                batch.finalRoomStartTime = now;
            }
            else if (action === 'complete') {
                await window.App.Storage.deleteItem('production_logs', batch.id);
                return; // Batch deleted
            }

            await window.App.Storage.updateItem('production_logs', batch);
        },

        afterRender() {
            // Grid Click
            document.querySelectorAll('.batch-card').forEach(card => {
                card.onclick = () => {
                    this.openBatchModal(card.dataset.id);
                };
            });

            // Backup Handlers (Keep existing logic)
            const btnExport = document.getElementById('btn-backup-export');
            const btnImport = document.getElementById('btn-backup-import');
            const fileInput = document.getElementById('file-import');
            if (btnExport) btnExport.onclick = async () => await window.App.Storage.exportAllData();
            if (btnImport) btnImport.onclick = () => fileInput.click();
            if (fileInput) fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        if (await window.App.showConfirm('Onay', "Yedek yüklenecek. Onaylıyor musun?")) {
                            window.App.Storage.importBackupData(json);
                        }
                    } catch (err) { await window.App.showAlert("Hata", "Hata: " + err); }
                };
                reader.readAsText(file);
            };

            // --- MAIN GRID LIVE UPDATE ---
            if (this.mainInterval) clearInterval(this.mainInterval);
            this.updateGridTimers = async () => {
                const now = Date.now();
                // We need data to calculate speed
                // Fetch cached or fresh
                const batches = await window.App.Storage.getAllItems('production_logs') || [];
                const ingredients = await window.App.Storage.getAllItems('ingredients') || [];

                // 1. Update Simple Elasped Timers (Total)
                const cards = document.querySelectorAll('.batch-timer-display');
                cards.forEach(el => {
                    const start = parseInt(el.dataset.startTime);
                    if (!isNaN(start)) el.innerText = this.fmt(now - start);
                });

                // 2. Update Complex Fermentation Status (Remaining & Progress)
                batches.forEach(batch => {
                    const remainingEl = document.getElementById(`batch-remaining-${batch.id}`);
                    const progressEl = document.getElementById(`batch-progress-${batch.id}`);

                    if (remainingEl || progressEl) {
                        // Re-calculate Logic (Simplified version of renderBatchCard)
                        // Note: This duplicates logic. Ideally logic should be centralized.
                        // But for speed we inline crucial parts.

                        const currentTemp = (batch.status === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);
                        const BASELINE_WORK = 180;
                        const TOLERANCE_WORK = 180;
                        let accruedWork = 0;

                        // A. Past History
                        if (batch.history) {
                            batch.history.forEach(h => {
                                const pTemp = (h.phase === 'fridge') ? (batch.fridgeTemp || 4) : (batch.roomTemp || 24);
                                const params = this.getBatchParams(batch, pTemp, ingredients); // Reuse existing helper
                                let speed = params && window.App.Engine ? window.App.Engine.calculateFermentationSpeed(params) : ((h.phase === 'fridge') ? 0.15 : 1.0);
                                accruedWork += (h.duration / 60000) * speed;
                            });
                        }

                        // B. Current Phase
                        let phaseStartTime = batch.startTime;
                        if (batch.status === 'fridge') phaseStartTime = batch.fridgeStartTime;
                        if (batch.status === 'room_final') phaseStartTime = batch.finalRoomStartTime;

                        // Fallback validity check for timestamps
                        if (!phaseStartTime || isNaN(phaseStartTime)) phaseStartTime = batch.startTime;

                        const durationMin = (now - phaseStartTime) / 60000;
                        const currentParams = this.getBatchParams(batch, currentTemp, ingredients);
                        let currentSpeed = currentParams && window.App.Engine ? window.App.Engine.calculateFermentationSpeed(currentParams) : ((batch.status === 'fridge') ? 0.15 : 1.0);

                        accruedWork += durationMin * currentSpeed;

                        // Update UI
                        let progressPct = 0;
                        let remainingText = "";
                        let remainingColor = "#aaa";
                        let barColor = (batch.status === 'fridge') ? '#3498db' : ((batch.status === 'room_final') ? '#e67e22' : '#f1c40f');

                        if (accruedWork < BASELINE_WORK) {
                            progressPct = Math.min(100, (accruedWork / BASELINE_WORK) * 100);
                            const remainingWork = BASELINE_WORK - accruedWork;
                            let timeToPeakMin = (currentSpeed > 0) ? remainingWork / currentSpeed : 0;
                            const h = Math.floor(timeToPeakMin / 60);
                            const m = Math.floor(timeToPeakMin % 60);
                            remainingText = `${h}s ${m}d sonra HAZIR`;
                            remainingColor = "#fff";
                        } else {
                            // Tolerance Phase
                            const consumedTolerance = accruedWork - BASELINE_WORK;
                            const remainingToleranceWork = Math.max(0, TOLERANCE_WORK - consumedTolerance);
                            progressPct = Math.min(100, (consumedTolerance / TOLERANCE_WORK) * 100);
                            let timeToSpoilMin = (currentSpeed > 0) ? remainingToleranceWork / currentSpeed : 0;
                            const h = Math.floor(timeToSpoilMin / 60);
                            const m = Math.floor(timeToSpoilMin % 60);

                            if (timeToSpoilMin > 0) {
                                remainingText = `<ion-icon name="hourglass-outline" style="vertical-align:text-bottom"></ion-icon> ${h}s ${m}d Kullanılabilir`;
                                remainingColor = "var(--color-success)";
                                if (progressPct < 50) barColor = "var(--color-success)";
                                else if (progressPct < 80) barColor = "#f1c40f";
                                else barColor = "#e74c3c";
                            } else {
                                remainingText = "AŞIRI MAYALANMA!";
                                remainingColor = "#e74c3c";
                                barColor = "#e74c3c";
                            }
                        }

                        if (remainingEl) {
                            remainingEl.innerHTML = remainingText;
                            remainingEl.style.color = remainingColor;
                        }
                        if (progressEl) {
                            progressEl.style.width = `${progressPct}%`;
                            progressEl.style.background = barColor; // Update bar color in tolerance
                        }
                    }
                });
            };
            this.mainInterval = setInterval(this.updateGridTimers, 1000);
        }
    };
})();
