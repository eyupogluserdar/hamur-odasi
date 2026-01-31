
(function () {
    let activeBatches = [];
    let timerInterval = null;

    async function refreshData() {
        activeBatches = await window.App.Storage.getAllItems('production_logs') || [];
    }

    // Helper to format duration
    function formatDuration(ms) {
        if (ms < 0) return "0 dk";
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${hours} sa ${minutes} dk`;
    }

    // Helper: Phase Name
    function getPhaseName(phase) {
        const map = { 'room': 'Oda (İlk)', 'fridge': 'Dolap (+4°C)', 'room_final': 'Tezgah (Son)' };
        return map[phase] || phase;
    }

    function getPhaseColor(phase, hours) {
        if (phase === 'fridge') return '#90CAF9'; // Blue
        if (phase === 'room_final') return '#FFAB91'; // Orange
        // Room logic
        if (hours < 4) return 'var(--color-success)';
        if (hours < 24) return 'var(--color-warning)';
        return 'var(--color-danger)';
    }

    window.App.Production = {
        async render() {
            await refreshData();

            // Clean up old interval if exists (although SPA router might handle this, good practice)
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => this.updateUI(), 60000);

            return `
                <div class="section-header">
                    <h2>Fermantasyon Takibi</h2>
                    <p style="color: var(--color-text-secondary);">Aktif Üretimler</p>
                </div>
                
                ${activeBatches.length === 0 ? `
                    <div class="empty-state">
                        <ion-icon name="timer-outline"></ion-icon>
                        <p>Şu an hamur mayalanmıyor.</p>
                        <p style="font-size: 0.8rem; margin-top:5px;">Vitrinden bir reçeteyi üretime alabilirsin.</p>
                    </div>
                ` : `
                    <div class="batch-list" style="display: grid; gap: 16px;">
                        ${activeBatches.sort((a, b) => b.startTime - a.startTime).map(batch => this.renderBatchCard(batch)).join('')}
                    </div>
                `}
            `;
        },

        // Helper to get params for speed calc
        getBatchParams(batch, temp) {
            // Reconstruct params for engine
            // Need: totalFlour, yeastAmount, yeastType, saltAmount, waterAmount, roomTemp
            // We have snapshot.ingredients
            if (!batch.snapshot || !batch.snapshot.ingredients) return null;

            let totalFlour = batch.snapshot.flourAmount || 1000;
            let totalYeast = 0;
            let yeastType = 'instant';
            let totalSalt = 0;
            let water = batch.snapshot.waterAmount || 600;

            // Extract from snapshot ingredients
            // If snapshot is old (no ingredients), use rough defaults or fail gracefully
            batch.snapshot.ingredients.forEach(i => {
                // We need to guess type/name if not fully preserved, but we saved full object in process.js
                // Assuming standard "type" field usage
                if (i.type === 'yeast') {
                    totalYeast += i.amount;
                    if (i.yeastType) yeastType = i.yeastType;
                }
                if (i.type === 'salt') totalSalt += i.amount;
            });

            // If totalFlour is mix, we might need to sum it up if not in snapshot? 
            // Snapshot has flourAmount.

            return {
                totalFlour,
                yeastAmount: totalYeast,
                yeastType,
                saltAmount: totalSalt,
                waterAmount: water,
                roomTemp: temp
            };
        },

        renderBatchCard(batch) {
            const now = Date.now();
            let phaseDuration = 0;
            let statusText = "";
            let phaseColor = "#555";
            let mainActionBtn = "";
            const currentTemp = (batch.status === 'fridge') ? 4 : (batch.snapshot.roomTemp || 24); // Use saved room temp or 24 default

            // 1. Calculate Accrued Work (Fermentation Progress)
            const BASELINE_WORK = 180; // Total work units needed (Minutes at Standard Speed)
            let accruedWork = 0;

            // A. Past History
            if (batch.history) {
                batch.history.forEach(h => {
                    // Determine temp for this phase
                    const pTemp = (h.phase === 'fridge') ? 4 : (batch.snapshot.roomTemp || 24);
                    const params = this.getBatchParams(batch, pTemp);
                    let speed = 1.0;
                    if (params && window.App.Engine) {
                        speed = window.App.Engine.calculateFermentationSpeed(params);
                    } else {
                        // Fallback logic if no params (Old data)
                        speed = (h.phase === 'fridge') ? 0.15 : 1.0;
                    }

                    const durationMin = h.duration / 60000;
                    accruedWork += (durationMin * speed);
                });
            }

            // B. Current Phase
            let currentPhaseStart = batch.startTime;
            if (batch.status === 'fridge') currentPhaseStart = batch.fridgeStartTime;
            if (batch.status === 'room_final') currentPhaseStart = batch.finalRoomStartTime;

            phaseDuration = now - currentPhaseStart;
            const currentDurationMin = phaseDuration / 60000;

            const currentParams = this.getBatchParams(batch, currentTemp);
            let currentSpeed = 1.0;
            if (currentParams && window.App.Engine) {
                currentSpeed = window.App.Engine.calculateFermentationSpeed(currentParams);
            } else {
                currentSpeed = (batch.status === 'fridge') ? 0.15 : 1.0;
            }

            accruedWork += (currentDurationMin * currentSpeed);

            // 2. Predict Remaining
            const remainingWork = Math.max(0, BASELINE_WORK - accruedWork);
            let timeToPeakMin = 0;
            if (currentSpeed > 0) {
                timeToPeakMin = remainingWork / currentSpeed;
            }

            const progressPct = Math.min(100, (accruedWork / BASELINE_WORK) * 100);

            // UI Logic
            if (batch.status === 'room') {
                statusText = `Oda Sıcaklığı (${currentTemp}°C)`;
                phaseColor = getPhaseColor('room', phaseDuration / 3600000);
                mainActionBtn = `<button class="btn btn-primary btn-action" data-action="to_fridge" data-id="${batch.id}">Dolaba Al ❄️</button>`;
            }
            else if (batch.status === 'fridge') {
                statusText = "Dolapta (+4°C)";
                phaseColor = getPhaseColor('fridge');
                mainActionBtn = `<button class="btn btn-warning btn-action" data-action="from_fridge" data-id="${batch.id}" style="color:#000;">Dolaptan Çıkar 🔥</button>`;
            }
            else if (batch.status === 'room_final') {
                statusText = "Tezgaha Alındı (Son Evre)";
                phaseColor = getPhaseColor('room_final');
                mainActionBtn = `<span class="badge" style="background:rgba(255,255,255,0.1);">Hazırlanıyor</span>`;
            }

            const totalDuration = now - batch.startTime;

            // Format Remaining
            let remainingText = "";
            let remainingColor = "#aaa";
            if (timeToPeakMin <= 0) {
                remainingText = "PİK NOKTASI! (Hazır)";
                remainingColor = "var(--color-success)";
            } else {
                const h = Math.floor(timeToPeakMin / 60);
                const m = Math.floor(timeToPeakMin % 60);
                remainingText = `${h} sa ${m} dk sonra hazır`;
                remainingColor = "#fff";
            }

            return `
                <div class="card" style="border-left: 4px solid ${phaseColor};">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin:0; font-size:1.1rem;">${batch.recipeName}</h3>
                            <span style="font-size: 0.8rem; opacity: 0.7; display:block; margin-top:2px;">
                                <ion-icon name="time-outline" style="vertical-align:middle"></ion-icon>
                                Başlangıç: ${new Date(batch.startTime).toLocaleTimeString().slice(0, 5)}
                            </span>
                        </div>
                         
                        <div style="text-align:right;">
                             <span class="badge" style="background:${phaseColor}; color:${batch.status === 'fridge' ? '#000' : '#fff'}; font-weight:bold;">
                                ${statusText}
                            </span>
                        </div>
                    </div>

                    <div class="card-body" style="margin: 15px 0;">
                        <!-- Progress Bar -->
                        <div style="margin-bottom:15px;">
                             <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px; color:#aaa;">
                                <span>Fermantasyon Durumu</span>
                                <span style="color:${remainingColor}; font-weight:bold;">${remainingText}</span>
                             </div>
                             <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;">
                                <div style="width:${progressPct}%; background:${progressPct >= 100 ? 'var(--color-success)' : 'var(--color-primary)'}; height:100%; transition: width 0.5s;"></div>
                             </div>
                        </div>

                        <!-- Dual Timer Display -->
                        <div style="display: flex; gap: 10px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; align-items: center; justify-content: space-around;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px;">Bu Evre</div>
                                <div style="font-size: 1.8rem; font-weight: 300; line-height: 1.2; margin-top: 4px; color: ${phaseColor};">
                                    ${formatDuration(phaseDuration)}
                                </div>
                            </div>
                            <div style="width: 1px; height: 40px; background: rgba(255,255,255,0.1);"></div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px;">Toplam Geçen</div>
                                <div style="font-size: 1.8rem; font-weight: 300; line-height: 1.2; margin-top: 4px;">
                                    ${formatDuration(totalDuration)}
                                </div>
                            </div>
                        </div>

                        <!-- History Logs -->
                        ${batch.history && batch.history.length > 0 ? `
                            <div style="margin-top: 12px; font-size: 0.85rem; color: #aaa;">
                                <div style="margin-bottom:4px; font-weight:bold; color:#777;">GEÇMİŞ EVRELER</div>
                                ${batch.history.map(h => `
                                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding: 2px 0;">
                                        <span>${getPhaseName(h.phase)}</span>
                                        <span>${formatDuration(h.duration)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>

                    <div class="card-actions" style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; gap:10px;">
                            ${mainActionBtn}
                        </div>
                        
                         <div style="display:flex; gap:10px;">
                            <button class="btn btn-success btn-finish" data-id="${batch.id}" title="Üretimi Tamamla">
                                Bitir ✅
                            </button>
                            <button class="icon-btn btn-cancel-batch" data-id="${batch.id}" style="color: var(--color-danger); opacity: 0.7;">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        async startProduction(recipeId) {
            const recipe = await window.App.Storage.getItemById('recipes', recipeId);
            const ingredients = await window.App.Storage.getAllItems('ingredients') || [];

            if (!recipe) {
                await window.App.showAlert('Hata', "Reçete bulunamadı!");
                return;
            }

            // --- Cost Calculation Logic (Snapshotting current prices) ---
            let totalCost = 0;
            const normalize = window.App.Utils.normalizeAmount;

            // 1. Flour Cost
            if (recipe.flours && recipe.flours.length > 0) {
                recipe.flours.forEach(f => {
                    const flourItem = ingredients.find(i => i.id === f.id);
                    if (flourItem && flourItem.price && flourItem.packageSize) {
                        const unit = flourItem.packageUnit;
                        if (unit) {
                            const packBase = normalize(flourItem.packageSize, unit);
                            const pricePerGram = (packBase > 0) ? (flourItem.price / packBase) : 0;
                            totalCost += (f.amount || 0) * pricePerGram;
                        }
                    }
                });
            } else if (recipe.flourId) {
                const flour = ingredients.find(i => i.id === recipe.flourId);
                if (flour && flour.price && flour.packageSize) {
                    const unit = flour.packageUnit;
                    if (unit) {
                        const packBase = normalize(flour.packageSize, unit);
                        const pricePerGram = (flour.price / packBase);
                        totalCost += (recipe.flourAmount || 0) * pricePerGram;
                    }
                }
            }

            // 2. Ingredients Cost
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ri => {
                    const invItem = ingredients.find(i => i.id === ri.id);
                    if (invItem && invItem.price && invItem.packageSize) {
                        const unit = invItem.packageUnit;
                        if (unit) {
                            const packBase = normalize(invItem.packageSize, unit);
                            const pricePerGram = (packBase > 0) ? (invItem.price / packBase) : 0;
                            totalCost += ri.amount * pricePerGram;
                        }
                    }
                });
            }

            const yieldCount = Math.floor((recipe.totalWeight || 0) / (recipe.ballWeight || 250));
            const unitCost = yieldCount > 0 ? (totalCost / yieldCount) : 0;
            // ------------------------------------------------------------


            // Snapshot critical data
            let flourName = 'Un';
            if (recipe.flours && recipe.flours.length > 0) {
                const names = [];
                recipe.flours.forEach(f => {
                    const item = ingredients.find(i => i.id === f.id);
                    if (item) names.push(item.name);
                });
                flourName = names.length > 0 ? names.join(' + ') : 'Mix Un';
            } else if (recipe.flourId) {
                const f = ingredients.find(i => i.id === recipe.flourId);
                if (f) flourName = f.name;
            }

            const snapshot = {
                recipeId: recipe.id,
                recipeName: recipe.name,
                flourName: flourName,
                flourAmount: recipe.flourAmount,
                waterAmount: recipe.waterAmount,
                hydration: recipe.hydration,
                totalWeight: recipe.totalWeight,
                ballWeight: recipe.ballWeight,
                yieldCount: yieldCount,
                totalCost: parseFloat(totalCost.toFixed(2)),
                unitCost: parseFloat(unitCost.toFixed(2)),
                // Expanded Snapshot Data
                roomTemp: recipe.roomTemp,
                ingredients: recipe.ingredients,
                flours: recipe.flours,
                flourId: recipe.flourId,
                waterTemp: recipe.waterTemp,
                targetTime: recipe.targetTime
            };

            const newBatch = {
                id: Date.now().toString(),
                recipeId: recipe.id,
                recipeName: recipe.name,
                snapshot: snapshot,
                startTime: Date.now(),
                fridgeStartTime: null,
                finalRoomStartTime: null,
                status: 'room',
                history: []
            };

            await window.App.Storage.addItem('production_logs', newBatch);
            window.App.navigateTo('production');
        },

        async handleAction(action, id) {
            // Fetch fresh
            const batch = await window.App.Storage.getItemById('production_logs', id);
            if (!batch) return;

            if (action === 'to_fridge') {
                batch.status = 'fridge';
                batch.fridgeStartTime = Date.now();
                batch.history.push({ phase: 'room', duration: Date.now() - batch.startTime });
            }
            else if (action === 'from_fridge') {
                batch.status = 'room_final';
                batch.finalRoomStartTime = Date.now();
                batch.history.push({ phase: 'fridge', duration: Date.now() - batch.fridgeStartTime });
            }

            await window.App.Storage.updateItem('production_logs', batch);
            this.updateUI();
        },

        async finishBatch(id) {
            if (await window.App.showConfirm(
                "Üretimi Bitir",
                "Stoğa almak istiyor musun?"
            )) {
                await window.App.Storage.deleteItem('production_logs', id);
                this.updateUI();
            }
        },

        async cancelBatch(id) {
            if (await window.App.showConfirm(
                "İptal Et",
                "Bu kayıt silinecek. Emin misin?"
            )) {
                await window.App.Storage.deleteItem('production_logs', id);
                this.updateUI();
            }
        },

        async updateUI() {
            const mainView = document.getElementById('main-view');
            // Check if we are in production view
            if (window.App.Production && mainView && document.querySelector('.section-header h2')?.textContent === 'Fermantasyon Takibi') {
                // We re-render the whole view to capture data updates
                mainView.innerHTML = await this.render();
                this.afterRender();
            }
        },

        afterRender() {
            const self = this;
            document.querySelectorAll('.btn-action, .btn-finish, .btn-cancel-batch').forEach(btn => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;

                btn.onclick = () => {
                    if (action) self.handleAction(action, id);
                    else if (btn.classList.contains('btn-finish')) self.finishBatch(id);
                    else if (btn.classList.contains('btn-cancel-batch')) self.cancelBatch(id);
                }
            });
        }
    };
})();
