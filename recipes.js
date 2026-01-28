
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

        // 1. Flour Cost
        const flour = ingredients.find(i => i.id === recipeData.flourId);
        if (flour && flour.price && flour.packageSize) {
            // Determine unit: strict packageUnit check
            const unit = flour.packageUnit;
            if (unit) {
                const packBase = normalize(flour.packageSize, unit);
                const pricePerGram = (packBase > 0) ? (flour.price / packBase) : 0;
                totalCost += (recipeData.flourAmount || 0) * pricePerGram;
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
            // Logic to handle old vs new data structure slightly if needed, but we overwrite
            const flour = ingredients.find(i => i.id === recipe.flourId);

            // Re-calculate derived values
            const totalCost = calculateRecipeCost({
                flourId: recipe.flourId,
                flourAmount: recipe.flourAmount, // New field
                ingredients: recipe.ingredients // Now only extras
            });

            const totalWeight = (recipe.totalWeight || 0);
            const ballWeight = recipe.ballWeight || 250;
            const yieldCount = Math.floor(totalWeight / ballWeight);
            const costPerBall = yieldCount > 0 ? (totalCost / yieldCount) : 0;

            return `
                    <div class="card recipe-card" style="margin-bottom: 0;">
                        <div class="card-header" style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h3 style="margin-bottom: 4px;">${recipe.name}</h3>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                     <span class="badge" style="background: rgba(255,255,255,0.1); font-weight: normal;">${flour ? flour.name : 'Un?'}</span>
                                     ${recipe.isFavorite ? '<span class="badge" style="background: gold; color: black;">★ Favori</span>' : ''}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <span class="badge badge-success">%${recipe.hydration} Su</span>
                                ${recipe.effectiveHydration ? `<div style="font-size: 0.8rem; color: var(--color-primary); font-weight:bold; margin-top:2px;">%${recipe.effectiveHydration} Efektif</div>` : ''}
                                <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">Temp: ${recipe.roomTemp || '-'}°C</div>
                            </div>
                        </div>
                        
                        <div class="card-body" style="margin-top: 12px;">
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
                                
                                <!-- Flour -->
                                <div style="margin-bottom: 12px;">
                                    <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Un Seçimi</label>
                                    <select class="form-control" id="recipe-flour" required>
                                        <option value="" disabled selected>Un seçiniz...</option>
                                        ${ingredients.filter(i => i.type === 'flour').map(i => `
                                            <option value="${i.id}" data-price="${i.price}" data-pkg="${i.packageSize}">${i.name} (Prot: %${i.protein || '?'})</option>
                                        `).join('')}
                                    </select>
                                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                                        <input type="number" class="form-control" id="flour-amount" placeholder="Miktar" value="1000" style="flex: 1;">
                                        <span style="color: var(--color-text-secondary);">gr</span>
                                    </div>
                                </div>

                                <!-- Water (Fixed) -->
                                <div>
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

                            <!-- Process Info (Shelf Life, Room Temp) -->
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
                                    <div id="calc-hydration-water" style="font-size: 0.9rem;">Hidrasyon (Su): %0.0</div>
                                    <div id="calc-hydration-milk" style="font-size: 0.9rem; color: #aaa;">Süt Katkısı: +%0.0</div>
                                    <div id="calc-hydration-effective" style="font-size: 1rem; color: var(--color-primary); font-weight: bold; margin-top: 2px;">Efektif Hidrasyon: %0.0</div>
                                </div>

                                <div style="font-size: 0.7rem; color: #888; text-align: center; margin-top: 8px; font-style: italic;">
                                    ℹ️ Efektif hidrasyon, su + süt su eşdeğerine göre hesaplanır.<br>Yağ hidrasyona dahil edilmez, yalnızca dokuya etki eder.
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
            const container = document.getElementById('ingredients-container');
            const formInputs = {
                name: document.getElementById('recipe-name'),
                flour: document.getElementById('recipe-flour'),
                flourAmount: document.getElementById('flour-amount'),
                waterAmount: document.getElementById('water-amount'),
                shelfLife: document.getElementById('shelf-life'),
                roomTemp: document.getElementById('room-temp'),
                ballWeight: document.getElementById('ball-weight'),
                notes: document.getElementById('recipe-notes')
            };

            // Reset
            container.innerHTML = '';
            editIdInput.value = '';
            title.textContent = 'Yeni Reçete';
            for (let k in formInputs) formInputs[k].value = (k === 'flourAmount' ? 1000 : (k === 'waterAmount' ? 650 : (k === 'ballWeight' ? 250 : '')));

            if (editId) {
                // Load existing
                const recipe = await window.App.Storage.getItemById('recipes', editId);
                if (recipe) {
                    title.textContent = 'Reçeteyi Düzenle';
                    editIdInput.value = editId;
                    formInputs.name.value = recipe.name;
                    formInputs.flour.value = recipe.flourId;
                    formInputs.flourAmount.value = recipe.flourAmount || 1000; // Handling migration
                    formInputs.waterAmount.value = recipe.waterAmount || (recipe.ingredients.find(i => i.type === 'water')?.amount) || 650; // Try to find old water or default
                    formInputs.shelfLife.value = recipe.shelfLife || '';
                    formInputs.roomTemp.value = recipe.roomTemp || '';
                    formInputs.ballWeight.value = recipe.ballWeight || 250;
                    formInputs.notes.value = recipe.notes || '';

                    // Populate Ingredients (excluding base flour/water if they were there in old format)
                    if (recipe.ingredients) {
                        recipe.ingredients.forEach(i => {
                            if (!i.isBase && i.type !== 'water') { // Skip old water/flour entries from dynamic list
                                this.addIngredientRow(null, null, i.amount, i.id);
                            }
                        });
                    }
                }
            } else {
                // Default extras for new
                this.addIngredientRow('salt', 'Tuz', 20);
                this.addIngredientRow('yeast', 'Maya', 2);
            }

            modal.classList.add('open');
            this.updateCalculations();
        },

        updateCalculations() {
            const flourSelect = document.getElementById('recipe-flour');
            const flourAmount = parseFloat(document.getElementById('flour-amount')?.value) || 0;
            const waterAmount = parseFloat(document.getElementById('water-amount')?.value) || 0;
            const ballWeight = parseFloat(document.getElementById('ball-weight')?.value) || 250;

            const normalize = window.App.Utils.normalizeAmount;

            // Total weight assumes inputs are in grams/ml
            let totalWeight = flourAmount + waterAmount;
            let totalCost = 0;

            // Flour Cost
            if (flourSelect.selectedIndex > 0) {
                const opt = flourSelect.options[flourSelect.selectedIndex];
                const price = parseFloat(opt.dataset.price) || 0;
                const pkgSize = parseFloat(opt.dataset.pkg) || 0;

                const flourId = flourSelect.value;
                const flourItem = ingredients.find(i => i.id === flourId);

                if (flourItem && pkgSize > 0) {
                    const unit = flourItem.packageUnit; // Strict
                    if (unit) {
                        const pkgWeight = normalize(pkgSize, unit);
                        totalCost += (pkgWeight > 0) ? ((price / pkgWeight) * flourAmount) : 0;
                    }
                }
            }

            // Extras Cost & Milk Detection
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
                            const unit = item.packageUnit; // Strict
                            if (unit) {
                                const pkgWeight = normalize(item.packageSize, unit);
                                totalCost += (pkgWeight > 0) ? ((item.price / pkgWeight) * amount) : 0;
                            }
                        }

                        // Hydration Logic: Detect Milk
                        // Assuming detection by name for now as per plan, or type if available.
                        // Ideally we should add 'type: milk' to inventory, but checking name is safer for existing data.
                        const nameLower = item.name.toLowerCase();
                        if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) {
                            // Süt Kuralı: %85 Su
                            milkWaterEq += (amount * 0.85);
                        }
                    }
                }
            });

            // Hydration Calculations
            const waterHydration = flourAmount > 0 ? ((waterAmount / flourAmount) * 100) : 0;
            const milkContribution = flourAmount > 0 ? ((milkWaterEq / flourAmount) * 100) : 0;
            const effectiveHydration = waterHydration + milkContribution;

            const yieldCount = Math.floor(totalWeight / ballWeight);
            const unitCost = yieldCount > 0 ? (totalCost / yieldCount) : 0;

            document.getElementById('calc-total-weight').textContent = `${totalWeight} g`;
            document.getElementById('calc-total-cost').textContent = `${totalCost.toFixed(2)} ₺`;
            document.getElementById('calc-unit-cost').textContent = `${unitCost.toFixed(2)} ₺`;
            document.getElementById('calc-yield-count').textContent = yieldCount;

            // Hydration UI Update
            document.getElementById('calc-hydration-water').textContent = `Hidrasyon (Su): %${waterHydration.toFixed(1)}`;
            document.getElementById('calc-hydration-milk').textContent = `Süt Katkısı: +%${milkContribution.toFixed(1)}`;
            const effEl = document.getElementById('calc-hydration-effective');
            effEl.textContent = `Efektif Hidrasyon: %${effectiveHydration.toFixed(1)}`;
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

        afterRender() {
            const self = this;
            const modal = document.getElementById('modal-recipe');
            const btnNew = document.getElementById('btn-new-recipe');
            const btnClose = document.getElementById('btn-close-modal');
            const form = document.getElementById('form-recipe');
            const btnAddRow = document.getElementById('btn-add-row');

            // Input listeners for calc
            ['flour-amount', 'water-amount', 'recipe-flour', 'ball-weight'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => self.updateCalculations());
                if (el && el.tagName === 'SELECT') el.addEventListener('change', () => self.updateCalculations());
            });

            if (btnNew) btnNew.onclick = async () => await self.openModal();
            if (btnClose) btnClose.onclick = () => modal.classList.remove('open');
            if (btnAddRow) btnAddRow.onclick = () => self.addIngredientRow();

            // Edit Buttons
            document.querySelectorAll('.btn-edit-recipe').forEach(btn => {
                btn.onclick = async () => await self.openModal(btn.dataset.id);
            });

            // Form Submit
            if (form) {
                form.onsubmit = async (e) => {
                    e.preventDefault();

                    const editId = document.getElementById('edit-recipe-id').value;
                    const name = document.getElementById('recipe-name').value;
                    const flourId = document.getElementById('recipe-flour').value;
                    const flourAmount = parseFloat(document.getElementById('flour-amount').value);
                    const waterAmount = parseFloat(document.getElementById('water-amount').value);
                    const ballWeight = parseFloat(document.getElementById('ball-weight').value);
                    const shelfLife = document.getElementById('shelf-life').value;
                    const roomTemp = document.getElementById('room-temp').value;
                    const notes = document.getElementById('recipe-notes').value;

                    if (!flourId) { alert('Un seçiniz'); return; }

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
                    extraIngredients.forEach(i => {
                        // Re-find to check if it is milk
                        const item = ingredients.find(inv => inv.id === i.id);
                        if (item) {
                            const nameLower = item.name.toLowerCase();
                            if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) {
                                milkWaterEq += (i.amount * 0.85);
                            }
                        }
                        totalWeight += i.amount;
                    });

                    const hydration = flourAmount > 0 ? ((waterAmount / flourAmount) * 100).toFixed(1) : 0;
                    const effectiveHydration = flourAmount > 0 ? (((waterAmount + milkWaterEq) / flourAmount) * 100).toFixed(1) : 0;

                    const recipeData = {
                        id: editId || Date.now().toString(),
                        name,
                        flourId,
                        flourAmount, // Storing explicitly now
                        waterAmount, // Storing explicitly now
                        totalWeight,
                        hydration,
                        effectiveHydration, // New Field

                        ballWeight,
                        shelfLife,
                        roomTemp,
                        notes,
                        ingredients: extraIngredients, // Only extras now
                        createdAt: editId ? (recipes.find(r => r.id === editId).createdAt) : new Date().toISOString(),
                        isFavorite: editId ? (recipes.find(r => r.id === editId).isFavorite) : false
                    };

                    if (editId) {
                        await window.App.Storage.updateItem('recipes', recipeData);
                    } else {
                        await window.App.Storage.addItem('recipes', recipeData);
                    }

                    modal.classList.remove('open');
                    const content = await window.App.Recipes.render(); // Re-render self to show changes
                    document.getElementById('main-view').innerHTML = content;
                    self.afterRender(); // Re-bind
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

