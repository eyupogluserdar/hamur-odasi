
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

        renderBatchCard(batch) {
            const now = Date.now();
            let phaseDuration = 0;
            let statusText = "";
            let phaseColor = "#555";
            let mainActionBtn = "";

            // Calculate Current Phase Duration
            if (batch.status === 'room') {
                phaseDuration = now - batch.startTime;
                statusText = "Oda Sıcaklığı (1. Evre)";
                phaseColor = getPhaseColor('room', phaseDuration / 3600000);
                mainActionBtn = `<button class="btn btn-primary btn-action" data-action="to_fridge" data-id="${batch.id}">Dolaba Al ❄️</button>`;
            }
            else if (batch.status === 'fridge') {
                phaseDuration = now - batch.fridgeStartTime;
                statusText = "Dolapta (+4°C)";
                phaseColor = getPhaseColor('fridge');
                mainActionBtn = `<button class="btn btn-warning btn-action" data-action="from_fridge" data-id="${batch.id}" style="color:#000;">Dolaptan Çıkar 🔥</button>`;
            }
            else if (batch.status === 'room_final') {
                phaseDuration = now - batch.finalRoomStartTime;
                statusText = "Tezgaha Alındı (Son Evre)";
                phaseColor = getPhaseColor('room_final');
                mainActionBtn = `<span class="badge" style="background:rgba(255,255,255,0.1);">Hazırlanıyor</span>`;
            }

            const totalDuration = now - batch.startTime;

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
                                <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px;">Toplam Yaş</div>
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

            if (!recipe) {
                alert("Reçete bulunamadı!");
                return;
            }

            // Snapshot critical data
            // const normalize = window.App.Utils.normalizeAmount; // Not currently needed for snapshot, can remove line

            // Calculate Snapshot Hydration
            const flourItem = (await window.App.Storage.getAllItems('ingredients')).find(i => i.id === recipe.flourId);

            const snapshot = {
                recipeId: recipe.id,
                recipeName: recipe.name,
                flourName: flourItem ? flourItem.name : 'Un',
                flourAmount: recipe.flourAmount,
                waterAmount: recipe.waterAmount,
                hydration: recipe.hydration,
                totalWeight: recipe.totalWeight,
                ballWeight: recipe.ballWeight,
                yieldCount: Math.floor((recipe.totalWeight || 0) / (recipe.ballWeight || 250))
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

        finishBatch(id) {
            window.App.showConfirm(
                "Üretimi Bitir",
                "Stoğa almak istiyor musun?",
                async () => {
                    await window.App.Storage.deleteItem('production_logs', id);
                    this.updateUI();
                }
            );
        },

        cancelBatch(id) {
            window.App.showConfirm(
                "İptal Et",
                "Bu kayıt silinecek. Emin misin?",
                async () => {
                    await window.App.Storage.deleteItem('production_logs', id);
                    this.updateUI();
                }
            );
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
