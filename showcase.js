
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

        renderBatchCard(batch, recipes = [], ingredients = []) {
            const recipe = batch.snapshot;

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

            // Status Color & Icon
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

            // Calculate Total Age
            const ageMs = Date.now() - batch.startTime;

            // Calculate Phase Time
            let phaseStartTime = batch.startTime;
            if (batch.status === 'fridge' && batch.fridgeStartTime) phaseStartTime = batch.fridgeStartTime;
            if (batch.status === 'room_final' && batch.finalRoomStartTime) phaseStartTime = batch.finalRoomStartTime;

            const phaseMs = Date.now() - phaseStartTime;

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

                    <div style="margin-bottom:20px;">
                        <h3 style="font-size:1.6rem; margin-bottom: 8px; font-weight:700;">${recipe.recipeName || recipe.name}</h3>
                        <div style="display:flex; align-items:center; color:#aaa; font-size:0.95rem;">
                            <ion-icon name="calendar-clear-outline" style="margin-right:6px; color:var(--color-primary);"></ion-icon>
                            Bugün ${new Date(batch.startTime).toLocaleTimeString().slice(0, 5)}
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

            const modal = document.createElement('div');
            modal.className = 'modal-overlay open';
            modal.style.zIndex = '2000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h2 style="margin:0;">${batch.recipeName}</h2>
                        <button class="icon-btn btn-close-modal"><ion-icon name="close-outline"></ion-icon></button>
                    </div>
                    
                    ${this.renderBatchDetails(batch, recipe, allIngredients)}

            <div style="margin-top:20px; text-align:right; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                <button class="btn btn-text btn-delete-batch" data-id="${batch.id}" style="color:#e74c3c; font-size:0.9rem;">
                    <ion-icon name="trash-outline" style="margin-right:5px;"></ion-icon> Kaydı Sil
                </button>
            </div>
                </div>
                `;

            document.body.appendChild(modal);

            // Bind Events
            modal.querySelector('.btn-close-modal').onclick = () => modal.remove();

            // Re-bind delete
            modal.querySelector('.btn-delete-batch').onclick = async () => {
                if (await window.App.showConfirm('Onay', 'Silmek istiyor musunuz?')) {
                    window.App.Storage.deleteItem('production_logs', batch.id).then(() => {
                        modal.remove();
                        this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                    });
                }
            };

            // Action Buttons
            modal.querySelectorAll('.btn-action-modal').forEach(btn => {
                btn.onclick = async () => {
                    const action = btn.dataset.action;
                    await this.handleAction(action, batch.id);
                    modal.remove();

                    if (action === 'complete') {
                        await window.App.showAlert('Bilgi', 'Hamur kullanıldı ve stoktan düşüldü.');
                        // Re-render main view
                        this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                        return;
                    }

                    // Re-open updated
                    this.openBatchModal(batch.id);
                    // Update grid bg
                    this.render().then(html => { document.getElementById('main-view').innerHTML = html; this.afterRender(); });
                };
            });

            // Temperature Input
            modal.querySelectorAll('.temp-input-field').forEach(input => {
                input.onchange = async () => {
                    const id = input.dataset.id;
                    const type = input.dataset.type; // 'room' or 'fridge'
                    const val = parseFloat(input.value);
                    if (!isNaN(val)) {
                        await this.updateBatchTemp(id, type, val); // Call helper
                    }
                };
            });

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

            // ... (rest of logic) ...
            // Re-using logic but mapped to new layout
            // We need to return valid HTML string here.

            let statusText = "";
            let phaseColor = "#555";
            let mainActionBtn = "";

            // Temperature defaults
            if (!batch.roomTemp) batch.roomTemp = 24;
            if (!batch.fridgeTemp) batch.fridgeTemp = 4;

            let currentTemp = batch.roomTemp;
            let tempType = 'room';

            if (batch.status === 'room') {
                statusText = "ODA (FERMANTASYON)";
                phaseColor = '#f1c40f';
                mainActionBtn = `<button class="btn btn-primary btn-action-modal" data-action="to_fridge" style="width:100%; padding:15px; font-size:1.1rem;">❄️ Dolaba Al</button>`;
                currentTemp = batch.roomTemp;
                tempType = 'room';
            }
            else if (batch.status === 'fridge') {
                statusText = "DOLAP (FERMANTASYON)";
                phaseColor = '#3498db';
                mainActionBtn = `<button class="btn btn-warning btn-action-modal" data-action="from_fridge" style="width:100%; color:black; padding:15px; font-size:1.1rem;">🔥 Dolaptan Çıkar</button>`;
                currentTemp = batch.fridgeTemp;
                tempType = 'fridge';
            }
            else if (batch.status === 'room_final') {
                statusText = "ODA (FERMANTASYON)";
                phaseColor = '#e67e22';
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
                currentTemp = batch.roomTemp;
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
                     
                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-bottom:10px;">
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">ODA SÜRESİ</div>
                            <div id="timer-room-val" style="font-size:1.2rem; font-weight:bold; color:#f1c40f; font-variant-numeric: tabular-nums;">
                                ${batch.status === 'room' ? this.fmt(times.currentPhaseDuration) : (batch.status === 'room_final' ? this.fmt(times.currentPhaseDuration) : this.fmt(times.totalRoomTime))}
                            </div>
                            ${(batch.status === 'room' && times.totalRoomTime > times.currentPhaseDuration) ? `
                                <div style="font-size:0.7rem; color:#777; margin-top:2px;">Toplam: ${this.fmt(times.totalRoomTime)}</div>
                            ` : ''}
                             ${(batch.status === 'room_final' && times.totalRoomTime > times.currentPhaseDuration) ? `
                                <div style="font-size:0.7rem; color:#777; margin-top:2px;">Toplam: ${this.fmt(times.totalRoomTime)}</div>
                            ` : ''}
                        </div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">DOLAP SÜRESİ</div>
                            <div id="timer-fridge-val" style="font-size:1.2rem; font-weight:bold; color:#3498db; font-variant-numeric: tabular-nums;">
                                ${batch.status === 'fridge' ? this.fmt(times.currentPhaseDuration) : this.fmt(times.totalFridgeTime)}
                            </div>
                            ${(batch.status === 'fridge' && times.totalFridgeTime > times.currentPhaseDuration) ? `
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
            this.updateGridTimers = () => {
                const cards = document.querySelectorAll('.batch-timer-display');
                if (cards.length === 0) return;

                const now = Date.now();
                cards.forEach(el => {
                    const start = parseInt(el.dataset.startTime);
                    if (!isNaN(start)) {
                        el.innerText = this.fmt(now - start);
                    }
                });
            };
            this.mainInterval = setInterval(this.updateGridTimers, 1000);
        }
    };
})();
