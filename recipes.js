
(function () {
    let recipes = [];
    let ingredients = [];

    async function refreshData() {
        recipes = await window.App.Storage.getAllItems('recipes') || [];
        ingredients = await window.App.Storage.getAllItems('ingredients') || [];

        // BACKWARD COMPATIBILITY: Migration
        ingredients.forEach(item => {
            if (!item.packageUnit && item.unit) {
                item.packageUnit = item.unit;
            }
        });
    }

    // Helper: Calculate Cost
    function calculateRecipeCost(recipeData) {
        let totalCost = 0;
        const normalize = window.App.Utils.normalizeAmount;

        // 1. Flour Cost (Multi-Flour Support)
        if (recipeData.flours && recipeData.flours.length > 0) {
            recipeData.flours.forEach(f => {
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
        } else if (recipeData.flourId) {
            // Backward Compatibility
            const flour = ingredients.find(i => i.id === recipeData.flourId);
            if (flour && flour.price && flour.packageSize) {
                const unit = flour.packageUnit;
                if (unit) {
                    const packBase = normalize(flour.packageSize, unit);
                    const pricePerGram = (packBase > 0) ? (flour.price / packBase) : 0;
                    totalCost += (recipeData.flourAmount || 0) * pricePerGram;
                }
            }
        }

        // 2. Water Cost (Assuming negligible or user adds 'Water' to inventory if they pay for it. 
        // Currently treating Fixed Water as 0 cost unless user adds it to extras, but let's keep it simple)
        // If user wants water cost, they can add it to inventory price. For now, fixed water input = 0 cost default.

        // 3. Other Ingredients
        if (recipeData.ingredients) {
            recipeData.ingredients.forEach(ri => {
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
        return totalCost;
    }

    function renderList() {
        return `
            <div class="recipe-list" style="display: grid; gap: 16px;">
                ${recipes.slice().reverse().map((recipe, index) => {

            // Flour Display Logic
            let flourName = 'Un?';
            if (recipe.flours && recipe.flours.length > 1) {
                flourName = `${recipe.flours.length} Çeşit Un Mix`;
            } else if (recipe.flours && recipe.flours.length === 1) {
                const f = ingredients.find(i => i.id === recipe.flours[0].id);
                flourName = f ? f.name : 'Bilinmeyen Un';
            } else if (recipe.flourId) {
                const f = ingredients.find(i => i.id === recipe.flourId);
                flourName = f ? f.name : 'Un?';
            }

            // Re-calculate derived values
            const totalCost = calculateRecipeCost({
                flours: recipe.flours,
                flourId: recipe.flourId,
                flourAmount: recipe.flourAmount,
                ingredients: recipe.ingredients
            });

            const totalWeight = (recipe.totalWeight || 0);
            const ballWeight = recipe.ballWeight || 250;
            const yieldCount = Math.floor(totalWeight / ballWeight);
            const costPerBall = yieldCount > 0 ? (totalCost / yieldCount) : 0;

            // --- UI LOGIC START ---
            let milkAmount = 0;
            let oilAmount = 0;

            // Analyze Ingredients
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ri => {
                    const invItem = ingredients.find(i => i.id === ri.id);
                    if (invItem) {
                        const nameLower = invItem.name.toLowerCase();
                        // Milk Check
                        if (nameLower.includes('süt') || nameLower.includes('milk') || invItem.type === 'milk') {
                            milkAmount += ri.amount;
                        }
                        // Oil Check (yağ, oil, zeytin, olive)
                        if (nameLower.includes('yağ') || nameLower.includes('oil') || nameLower.includes('zeytin') || nameLower.includes('olive')) {
                            oilAmount += ri.amount;
                        }
                    }
                });
            }

            // Hydration Display
            const effectiveHyd_display = recipe.effectiveHydration || recipe.hydration; // Fallback
            const hydBadgeText = `%${recipe.hydration} Su${recipe.effectiveHydration && recipe.effectiveHydration !== recipe.hydration ? ` → %${recipe.effectiveHydration} Efektif` : ''}`;

            // Dough Character
            let doughChar = '';
            let doughCharColor = '#888';
            const effVal = parseFloat(effectiveHyd_display);
            if (!isNaN(effVal)) {
                if (effVal < 58) { doughChar = 'Sert'; doughCharColor = '#f39c12'; } // Orange
                else if (effVal <= 64) { doughChar = 'Orta'; doughCharColor = '#3498db'; } // Blue
                else { doughChar = 'Yumuşak'; doughCharColor = '#2ecc71'; } // Green
            }

            // Badges
            const isMilky = milkAmount > 0;
            const isOily = oilAmount > 0;

            // Liquid Summary HTML
            const liquidSummaryHtml = `
                <div style="font-size: 0.85rem; color: #ddd; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    💧 Su: ${recipe.waterAmount || 0}g
                    ${milkAmount > 0 ? ` · 🥛 Süt: ${milkAmount}g` : ''}
                    ${oilAmount > 0 ? ` · 🛢️ Yağ: ${oilAmount}g` : ''}
                </div>
            `;
            // --- UI LOGIC END ---

            return `
                    <div class="card recipe-card" style="margin-bottom: 0;">
                        <div class="card-header" style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h3 style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                    ${recipe.name}
                                    ${isMilky ? '<span style="font-size: 0.7em; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">🥛 Sütlü</span>' : ''}
                                    ${isOily ? '<span style="font-size: 0.7em; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">🛢️ Yağlı</span>' : ''}
                                </h3>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                     <span class="badge" style="background: rgba(255,255,255,0.1); font-weight: normal;">${flourName}</span>
                                     <span class="badge" style="background: ${doughCharColor}; color: white;">🧠 Hamur: ${doughChar}</span>
                                     ${recipe.isFavorite ? '<span class="badge" style="background: gold; color: black;">★ Favori</span>' : ''}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <span class="badge badge-success" style="font-size: 0.9em;">${hydBadgeText}</span>
                                <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">Temp: ${recipe.roomTemp || '-'}°C</div>
                            </div>
                        </div>
                        
                        <div class="card-body" style="margin-top: 12px;">
                            ${liquidSummaryHtml}
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9rem; color: var(--color-text-secondary); background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
                                <span>⚖️ Toplam: ${totalWeight}g</span>
                                <span>💵 Maliyet: ${totalCost.toFixed(2)}₺</span>
                                <span>🍕 Porsiyon: ${yieldCount} x ${ballWeight}g</span>
                                <span style="color: var(--color-primary);">💰 Birim: ${costPerBall.toFixed(2)}₺</span>
                            </div>
                             ${recipe.shelfLife ? `<p style="font-size: 0.8rem; margin-top: 8px; color: #aaa;">🕒 Raf Ömrü: ${recipe.shelfLife}</p>` : ''}
                             ${recipe.notes ? `<div style="font-size: 0.8rem; margin-top: 8px; font-style: italic; border-left: 2px solid #555; padding-left: 8px;">"${recipe.notes}"</div>` : ''}
                        </div>

                        <div class="card-actions" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 10px;">
                             <button class="btn btn-primary btn-start-production" data-id="${recipe.id}" style="font-size: 0.9rem; padding: 6px 12px; background: var(--color-success); border-color: var(--color-success);">
                                <ion-icon name="play-outline" style="margin-right:4px; vertical-align:middle;"></ion-icon> Üretime Al
                             </button>
                             <button class="btn btn-primary btn-edit-recipe" data-id="${recipe.id}" style="font-size: 0.9rem; padding: 6px 12px;">
                                Düzenle
                             </button>
                             <button class="icon-btn btn-toggle-fav" data-id="${recipe.id}" style="color: ${recipe.isFavorite ? 'gold' : 'var(--color-text-secondary)'};">
                                <ion-icon name="${recipe.isFavorite ? 'star' : 'star-outline'}"></ion-icon>
                            </button>
                            <button class="icon-btn btn-delete-recipe" data-id="${recipe.id}" style="color: var(--color-danger);">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    window.App.Recipes = {
        async render() {
            await refreshData();
            return `
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h2>Reçete Odası</h2>
                        <p style="color: var(--color-text-secondary); font-size: 0.9rem;">Maliyet & Analiz</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-recipe" style="width: auto; padding: 8px 16px;">
                        <ion-icon name="add-outline" style="font-size: 1.2rem; margin-right: 4px;"></ion-icon>
                        Yeni
                    </button>
                </div>

                ${recipes.length === 0 ? renderEmptyState() : renderList()}

                <!-- Modal -->
                <div class="modal-overlay" id="modal-recipe">
                    <div class="modal-content" style="max-height: 95vh;">
                        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 id="modal-title">Yeni Reçete</h3>
                            <button class="icon-btn" id="btn-close-modal"><ion-icon name="close-outline"></ion-icon></button>
                        </div>
                        
                        <form id="form-recipe">
                            <input type="hidden" id="edit-recipe-id">
                            
                            <div class="form-group">
                                <label class="form-label">Reçete Adı</label>
                                <input type="text" class="form-control" id="recipe-name" placeholder="Örn: Napoli Klasik" required>
                            </div>

                            <!-- Core Ingredients -->
                            <div class="form-group" style="background: rgba(252, 163, 17, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(252, 163, 17, 0.2);">
                                <label class="form-label" style="color: var(--color-primary);">Ana Bileşenler</label>
                                
                                <!-- Flours (Multi-Select) -->
                                <div style="margin-bottom: 12px;">
                                    <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Un Seçimi (Mix Yapabilirsiniz)</label>
                                    <div id="flour-container"></div>
                                    <button type="button" class="btn" id="btn-add-flour" style="background: rgba(255,255,255,0.05); margin-top: 5px; font-size: 0.8rem; width:auto; padding: 4px 10px;">
                                        <ion-icon name="add-circle-outline" style="margin-right: 5px;"></ion-icon> Un Ekle
                                    </button>
                                </div>

                                <!-- Water (Fixed) -->
                                <div style="margin-top: 15px;">
                                    <label style="font-size: 0.8rem; color: var(--color-text-secondary); display:flex; align-items:center; gap:5px;">
                                        <ion-icon name="water-outline"></ion-icon> Su Miktarı
                                    </label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="number" class="form-control" id="water-amount" placeholder="Miktar" value="650" style="flex: 1;">
                                        <span style="color: var(--color-text-secondary);">ml</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Extra Ingredients -->
                            <div class="form-group">
                                <label class="form-label">Diğer Malzemeler (Maya, Tuz, vb.)</label>
                                <div id="ingredients-container"></div>
                                <button type="button" class="btn" id="btn-add-row" style="background: rgba(255,255,255,0.05); margin-top: 8px; font-size: 0.9rem;">
                                    <ion-icon name="add-circle-outline" style="margin-right: 5px;"></ion-icon> Malzeme Ekle
                                </button>
                            </div>

                            <!-- Production Steps -->
                            <div class="form-group">
                                <label class="form-label">Üretim Adımları</label>
                                <div id="production-steps-container"></div>
                                <button type="button" class="btn" id="btn-add-step" style="background: rgba(255,255,255,0.05); margin-top: 8px; font-size: 0.9rem;">
                                    <ion-icon name="list-outline" style="margin-right: 5px;"></ion-icon> Adım Ekle
                                </button>
                            </div>

                            <!-- Process Info -->
                            <div class="form-group">
                                <div class="form-row" style="display: flex; gap: 10px;">
                                    <div style="flex: 1;">
                                        <label class="form-label">Raf Ömrü</label>
                                        <input type="text" class="form-control" id="shelf-life" placeholder="Örn: 3 Gün">
                                    </div>
                                    <div style="flex: 1;">
                                        <label class="form-label">Ortam Isısı (°C)</label>
                                        <input type="number" class="form-control" id="room-temp" placeholder="24">
                                    </div>
                                </div>
                            </div>

                             <!-- Portion Settings -->
                            <div class="form-group" style="padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                                <label class="form-label">Porsiyonlama</label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="flex:1">
                                        <span style="font-size: 0.8rem; color: #888;">Top Gramajı</span>
                                        <input type="number" class="form-control" id="ball-weight" value="250">
                                    </div>
                                    <div style="flex:1; text-align: center;">
                                        <span style="font-size: 0.8rem; color: #888;">Adet</span>
                                        <div id="calc-yield-count" style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">0</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notes -->
                            <div class="form-group">
                                <label class="form-label">Hamur Tepkileri & Notlar</label>
                                <textarea class="form-control" id="recipe-notes" rows="2" placeholder="Örn: 1. gün sonunda baloncuklanma başladı..."></textarea>
                            </div>

                            <!-- Cost Analysis Card -->
                            <div class="card" style="background: rgba(18, 18, 18, 0.5); border: 1px solid var(--color-primary); margin-top: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span style="color: var(--color-text-secondary);">Toplam Hamur:</span>
                                    <span id="calc-total-weight" style="font-weight: bold;">0 g</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span style="color: var(--color-text-secondary);">Toplam Maliyet:</span>
                                    <span id="calc-total-cost" style="color: var(--color-success);">0.00 ₺</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px; margin-top: 5px;">
                                    <span style="color: var(--color-primary);">Birim (Top) Maliyet:</span>
                                    <span id="calc-unit-cost" style="color: var(--color-primary); font-weight: bold;">0.00 ₺</span>
                                </div>
                                
                                <!-- Hydration Breakdown -->
                                <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">
                                    <div id="calc-hydration-base" style="font-size: 0.9rem;">Hidrasyon (Su): %0.0</div>
                                    <div id="calc-hydration-milk" style="font-size: 0.9rem; color: #aaa;">Süt Katkısı: +%0.0</div>
                                    <div id="calc-hydration-effective" style="font-size: 1rem; color: var(--color-primary); font-weight: bold; margin-top: 2px;">Efektif Hidrasyon: %0.0</div>
                                </div>

                                <div style="font-size: 0.7rem; color: #888; text-align: center; margin-top: 8px; font-style: italic;">
                                    ℹ️ Efektif hidrasyon, su + süt su eşdeğerine göre hesaplanır.<br>Birden fazla un varsa toplam un ağırlığı baz alınır.
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Kaydet</button>
                        </form>
                    </div>
                </div>
            `;
        },

        async openModal(editId = null) {
            const modal = document.getElementById('modal-recipe');
            const title = document.getElementById('modal-title');
            const editIdInput = document.getElementById('edit-recipe-id');
            const ingContainer = document.getElementById('ingredients-container');
            const flourContainer = document.getElementById('flour-container');
            const stepsContainer = document.getElementById('production-steps-container');

            const formInputs = {
                name: document.getElementById('recipe-name'),
                waterAmount: document.getElementById('water-amount'),
                shelfLife: document.getElementById('shelf-life'),
                roomTemp: document.getElementById('room-temp'),
                ballWeight: document.getElementById('ball-weight'),
                notes: document.getElementById('recipe-notes')
            };

            // Reset
            ingContainer.innerHTML = '';
            flourContainer.innerHTML = '';
            stepsContainer.innerHTML = '';
            editIdInput.value = '';
            title.textContent = 'Yeni Reçete';

            for (let k in formInputs) formInputs[k].value = (k === 'waterAmount' ? 650 : (k === 'ballWeight' ? 250 : ''));

            if (editId) {
                // Load existing
                const recipe = await window.App.Storage.getItemById('recipes', editId);
                if (recipe) {
                    title.textContent = 'Reçeteyi Düzenle';
                    editIdInput.value = editId;
                    formInputs.name.value = recipe.name;
                    formInputs.waterAmount.value = recipe.waterAmount || 650;
                    formInputs.shelfLife.value = recipe.shelfLife || '';
                    formInputs.roomTemp.value = recipe.roomTemp || '';
                    formInputs.ballWeight.value = recipe.ballWeight || 250;
                    formInputs.notes.value = recipe.notes || '';

                    // FLOUR MIGRATION CHECK
                    if (recipe.flours && recipe.flours.length > 0) {
                        recipe.flours.forEach(f => this.addFlourRow(f.id, f.amount));
                    } else if (recipe.flourId) {
                        // Backward compatibility
                        this.addFlourRow(recipe.flourId, recipe.flourAmount || 1000);
                    } else {
                        this.addFlourRow(null, 1000);
                    }

                    // Populate Ingredients
                    if (recipe.ingredients) {
                        recipe.ingredients.forEach(i => {
                            if (!i.isBase && i.type !== 'water') {
                                this.addIngredientRow(null, null, i.amount, i.id);
                            }
                        });
                    }

                    // Populate Steps
                    if (recipe.productionSteps) {
                        recipe.productionSteps.forEach(s => this.addStepRow(s));
                    }
                }
            } else {
                // Default for new
                this.addFlourRow(null, 1000); // 1 default flour row
                this.addIngredientRow('salt', 'Tuz', 20);
                this.addIngredientRow('yeast', 'Maya', 2);
            }

            modal.classList.add('open');
            this.updateCalculations();
        },

        updateCalculations() {
            const ballWeight = parseFloat(document.getElementById('ball-weight')?.value) || 250;
            const normalize = window.App.Utils.normalizeAmount;
            const waterAmount = parseFloat(document.getElementById('water-amount')?.value) || 0;

            let totalFlourAmount = 0;
            let totalCost = 0;

            // 1. Calculate Flour Totals
            document.querySelectorAll('.flour-row').forEach(row => {
                const select = row.querySelector('.flour-select');
                const amtInput = row.querySelector('.flour-amount');
                const amt = parseFloat(amtInput.value) || 0;

                totalFlourAmount += amt;

                if (select.value) {
                    // Cost Logic
                    const flourId = select.value;
                    const flourItem = ingredients.find(i => i.id === flourId);
                    if (flourItem) {
                        const unit = flourItem.packageUnit;
                        const price = flourItem.price;
                        const pkgSize = flourItem.packageSize;

                        if (unit && price && pkgSize) {
                            const pkgWeight = normalize(pkgSize, unit);
                            totalCost += (pkgWeight > 0) ? ((price / pkgWeight) * amt) : 0;
                        }
                    }
                }
            });

            let totalWeight = totalFlourAmount + waterAmount;

            // 2. Extras (Ingredients)
            let milkWaterEq = 0;

            document.querySelectorAll('.ingredient-row').forEach(row => {
                const select = row.querySelector('.ing-select');
                const amount = parseFloat(row.querySelector('.ing-amount').value) || 0;

                totalWeight += amount;

                if (select.value) {
                    const item = ingredients.find(i => i.id === select.value);
                    if (item) {
                        // Cost Logic
                        if (item.price && item.packageSize) {
                            const unit = item.packageUnit;
                            if (unit) {
                                const pkgWeight = normalize(item.packageSize, unit);
                                totalCost += (pkgWeight > 0) ? ((item.price / pkgWeight) * amount) : 0;
                            }
                        }

                        // Hydration Logic: Detect Milk
                        const nameLower = item.name.toLowerCase();
                        if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) {
                            // Süt Kuralı: %85 Su
                            milkWaterEq += (amount * 0.85);
                        }
                    }
                }
            });

            // 3. Hydration Stats
            const hydration = totalFlourAmount > 0 ? ((waterAmount / totalFlourAmount) * 100) : 0;
            const milkContribution = totalFlourAmount > 0 ? ((milkWaterEq / totalFlourAmount) * 100) : 0;
            const effectiveHydration = totalFlourAmount > 0 ? (((waterAmount + milkWaterEq) / totalFlourAmount) * 100) : 0;

            const yieldCount = Math.floor(totalWeight / ballWeight);
            const unitCost = yieldCount > 0 ? (totalCost / yieldCount) : 0;

            document.getElementById('calc-total-weight').textContent = `${totalWeight} g`;
            document.getElementById('calc-total-cost').textContent = `${totalCost.toFixed(2)} ₺`;
            document.getElementById('calc-unit-cost').textContent = `${unitCost.toFixed(2)} ₺`;
            document.getElementById('calc-yield-count').textContent = yieldCount;

            // Hydration UI Update
            document.getElementById('calc-hydration-base').textContent = `Hidrasyon (Su): %${hydration.toFixed(1)}`;
            document.getElementById('calc-hydration-milk').textContent = `Süt Katkısı: +%${milkContribution.toFixed(1)}`;
            const effEl = document.getElementById('calc-hydration-effective');
            effEl.textContent = `Efektif Hidrasyon: %${effectiveHydration.toFixed(1)}`;
        },

        addFlourRow(preId = null, preAmount = '') {
            const container = document.getElementById('flour-container');
            const div = document.createElement('div');
            div.className = 'flour-row';
            div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 5px; align-items: center;';

            // Filter flours
            const options = ingredients.filter(i => i.type === 'flour').map(i => {
                return `<option value="${i.id}" ${i.id === preId ? 'selected' : ''}>${i.name} (Prot: %${i.protein || '?'})</option>`;
            }).join('');

            div.innerHTML = `
                <select class="form-control flour-select" style="flex: 2;">
                    <option value="" disabled ${!preId ? 'selected' : ''}>Un seçiniz...</option>
                    ${options}
                </select>
                <div style="display:flex; align-items:center; gap:5px; flex:1;">
                     <input type="number" class="form-control flour-amount" placeholder="gr" value="${preAmount}" style="width:100%;">
                     <span style="font-size:0.7rem; color:#888;">gr</span>
                </div>
                <button type="button" class="icon-btn btn-remove-flour" style="color: var(--color-danger);"><ion-icon name="close-circle-outline"></ion-icon></button>
            `;

            container.appendChild(div);

            const self = this;
            div.querySelector('.flour-select').addEventListener('change', () => self.updateCalculations());
            div.querySelector('.flour-amount').addEventListener('input', () => self.updateCalculations());
            div.querySelector('.btn-remove-flour').onclick = () => {
                // Don't allow removing last flour row to prevent empty state issues (optional but good UX)
                if (document.querySelectorAll('.flour-row').length > 1) {
                    div.remove();
                    self.updateCalculations();
                } else {
                    alert('En az bir un çeşidi girmelisiniz.');
                }
            };
            self.updateCalculations();
        },

        addIngredientRow(preSelectedType = null, preSelectedName = null, preValue = '', preId = null) {
            const container = document.getElementById('ingredients-container');
            const div = document.createElement('div');
            div.className = 'ingredient-row';
            div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

            // Filter: Don't show flour in extras
            const options = ingredients.filter(i => i.type !== 'flour').map(i => {
                // Selection logic: ID match > Type match > Name match
                const isSelected = (preId && i.id === preId) ||
                    (!preId && preSelectedName && i.name.includes(preSelectedName)) ||
                    (!preId && !preSelectedName && preSelectedType && i.type === preSelectedType);
                return `<option value="${i.id}" data-type="${i.type}" data-price="${i.price}" data-pkg="${i.packageSize}" ${isSelected ? 'selected' : ''}>${i.name}</option>`;
            }).join('');

            div.innerHTML = `
                <select class="form-control ing-select" style="flex: 2;">
                    ${options ? options : '<option disabled>Stokta malzeme yok</option>'}
                </select>
                <input type="number" class="form-control ing-amount" placeholder="gr" value="${preValue}" style="flex: 1;">
                <button type="button" class="icon-btn btn-remove-row" style="color: var(--color-danger);"><ion-icon name="close-circle-outline"></ion-icon></button>
            `;

            container.appendChild(div);

            const self = this;
            div.querySelector('.ing-amount').addEventListener('input', () => self.updateCalculations());
            div.querySelector('.ing-select').addEventListener('change', () => self.updateCalculations());
            div.querySelector('.btn-remove-row').onclick = () => { div.remove(); self.updateCalculations(); };
            self.updateCalculations();
        },

        addStepRow(step = null) {
            const container = document.getElementById('production-steps-container');
            const div = document.createElement('div');
            div.className = 'step-row';
            div.dataset.id = step ? step.id : '';
            div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;';

            const typeOptions = [
                { val: 'knead', label: 'Yoğur' },
                { val: 'rest', label: 'Dinlendir' },
                { val: 'fold', label: 'Katla' },
                { val: 'ferment', label: 'Mayalandır' },
                { val: 'other', label: 'Diğer' }
            ].map(o => `<option value="${o.val}" ${step && step.type === o.val ? 'selected' : ''}>${o.label}</option>`).join('');

            div.innerHTML = `
                <select class="form-control step-type" style="flex: 1; min-width: 80px; font-size: 0.85rem;">${typeOptions}</select>
                <input type="text" class="form-control step-title" placeholder="Başlık (Opsiyonel)" value="${step ? step.title : ''}" style="flex: 2; font-size: 0.85rem;">
                <div style="display:flex; align-items:center; gap:4px; flex: 1;">
                    <input type="number" class="form-control step-duration" placeholder="Dk" value="${step ? step.durationMin : ''}" style="width: 100%; font-size: 0.85rem;">
                    <span style="font-size:0.7rem; color:#888;">dk</span>
                </div>
                <button type="button" class="icon-btn btn-remove-step" style="color: var(--color-danger);"><ion-icon name="trash-outline"></ion-icon></button>
            `;

            div.querySelector('.btn-remove-step').onclick = () => div.remove();
            container.appendChild(div);
        },

        afterRender() {
            const self = this;
            const modal = document.getElementById('modal-recipe');
            const btnNew = document.getElementById('btn-new-recipe');
            const btnClose = document.getElementById('btn-close-modal');
            const form = document.getElementById('form-recipe');
            const btnAddRow = document.getElementById('btn-add-row');
            const btnAddStep = document.getElementById('btn-add-step');
            const btnAddFlour = document.getElementById('btn-add-flour');

            // Input listeners for calc
            ['water-amount', 'ball-weight'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => self.updateCalculations());
            });

            if (btnNew) btnNew.onclick = async () => await self.openModal();
            if (btnClose) btnClose.onclick = () => modal.classList.remove('open');
            if (btnAddRow) btnAddRow.onclick = () => self.addIngredientRow();
            if (btnAddStep) btnAddStep.onclick = () => self.addStepRow();
            if (btnAddFlour) btnAddFlour.onclick = () => self.addFlourRow();

            // Edit Handler
            document.querySelectorAll('.btn-edit-recipe').forEach(btn => {
                btn.onclick = async () => await self.openModal(btn.dataset.id);
            });

            // Start Production Handler
            document.querySelectorAll('.btn-start-production').forEach(btn => {
                btn.onclick = async () => {
                    const rId = btn.dataset.id;
                    const recipe = recipes.find(r => r.id === rId);
                    if (!recipe) return;

                    if (!recipe.productionSteps || recipe.productionSteps.length === 0) {
                        window.App.showConfirm('Adım Yok', 'Bu reçetede tanımlı üretim adımı yok. Önce adımları tanımlamak ister misiniz?', async () => {
                            await self.openModal(rId);
                        });
                        return;
                    }

                    if (confirm(`"${recipe.name}" için üretim süreci başlatılsın mı?`)) {
                        const processData = {
                            recipeId: recipe.id,
                            recipeName: recipe.name,
                            steps: JSON.parse(JSON.stringify(recipe.productionSteps)), // Deep copy 
                            currentStepIndex: 0,
                            status: 'active',
                            startedAt: Date.now()
                        };
                        localStorage.setItem('active_process', JSON.stringify(processData));
                        window.App.navigateTo('process');
                    }
                };
            });

            // Form Submit
            if (form) {
                form.onsubmit = async (e) => {
                    e.preventDefault();

                    const editId = document.getElementById('edit-recipe-id').value;
                    const name = document.getElementById('recipe-name').value;
                    const waterAmount = parseFloat(document.getElementById('water-amount').value);
                    const ballWeight = parseFloat(document.getElementById('ball-weight').value);
                    const shelfLife = document.getElementById('shelf-life').value;
                    const roomTemp = document.getElementById('room-temp').value;
                    const notes = document.getElementById('recipe-notes').value;

                    // Gather Flours
                    const flours = [];
                    let totalFlourAmount = 0;
                    document.querySelectorAll('.flour-row').forEach(row => {
                        const fId = row.querySelector('.flour-select').value;
                        const fAmt = parseFloat(row.querySelector('.flour-amount').value) || 0;
                        if (fId && fAmt > 0) {
                            flours.push({ id: fId, amount: fAmt });
                            totalFlourAmount += fAmt;
                        }
                    });

                    if (flours.length === 0) { alert('En az bir un seçmelisiniz.'); return; }

                    const extraIngredients = [];
                    document.querySelectorAll('.ingredient-row').forEach(row => {
                        const select = row.querySelector('.ing-select');
                        const amount = parseFloat(row.querySelector('.ing-amount').value) || 0;
                        if (select.value) {
                            extraIngredients.push({ id: select.value, amount: amount });
                        }
                    });

                    // Calculated totals
                    let milkWaterEq = 0;
                    let totalWeight = totalFlourAmount + waterAmount;

                    extraIngredients.forEach(i => {
                        const item = ingredients.find(inv => inv.id === i.id);
                        if (item) {
                            const nameLower = item.name.toLowerCase();
                            if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) {
                                milkWaterEq += (i.amount * 0.85);
                            }
                        }
                        totalWeight += i.amount;
                    });

                    const hydration = totalFlourAmount > 0 ? ((waterAmount / totalFlourAmount) * 100).toFixed(1) : 0;
                    const effectiveHydration = totalFlourAmount > 0 ? (((waterAmount + milkWaterEq) / totalFlourAmount) * 100).toFixed(1) : 0;

                    const recipeData = {
                        id: editId || Date.now().toString(),
                        name,
                        // Legacy single flour fields for list view compatibility (using primary flour)
                        flourId: flours[0].id,
                        flourAmount: totalFlourAmount,

                        flours: flours, // NEW MULTI FLOUR FIELD

                        waterAmount,
                        totalWeight,
                        hydration,
                        effectiveHydration,

                        ballWeight,
                        shelfLife,
                        roomTemp,
                        notes,
                        ingredients: extraIngredients,
                        createdAt: editId ? (recipes.find(r => r.id === editId).createdAt) : new Date().toISOString(),
                        isFavorite: editId ? (recipes.find(r => r.id === editId).isFavorite) : false,
                        productionSteps: (() => {
                            const steps = [];
                            document.querySelectorAll('.step-row').forEach(row => {
                                const type = row.querySelector('.step-type').value;
                                const title = row.querySelector('.step-title').value;
                                const duration = parseInt(row.querySelector('.step-duration').value) || 0;
                                steps.push({
                                    id: row.dataset.id || `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                    type,
                                    title: title || (type === 'knead' ? 'Yoğurma' : (type === 'rest' ? 'Dinlendirme' : type)),
                                    durationMin: duration,
                                    status: 'idle',
                                    startedAt: null
                                });
                            });
                            return steps;
                        })()
                    };

                    if (editId) {
                        await window.App.Storage.updateItem('recipes', recipeData);
                    } else {
                        await window.App.Storage.addItem('recipes', recipeData);
                    }

                    modal.classList.remove('open');
                    const content = await window.App.Recipes.render();
                    document.getElementById('main-view').innerHTML = content;
                    self.afterRender();
                };
            }

            // Favorites & Delete
            document.querySelectorAll('.btn-toggle-fav').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    const recipe = await window.App.Storage.getItemById('recipes', id);
                    if (recipe) {
                        recipe.isFavorite = !recipe.isFavorite;
                        await window.App.Storage.updateItem('recipes', recipe);
                        // Refresh
                        const content = await window.App.Recipes.render();
                        document.getElementById('main-view').innerHTML = content;
                        self.afterRender();
                    }
                }
            });

            document.querySelectorAll('.btn-delete-recipe').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm('Silmek istediğine emin misiniz?')) {
                        const id = btn.dataset.id;
                        await window.App.Storage.deleteItem('recipes', id);
                        const content = await window.App.Recipes.render();
                        document.getElementById('main-view').innerHTML = content;
                        self.afterRender();
                    }
                }
            });
        }
    };

    function renderEmptyState() {
        return `
            <div class="empty-state">
                <ion-icon name="book-outline"></ion-icon>
                <p>Reçete listeniz boş.</p>
                <button class="btn btn-primary" id="btn-new-recipe" style="margin-top: 15px;">İlk Reçeteni Oluştur</button>
            </div>
        `;
    }
})();
