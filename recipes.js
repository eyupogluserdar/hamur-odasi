
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

                        // Water Contribution Analysis
                        let waterContrib = 0;
                        if (nameLower.includes('süt') || nameLower.includes('milk') || invItem.type === 'milk') {
                            milkAmount += ri.amount;
                            waterContrib = ri.amount * 0.87;
                        } else if (nameLower.includes('yoğurt') || nameLower.includes('yoghurt')) {
                            waterContrib = ri.amount * 0.85;
                        } else if (nameLower.includes('ayran')) {
                            waterContrib = ri.amount * 0.90;
                        } else if (nameLower.includes('yumurta') || nameLower.includes('egg')) {
                            waterContrib = ri.amount * 0.75;
                        }

                        if (waterContrib > 0) {
                            // Accumulate for effective hydration calculation
                            // specialized logic below
                        }

                        // Oil Check (yağ, oil, zeytin, olive)
                        if (nameLower.includes('yağ') || nameLower.includes('oil') || nameLower.includes('zeytin') || nameLower.includes('olive') || nameLower.includes('tereyağ') || nameLower.includes('butter')) {
                            oilAmount += ri.amount;
                        }
                    }
                });

                // Calculate Effective Hydration On-the-fly for Display
                let totalFlour = 0;
                if (recipe.flours) recipe.flours.forEach(f => totalFlour += f.amount);
                else if (recipe.flourId) totalFlour = recipe.flourAmount || 0;

                let totalWater = recipe.waterAmount || 0;
                // Double check ingredients for liquid contributions
                if (recipe.ingredients) {
                    recipe.ingredients.forEach(ri => {
                        const invItem = ingredients.find(i => i.id === ri.id);
                        if (invItem) {
                            const n = invItem.name.toLowerCase();
                            if (n.includes('süt') || n.includes('milk') || invItem.type === 'milk') totalWater += (ri.amount * 0.87);
                            else if (n.includes('yoğurt') || n.includes('yoghurt')) totalWater += (ri.amount * 0.85);
                            else if (n.includes('ayran')) totalWater += (ri.amount * 0.90);
                            else if (n.includes('yumurta') || n.includes('egg')) totalWater += (ri.amount * 0.75);
                        }
                    });
                }

                const calcEffHyd = totalFlour > 0 ? (totalWater / totalFlour * 100).toFixed(1) : 0;
                if (calcEffHyd > 0) recipe.effectiveHydration = calcEffHyd; // Update localized copy
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
                    ${milkAmount > 0 ? ` · 🥛 Süt vb.: ${milkAmount}g` : ''}
                    ${oilAmount > 0 ? ` · 🛢️ Yağ: ${oilAmount}g` : ''}
                    <div style="font-size: 0.75rem; color: #777; margin-top: 2px;">*Süt ve sıvı katkılar efektif hidrasyona dahildir.</div>
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

                <!-- Modal (Two Distinct Cards Layout) -->
                <div class="modal-overlay" id="modal-recipe" style="display: none; justify-content: center; align-items: start; padding-top: 40px; padding-bottom: 20px;">
                    
                    <!-- WRAPPER for Two Cards -->
                    <div class="modal-content-wrapper" style="width: 95vw; max-width: 1300px; display: flex; gap: 20px; max-height: 90vh;">
                        
                        <!-- CARD 1: LEFT (Recipe Inputs) -->
                        <div class="recipe-card" style="flex: 2; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                            
                            <!-- Header -->
                            <div class="modal-header" style="background: rgba(255,255,255,0.02); padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                                <h3 id="modal-title" style="font-size: 1.1rem; margin:0; color: #fff; font-weight: 600;">Reçeteyi Düzenle</h3>
                                <button class="icon-btn" id="btn-close-modal" style="background:none; border:none; color:#aaa; font-size:1.2rem; cursor:pointer;"><ion-icon name="close-outline"></ion-icon></button>
                            </div>

                            <!-- Form Body (Scrollable) -->
                            <form id="form-recipe" style="flex: 1; overflow-y: auto; padding: 20px;">
                                <input type="hidden" id="edit-recipe-id">

                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label class="form-label" style="color:#ddd;">Reçete Adı</label>
                                    <input type="text" class="form-control" id="recipe-name" placeholder="Örn: Napoliten Pizza" required>
                                </div>

                                <!-- Flours -->
                                <div class="form-group" style="margin-bottom: 15px; background: rgba(255,152,0,0.03); padding: 12px; border: 1px solid rgba(255,152,0,0.1); border-radius: 8px;">
                                    <label class="form-label" style="color: var(--color-primary); margin-bottom: 10px;">Ana Bileşenler</label>
                                    
                                    <div style="margin-bottom: 5px;">
                                        <label class="form-label" style="font-size:0.8rem; color:#888;">Un Seçimi (Mix Yapabilirsiniz)</label>
                                        <div id="flour-container"></div>
                                        <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-add-flour" style="margin-top:5px; font-size:0.75rem;">
                                            <ion-icon name="add-outline"></ion-icon> Un Ekle
                                        </button>
                                    </div>

                                    <div style="margin-top: 15px;">
                                        <label class="form-label" style="font-size:0.8rem; color:#888;"><ion-icon name="water-outline"></ion-icon> Su Miktarı</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="number" class="form-control" id="water-amount" placeholder="600" style="flex: 1;">
                                            <span style="font-size: 0.9rem; color: #666;">ml</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Ingredients -->
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label class="form-label">Diğer Malzemeler (Maya, Tuz, vb.)</label>
                                    <div id="ingredients-container"></div>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-add-ingredient" style="margin-top:5px;">Malzeme Ekle</button>
                                </div>

                                <!-- Steps -->
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label class="form-label">Üretim Adımları</label>
                                    <div id="production-steps-container"></div>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-add-step" style="margin-top:5px;">Adım Ekle</button>
                                </div>

                                <!-- Meta & Portioning -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                    <!-- Meta -->
                                    <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                        <label class="form-label" style="font-size:0.85rem; color:#aaa; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px; margin-bottom:10px; display:block;">Ortam & Süreç</label>
                                        
                                        <div style="margin-bottom: 10px;">
                                            <label style="font-size:0.7rem; color:#666;">Raf Ömrü (Gün)</label>
                                            <input type="number" class="form-control" id="shelf-life" placeholder="3" style="padding:6px; font-size:0.85rem;">
                                        </div>
                                        
                                        <!-- MODE SELECTION -->
                                        <div style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                                <label class="form-label" style="font-size:0.8rem; color:#aaa; margin:0;">Gelişim Modu</label>
                                                <div style="display:flex; gap:15px;">
                                                    <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                                                        <input type="radio" name="dev-mode" id="mode-beginner" value="beginner" checked>
                                                        <span style="font-size:0.75rem; color:#fff;">Acemi</span>
                                                    </label>
                                                    <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                                                        <input type="radio" name="dev-mode" id="mode-master" value="master">
                                                        <span style="font-size:0.75rem; color:#fff;">Usta</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- BEGINNER CONTROLS -->
                                        <div id="beginner-controls" style="margin-bottom:10px; background:rgba(52, 152, 219, 0.1); padding:8px; border-radius:6px; border:1px solid rgba(52, 152, 219, 0.2);">
                                            <label style="font-size:0.7rem; color:#3498db; display:flex; justify-content:space-between;">
                                                Hedef Süre
                                                <span id="target-time-val" style="font-weight:bold; color:#fff;">4 Saat</span>
                                            </label>
                                            <input type="range" class="form-control" id="target-time" min="1" max="24" step="1" value="4" style="padding:0; margin-top:5px;">
                                            <div style="display:flex; justify-content:space-between; font-size:0.6rem; color:#666; margin-top:2px;">
                                                <span>1s</span><span>6s</span><span>12s</span><span>24s</span>
                                            </div>
                                        </div>

                                        <!-- COMMON INPUTS -->
                                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Ortam (°C)</label>
                                                <input type="number" class="form-control" id="room-temp" placeholder="22" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Un (°C)</label>
                                                <input type="number" class="form-control" id="flour-temp" placeholder="22" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                        </div>

                                        <!-- MASTER / AUTO CALCULATED -->
                                        <div style="display:flex; gap:10px;">
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Hedef Hamur (°C) <span id="auto-badge" style="font-size:0.6em; background:var(--color-primary); color:white; padding:1px 3px; border-radius:3px; display:none;">AUTO</span></label>
                                                <input type="number" class="form-control" id="target-dough-temp" value="24" style="padding:6px; font-size:0.85rem; color: var(--color-primary); font-weight: bold;">
                                            </div>
                                            <div style="flex:1;" id="friction-group">
                                                <label style="font-size:0.7rem; color:#666;">Sürtünme</label>
                                                <input type="number" class="form-control" id="friction-factor" value="5" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                        </div>

                                        <!-- WATER TEMP RESULT -->
                                        <div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                                            <label style="font-size:0.7rem; color:#aaa; margin:0;">Önerilen Su Sıcaklığı</label>
                                            <div style="display:flex; align-items:center; gap:5px;">
                                                <input type="number" class="form-control" id="water-temp" style="width:60px; padding:4px; font-size:0.9rem; font-weight:bold; text-align:center; height:auto;" readonly>
                                                <span style="font-size:0.8rem; color:#666;">°C</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Portioning -->
                                    <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; justify-content: center;">
                                        <label class="form-label" style="font-size:0.85rem; color:#aaa; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px; margin-bottom:10px; display:block;">Porsiyonlama</label>
                                        
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Top (gr)</label>
                                                <input type="number" class="form-control" id="ball-weight" value="250" style="padding:6px; font-size:1rem; font-weight:bold; color:var(--color-primary);">
                                            </div>
                                            <div style="flex:1; text-align:center;">
                                                <label style="font-size:0.7rem; color:#666;">Adet</label>
                                                <div id="calc-yield-count" style="font-size:1.4rem; font-weight:bold; color:#fff;">0</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Notes -->
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <label class="form-label">Hamur Tepkileri & Notlar</label>
                                    <textarea class="form-control" id="recipe-notes" rows="2" placeholder="Notlar..."></textarea>
                                </div>

                                <!-- SAVE BUTTON -->
                                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1rem;">Kaydet</button>

                            </form>
                        </div>
                        
                        <!-- CARD 2: RIGHT (Analysis) -->
                        <div class="analysis-card" style="flex: 1; background: #121212; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                            
                            <!-- Header -->
                            <div class="modal-header" style="background: rgba(255,255,255,0.02); padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <h3 style="font-size: 1.1rem; margin:0; color: var(--color-primary); font-weight: 600;">📊 Canlı Analiz</h3>
                            </div>

                            <div class="analysis-body" style="padding: 20px; overflow-y: auto;">
                                
                                <!-- 1. Cost & Structure -->
                                <div style="margin-bottom: 25px;">
                                    <h4 style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Maliyet ve Yapı</h4>
                                    
                                    <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 15px;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                            <span style="color: #aaa;">Toplam Hamur:</span>
                                            <span id="calc-total-weight" style="font-weight: bold; color: #fff;">0 g</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                            <span style="color: #aaa;">Toplam Maliyet:</span>
                                            <span id="calc-total-cost" style="color: var(--color-success);">0.00 ₺</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">
                                            <span style="color: var(--color-primary);">Birim (Top) Maliyeti:</span>
                                            <span id="calc-unit-cost" style="color: var(--color-primary); font-weight: bold; font-size: 1.1rem;">0.00 ₺</span>
                                        </div>
                                    </div>



                                    <div style="margin-top: 15px; text-align: right;">
                                        <div id="calc-hydration-base" style="font-size: 0.8rem; color: #888;"></div>
                                        <div id="calc-hydration-milk" style="font-size: 0.8rem; color: #888;"></div>
                                        <div style="font-size: 0.8rem; color: #666; margin-top: 5px;">Efektif Hidrasyon</div>
                                        <div id="calc-hydration-effective" style="font-size: 1.4rem; font-weight: bold; color: var(--color-primary);">%0.0</div>
                                    </div>
                                    </div>

                                    <!-- Salt Analysis -->
                                    <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 15px; margin-top: 15px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-size: 0.8rem; color: #aaa;">Tuz Oranı:</span>
                                            <span id="calc-salt-ratio" style="font-weight: bold; font-size: 1rem;">-</span>
                                        </div>
                                        <div id="calc-salt-msg" style="font-size: 0.75rem; text-align: right; margin-top: 4px; font-style: italic;"></div>
                                    </div>

                                    <!-- Structure Analysis -->
                                    <div style="margin-top: 15px;">
                                        <h4 style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Yapı ve Doku</h4>
                                        <div id="structure-analysis-msgs" style="display: flex; flex-direction: column; gap: 8px;"></div>
                                    </div>
                                </div>

                                <!-- 2. Lab Simulation -->
                                <div>
                                    <h4 style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Laboratuvar</h4>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                                        <div style="background: rgba(0, 50, 100, 0.2); padding: 12px; border-radius: 8px; text-align: center; border: 1px solid rgba(52, 152, 219, 0.2);">
                                            <div style="font-size: 0.7rem; color: #3498db; margin-bottom: 4px;">PİK SÜRESİ</div>
                                            <div id="sim-time" style="font-size: 1.2rem; font-weight: bold; color: #fff;">-</div>
                                            <div id="sim-temp-note" style="font-size: 0.65rem; color: #888; margin-top:4px;"></div>
                                        </div>
                                        <div style="background: rgba(0, 50, 100, 0.2); padding: 12px; border-radius: 8px; text-align: center; border: 1px solid rgba(52, 152, 219, 0.2);">
                                            <div style="font-size: 0.7rem; color: #3498db; margin-bottom: 4px;">TOLERANS</div>
                                            <div id="sim-tolerance" style="font-size: 1.2rem; font-weight: bold; color: #fff;">-</div>
                                            <div id="sim-w-note" style="font-size: 0.65rem; color: #888; margin-top:4px;">Ort. W: -</div>
                                        </div>
                                    </div>

                                    <div id="sim-advisor" style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; min-height: 60px;">
                                        <!-- Messages -->
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div> <!-- End Wrapper -->
                    
                    <!-- Mobile Styles & Visibility Logic -->
                    <style>
                        .modal-overlay { display: none; }
                        .modal-overlay.open { display: flex !important; }

                        @media (max-width: 1000px) {
                            .modal-content-wrapper { flex-direction: column !important; width: 100vw !important; height: 100vh !important; max-height: none !important; border-radius: 0 !important; }
                            .recipe-card, .analysis-card { width: 100% !important; border-radius: 0 !important; border: none !important; flex: none !important; overflow: visible !important; }
                            .recipe-card { padding-bottom: 40px; }
                            .analysis-card { border-top: 1px solid rgba(255,255,255,0.1) !important; padding-bottom: 40px; }
                            .modal-overlay { padding: 0 !important; background: #000; align-items: flex-start !important; overflow-y: auto !important; display: block !important; }
                        }
                    </style>
                </div>
            `;

        },

        async openModal(editId = null) {
            try {
                // console.log('Opening modal for:', editId);
                const modal = document.getElementById('modal-recipe');
                if (!modal) throw new Error('Modal element not found!');

                const title = document.getElementById('modal-title');
                const editIdInput = document.getElementById('edit-recipe-id');
                const ingContainer = document.getElementById('ingredients-container');
                const flourContainer = document.getElementById('flour-container');
                const stepsContainer = document.getElementById('production-steps-container');

                if (!ingContainer || !flourContainer || !stepsContainer) {
                    throw new Error('Container elements missing! (ing/flour/steps)');
                }

                const formInputs = {
                    name: document.getElementById('recipe-name'),
                    waterAmount: document.getElementById('water-amount'),
                    shelfLife: document.getElementById('shelf-life'),
                    roomTemp: document.getElementById('room-temp'),
                    ballWeight: document.getElementById('ball-weight'),
                    ballWeight: document.getElementById('ball-weight'),
                    targetDoughTemp: document.getElementById('target-dough-temp'),
                    notes: document.getElementById('recipe-notes')
                };

                // Reset
                ingContainer.innerHTML = '';
                flourContainer.innerHTML = '';
                stepsContainer.innerHTML = '';
                editIdInput.value = '';
                title.textContent = 'Yeni Reçete';

                // FDT defaults
                // FDT defaults
                document.getElementById('flour-temp').value = '22';
                document.getElementById('friction-factor').value = '5';
                if (formInputs.targetDoughTemp) formInputs.targetDoughTemp.value = '24';
                document.getElementById('friction-factor').value = '5';

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

                        // Load Mode
                        const savedMode = recipe.devMode || 'beginner';
                        if (savedMode === 'master') document.getElementById('mode-master').checked = true;
                        else document.getElementById('mode-beginner').checked = true;

                        if (document.getElementById('target-time')) document.getElementById('target-time').value = recipe.targetTime || 4;

                        if (formInputs.targetDoughTemp) formInputs.targetDoughTemp.value = recipe.targetDoughTemp || 24;
                        document.getElementById('flour-temp').value = recipe.flourTemp || '22';
                        document.getElementById('friction-factor').value = recipe.frictionFactor || '5';
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

                // Bind Mode Toggle & Slider
                const modeRadios = document.querySelectorAll('input[name="dev-mode"]');
                const timeSlider = document.getElementById('target-time');

                modeRadios.forEach(r => r.addEventListener('change', () => this.updateCalculations()));
                if (timeSlider) timeSlider.addEventListener('input', () => this.updateCalculations());

                // Bind Temp Inputs for Realtime Water Calc
                ['room-temp', 'flour-temp', 'friction-factor', 'target-dough-temp'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.addEventListener('input', () => this.updateCalculations());
                });

                modal.classList.add('open');
                this.updateCalculations();
            } catch (e) {
                console.error(e);
                alert('Reçete Hatası: ' + e.message);
            }
        },

        updateCalculations() {
            const ballWeight = parseFloat(document.getElementById('ball-weight')?.value) || 250;
            const normalize = window.App.Utils.normalizeAmount;
            const waterAmount = parseFloat(document.getElementById('water-amount')?.value) || 0;

            let totalFlourAmount = 0;
            let totalCost = 0;
            let weightedW = 0;
            let result = null; // Hoisted for scope safety

            // 1. Calculate Flour Totals
            document.querySelectorAll('.flour-row').forEach(row => {
                const select = row.querySelector('.flour-select');
                const amtInput = row.querySelector('.flour-amount');
                const amt = parseFloat(amtInput.value) || 0;

                totalFlourAmount += amt;

                if (select.value) {
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
                        // W Value Estimation
                        let valW = flourItem.wValue ? parseFloat(flourItem.wValue) : (flourItem.protein ? (flourItem.protein < 10.5 ? 110 : (flourItem.protein < 12 ? 200 : (flourItem.protein < 13 ? 250 : 320))) : 200);
                        weightedW += (valW * amt);
                    }
                }
            });


            // --- NEW: DOUGH DEVELOPMENT MODE LOGIC ---
            const mode = document.querySelector('input[name="dev-mode"]:checked')?.value || 'beginner';
            const targetTimeSlider = document.getElementById('target-time');
            const targetTimeVal = document.getElementById('target-time-val');
            const targetDoughTempInput = document.getElementById('target-dough-temp');
            const frictionInput = document.getElementById('friction-factor');
            const waterTempInput = document.getElementById('water-temp');
            const autoBadge = document.getElementById('auto-badge');

            // Common inputs
            const roomT = parseFloat(document.getElementById('room-temp')?.value) || 22;
            const flourT = parseFloat(document.getElementById('flour-temp')?.value) || roomT;

            // UNIFIED FRICTION SOURCE: Always try to read input, default to 5.
            let activeFriction = parseFloat(frictionInput?.value);
            if (isNaN(activeFriction)) activeFriction = 5;

            // UI Visibility & Calculation
            const beginnerControls = document.getElementById('beginner-controls');
            const frictionGroup = document.getElementById('friction-group');

            if (mode === 'beginner') {
                if (beginnerControls) beginnerControls.style.display = 'block';
                if (frictionGroup) frictionGroup.style.display = 'none'; // Hide friction in beginner

                if (targetDoughTempInput) {
                    targetDoughTempInput.readOnly = true;
                    targetDoughTempInput.style.color = '#888';
                }
                if (autoBadge) autoBadge.style.display = 'inline-block';

                // Auto-Calc Target Temp
                const time = parseInt(targetTimeSlider?.value || 4);
                if (targetTimeVal) targetTimeVal.textContent = time + ' Saat';

                // engine might be undefined during pure strict mode? No, window.App.Engine
                const idealTarget = window.App.Engine ? window.App.Engine.calculateTargetDoughTemp(time) : 24;
                if (targetDoughTempInput) targetDoughTempInput.value = idealTarget; // Auto-set

                // Auto-Calc Water Temp (Use Unified activeFriction)
                const wTemp = window.App.Engine ? window.App.Engine.calculateWaterTemp(idealTarget, roomT, flourT, activeFriction) : 0;
                if (waterTempInput) {
                    waterTempInput.value = wTemp;
                    waterTempInput.style.color = wTemp > 50 ? 'red' : (wTemp < 4 ? 'blue' : 'var(--color-primary)');
                }

            } else {
                // Master Mode
                if (beginnerControls) beginnerControls.style.display = 'none';
                if (frictionGroup) frictionGroup.style.display = 'block';

                if (targetDoughTempInput) {
                    targetDoughTempInput.readOnly = false;
                    targetDoughTempInput.style.color = 'var(--color-primary)';
                }
                if (autoBadge) autoBadge.style.display = 'none';

                // Manual Calc
                const manTarget = parseFloat(targetDoughTempInput?.value) || 24;
                // Use activeFriction here too for consistency, or reparsed? Better reuse activeFriction.
                // But wait, activeFriction reads current input. That is correct for master mode too.
                const wTemp = window.App.Engine ? window.App.Engine.calculateWaterTemp(manTarget, roomT, flourT, activeFriction) : 0;
                if (waterTempInput) {
                    waterTempInput.value = wTemp;
                    waterTempInput.style.color = wTemp > 50 ? 'red' : 'var(--color-primary)';
                }
            }

            // Sync activeFriction variable for later usage if needed (though we defined it below again, 
            // best to use single source of truth but for now I'm patching the friction reading below)

            let totalWeight = totalFlourAmount + waterAmount;
            const avgW = totalFlourAmount > 0 ? (weightedW / totalFlourAmount) : 200;
            const roomTempInput = roomT;

            // 2. Extras (Ingredients)
            let milkWaterEq = 0;
            let totalYeast = 0;
            let yeastType = 'instant';
            let totalSalt = 0;

            // For Analysis
            let totalSugar = 0;
            let totalFat = 0;
            let totalMilk = 0;

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

                        // Hydration Logic
                        const nameLower = item.name.toLowerCase();
                        let factor = 0;
                        if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) { factor = 0.65; }
                        else if (nameLower.includes('yoğurt') || nameLower.includes('yoghurt')) { factor = 0.85; }
                        else if (nameLower.includes('ayran')) { factor = 0.90; }
                        else if (nameLower.includes('yumurta') || nameLower.includes('egg')) { factor = 0.75; }

                        if (factor > 0) milkWaterEq += (amount * factor);

                        // Sim: Yeast & Salt
                        if (item.type === 'yeast') {
                            totalYeast += amount;
                            if (item.yeastType) yeastType = item.yeastType;
                        }
                        if (item.type === 'salt' || nameLower.includes('tuz')) {
                            totalSalt += amount;
                        }

                        // Analysis Ratios
                        const t = item.type;
                        if (nameLower.includes('şeker') || nameLower.includes('sugar') || t === 'sugar' || nameLower.includes('pekmez') || nameLower.includes('bal')) totalSugar += amount;
                        if (nameLower.includes('yağ') || nameLower.includes('oil') || nameLower.includes('butter') || nameLower.includes('zeytin') || t === 'oil') totalFat += amount;
                        if (nameLower.includes('süt') || nameLower.includes('milk') || t === 'milk') totalMilk += amount;
                    }
                }
            });

            // --- SALT RATIO LOGIC ---
            const saltRatio = totalFlourAmount > 0 ? ((totalSalt / totalFlourAmount) * 100) : 0;
            const saltEl = document.getElementById('calc-salt-ratio');
            const saltMsgEl = document.getElementById('calc-salt-msg');

            if (saltEl && saltMsgEl) {
                let color = '#fff';
                let msg = '';
                if (totalFlourAmount === 0) {
                    saltEl.textContent = '-';
                    saltMsgEl.textContent = '';
                } else {
                    if (saltRatio > 3.0) { color = '#e74c3c'; msg = '🛑 Aşırı Tuzlu (Yenmez)'; }
                    else if (saltRatio > 2.5) { color = '#e67e22'; msg = '⚠️ Çok Tuzlu'; }
                    else if (saltRatio > 2.2) { color = '#27ae60'; msg = '✅ Lezzetli (Napoli)'; }
                    else if (saltRatio > 1.8) { color = '#2ecc71'; msg = '✅ İdeal (Standart)'; }
                    else if (saltRatio > 1.5) { color = '#f1c40f'; msg = '⚠️ Alt Sınır'; }
                    else if (saltRatio > 1.0) { color = '#f39c12'; msg = '📉 Diyet (Az Tuzlu)'; }
                    else { color = '#95a5a6'; msg = '❌ Tuzsuz / Tatsız'; }
                    saltEl.textContent = `%${saltRatio.toFixed(2)}`;
                    saltEl.style.color = color;
                    saltMsgEl.textContent = msg;
                    saltMsgEl.style.color = color;
                }
            }

            // 3. Hydration Stats
            const hydration = totalFlourAmount > 0 ? ((waterAmount / totalFlourAmount) * 100) : 0;
            const milkContribution = totalFlourAmount > 0 ? ((milkWaterEq / totalFlourAmount) * 100) : 0;
            const effectiveHydration = totalFlourAmount > 0 ? (((waterAmount + milkWaterEq) / totalFlourAmount) * 100) : 0;

            const sugarRatio = (totalSugar / totalFlourAmount) * 100;
            const fatRatio = (totalFat / totalFlourAmount) * 100;
            const milkRatio = (totalMilk / totalFlourAmount) * 100;

            // --- YEAST AUTO-CORRECTION (Prioritized for Beginner Mode) ---
            const activeMode = document.querySelector('input[name="dev-mode"]:checked')?.value || 'beginner';
            let yeastCorrectionMsg = '';

            if (activeMode === 'beginner' && totalFlourAmount > 0) {
                const currentYeastPct = window.App.Engine ? window.App.Engine.getEffectiveYeastPercent(totalYeast, yeastType, totalFlourAmount) : 0;
                const tTime = parseInt(document.getElementById('target-time')?.value || 4);

                // Validate using Engine
                if (window.App.Engine && window.App.Engine.validateYeastForTime) {
                    // Returns needed DRY yeast %
                    const uncorrectedNeededDryPct = window.App.Engine.validateYeastForTime(currentYeastPct, tTime);

                    if (uncorrectedNeededDryPct !== null) {
                        // Calculate gram amount for DRY yeast
                        const neededDryGrams = (uncorrectedNeededDryPct * totalFlourAmount) / 100;

                        // UNIT CONVERSION: Convert Dry Grams back to Selected Yeast Type
                        let finalAmount = neededDryGrams;
                        if (yeastType === 'fresh') finalAmount = neededDryGrams * 3.0; // 1 Dry = 3 Fresh
                        else if (yeastType === 'active_dry') finalAmount = neededDryGrams * 1.1;

                        // Find Yeast Row to Update
                        const yeastRow = Array.from(document.querySelectorAll('.ingredient-row')).find(row => {
                            const sel = row.querySelector('.ing-select');
                            const opt = sel.selectedOptions[0];
                            // Check both dataset type and actual value to be sure
                            return (opt && opt.dataset.type === 'yeast') || (opt && opt.text.toLowerCase().includes('maya'));
                        });

                        if (yeastRow) {
                            const input = yeastRow.querySelector('.ing-amount');
                            const currentVal = parseFloat(input.value) || 0;

                            // Only update if significant difference (avoid infinite loops)
                            if (Math.abs(currentVal - finalAmount) > 0.5) {
                                input.value = finalAmount.toFixed(1);
                                // Update locals immediately for simulation to pick up new values
                                totalYeast = finalAmount;
                                yeastCorrectionMsg = `<div style="padding:6px; margin-top:5px; background:rgba(241, 196, 15, 0.2); color:#f1c40f; border-radius:4px; font-size:0.8rem;">
                                    ⚠️ Maya oranı <strong>${tTime} saat</strong> hedefi için güncellendi. (%${uncorrectedNeededDryPct.toFixed(2)} Kuru Maya Eşdeğeri)
                                 </div>`;
                            }
                        }
                    }
                }
            }

            // --- EARLY SIMULATION (Blocking) ---
            // Use current actual yeast, not hypothetical
            const simYeastAmount = totalYeast;

            if (window.App.Engine && totalFlourAmount > 0) {
                result = window.App.Engine.simulate({
                    totalFlour: totalFlourAmount,
                    wValue: avgW,
                    yeastAmount: simYeastAmount,
                    yeastType: yeastType,
                    saltAmount: totalSalt,
                    waterAmount: waterAmount,
                    effectiveWaterAmount: waterAmount + milkWaterEq,
                    milkRatio: milkRatio,
                    fatRatio: fatRatio,
                    roomTemp: roomTempInput,
                    doughTemp: parseFloat(document.getElementById('target-dough-temp')?.value) // Pass FDT
                });
            }

            // --- STRUCTURE & TEXTURE ANALYSIS ---
            const structureMsgs = [];
            const structureContainer = document.getElementById('structure-analysis-msgs');

            if (structureContainer && totalFlourAmount > 0) {
                const addMsg = (icon, title, text, type = 'info') => {
                    structureMsgs.push({ icon, title, text, type });
                };

                // 1. Hydration Phase (Consolidated Logic)
                const isRichForHydration = (fatRatio >= 8 || milkRatio >= 20);

                if (isRichForHydration) {
                    // RICH DOUGH OVERRIDE (Priority: Richness > Hydration)
                    // Even if hydration is high, the structure is bound by fat/milk.
                    addMsg('💧', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Yüksek sıvı oranına rağmen yağ ve süt nedeniyle hamur bağlanmıştır. Yoğurma ile yapı geliştirilir.', 'info');
                } else {
                    // STANDARD HYDRATION LOGIC (with Transition Check)
                    if (effectiveHydration < 50) addMsg('🧱', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Çok sıkı, makarnalık veya mantı hamuru kıvamı. Elle yoğurması güçtür.', 'warn');
                    else if (effectiveHydration < 58) addMsg('🥯', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Sıkı yapı. Bagel, Simit veya Pretzel için ideal.', 'info');
                    else if (effectiveHydration < 65) addMsg('🍞', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Standart Ekmek/Pizza. İdeal denge, kolay işlenebilirlik.', 'success');
                    else if (effectiveHydration < 75) addMsg('☁️', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Yüksek Hidrasyon. Artisan ekmek, geniş gözenekli iç yapı.', 'info');
                    else {
                        // High Hydration Check (>= 75)
                        // Transition Logic: Milk >= 15 AND Fat >= 6
                        if (effectiveHydration >= 78 && milkRatio >= 15 && fatRatio >= 6) {
                            addMsg('💧', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Yüksek Sıvı (Geçiş Tipi Hamur). Zenginleştiriciler yapıyı destekliyor.', 'info');
                        } else {
                            addMsg('💧', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Çok Yüksek Sıvı (Ciabatta/Focaccia). Yoğurma gerektirmez, katlama ister.', 'warn');
                        }
                    }
                }

                // --- SUGAR ANALYSIS ---
                if (sugarRatio > 25) addMsg('🍰', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Aşırı Yüksek (Kek). Maya aktivitesi durma noktasına gelir.', 'warn');
                else if (sugarRatio > 15) addMsg('🍩', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Çok Tatlı (Çörek/Donut). Belirgin tatlılık. Osmo-tolerans sınırı aşıldığı için maya yavaşlar.', 'warn');
                else if (sugarRatio > 8) addMsg('🍔', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Tatlı Ekmek (Sandviç). Hamburger ekmeği için ideal.', 'info');
                else if (sugarRatio > 5) addMsg('🥯', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Hafif Tatlılık. Kahvaltılık ekmekler için uygun.', 'info');
                else if (sugarRatio > 2) addMsg('🎨', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Renk & Aktivite. Standart ekmek için üst sınır. Kabuk rengini hızlandırır.', 'info');
                else if (sugarRatio > 0) addMsg('⚡', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Maya Besini. Fermantasyonu başlatmak için yeterli.', 'info');

                // --- FAT ANALYSIS ---
                if (fatRatio > 40) addMsg('🥐', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Kurabiye Hamuru. Gluten tamamen kopar. Elle şekil verilemez.', 'warn');
                else if (fatRatio > 30) addMsg('🥧', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Tart Hamuru (Shortcrust). Çok gevrek, ağızda dağılan yapı.', 'warn');
                else if (fatRatio > 20) addMsg('🧈', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Brioche (Çok Zengin). Pamuksu, kekimsi, lif lif ayrılan yapı.', 'info');
                else if (fatRatio > 10) addMsg('🍞', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Zenginleştirilmiş. Tost ekmeği/Sandviç. Sıkı ama yumuşak, bayatlamayan yapı.', 'info');
                else if (fatRatio > 5) addMsg('🍪', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Orta Gevrek (Roma Usulü). Kenarlarda bisküvi kıtırlığı.', 'info');
                else if (fatRatio > 2) addMsg('💧', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Hafif Gevrek. Standart Pizza/Ekmek katkısı.', 'info');
                else if (fatRatio > 0) addMsg('✨', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Eser Miktar. Sadece işlenebilirlik sağlar.', 'info');

                // --- MILK Analysis ---
                if (milkRatio > 60) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Tamamen Sütlü. Hamur pH\'ı yükselir, fermantasyon yavaşlar. Kabuk çok yumuşak olur.', 'warn');
                else if (milkRatio > 50) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Yarı Yarıya (Çok Yoğun). Suyla yarı yarıya. Besleyicilik maksimum seviyede.', 'info');
                else if (milkRatio > 40) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Yoğun Sütlü. İç doku çok sıkı ve kadifemsi (Velvet crumb).', 'info');
                else if (milkRatio > 30) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Zengin Süt Aroması. Belirgin tatlılık, çok iyi renk alan kabuk.', 'info');
                else if (milkRatio > 20) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Sütlü Ekmek. Belirgin süt tadı ve yumuşaklık.', 'info');
                else if (milkRatio > 10) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Doku İyileştirici. Suya göre daha zengin, yumuşak bir iç yapı sağlar.', 'info');
                else if (milkRatio > 0) addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Doku & Besin. Suya kıyasla daha yumuşak bir iç yapı sağlar.', 'info');

                // --- SMART MEMORY ---
                if (window.App && window.App.State && window.App.State.recipes) {
                    const savedRecipes = window.App.State.recipes;
                    const tolerance = 2.0;

                    savedRecipes.forEach(r => {
                        if (!r.notes || r.notes.trim().length < 3) return;
                        if (r.id === (document.getElementById('edit-recipe-id')?.value)) return;

                        let rFlour = r.flourAmount || 0;
                        if (r.flours && r.flours.length > 0) rFlour = r.flours.reduce((sum, f) => sum + f.amount, 0);
                        if (rFlour === 0) return;

                        let rSugar = 0, rFat = 0, rMilk = 0;
                        r.ingredients.forEach(i => {
                            if (i.id) {
                                const invItem = ingredients.find(inv => inv.id === i.id);
                                if (invItem) {
                                    const n = invItem.name.toLowerCase();
                                    const t = invItem.type;
                                    if (n.includes('şeker') || n.includes('sugar') || t === 'sugar') rSugar += i.amount;
                                    if (n.includes('yağ') || n.includes('oil') || t === 'oil') rFat += i.amount;
                                    if (n.includes('süt') || n.includes('milk') || t === 'milk') rMilk += i.amount;
                                }
                            }
                        });

                        if ((Math.abs((rFat / rFlour) * 100 - fatRatio) < tolerance) &&
                            (Math.abs((rSugar / rFlour) * 100 - sugarRatio) < tolerance) &&
                            (Math.abs((rMilk / rFlour) * 100 - milkRatio) < tolerance)) {
                            addMsg('🧠', 'AKILLI HAFIZA (' + r.name + ')', `"${r.notes}"`, 'warn');
                        }
                    });
                }

                // 5. Final Character Summary (Text Engine via Engine.js)
                if (result && result.description) {

                    // --- PRODUCT SUGGESTIONS (New Feature) ---
                    const suggestedProducts = window.App.Engine.getSuggestedProducts(
                        effectiveHydration,
                        fatRatio,
                        milkRatio
                    );

                    const finalSummary = `
                        <div style="display:flex; flex-direction:column; gap:6px; margin-top:5px;">
                            <div><strong>Tür:</strong> ${result.description.type}</div>
                            <div><strong>Kabuk:</strong> ${result.description.crust}</div>
                            <div><strong>İç Doku:</strong> ${result.description.crumb}</div>
                            <div><strong>Fermantasyon:</strong> ${result.description.fermentation}</div>
                            
                            <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); color:#f39c12;">
                                <div style="font-size:0.7em; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px; opacity:0.8;">Oluşturabileceği Ürünler</div>
                                <div style="font-weight:bold; font-size:1.05em;">${suggestedProducts}</div>
                            </div>
                        </div>
                    `;
                    addMsg('🎯', 'SONUÇ KARAKTERİ', finalSummary, 'success');
                }

                structureContainer.innerHTML = structureMsgs.map(m => `
                    <div style="font-size: 0.8rem; color: #ccc; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; border-left: 3px solid ${m.type === 'warn' ? '#e74c3c' : (m.type === 'success' ? '#2ecc71' : '#3498db')}; margin-bottom: 4px;">
                        <div style="font-weight:bold; color:${m.type === 'warn' ? '#e74c3c' : '#fff'}; margin-bottom:2px;">
                            <span style="margin-right: 5px;">${m.icon}</span> ${m.title}
                        </div>
                        <div style="opacity: 0.8;">${m.text}</div>
                    </div>
                `).join('');
            } else if (structureContainer) {
                structureContainer.innerHTML = '<div style="font-size:0.8rem; color:#666; font-style:italic;">Analiz için malzeme ekleyin...</div>';
            }

            const yieldCount = Math.floor(totalWeight / ballWeight);
            const unitCost = yieldCount > 0 ? (totalCost / yieldCount) : 0;

            document.getElementById('calc-total-weight').textContent = `${totalWeight} g`;
            document.getElementById('calc-total-cost').textContent = `${totalCost.toFixed(2)} ₺`;
            document.getElementById('calc-unit-cost').textContent = `${unitCost.toFixed(2)} ₺`;
            document.getElementById('calc-yield-count').textContent = yieldCount;

            document.getElementById('calc-hydration-base').textContent = `Hidrasyon(Su): % ${hydration.toFixed(1)} `;
            document.getElementById('calc-hydration-milk').textContent = `Süt Katkısı: +% ${milkContribution.toFixed(1)} `;
            document.getElementById('calc-hydration-effective').textContent = `Efektif Hidrasyon: % ${effectiveHydration.toFixed(1)} `;

            // --- RUN SIMULATION UI ---
            if (result && document.getElementById('sim-time')) {
                const timeToPeak = result.timeToPeak;
                const hours = Math.floor(timeToPeak / 60);
                const mins = timeToPeak % 60;

                document.getElementById('sim-time').textContent = `${hours}s ${mins} dk`;
                document.getElementById('sim-time').style.color = (timeToPeak < 60 || timeToPeak > 600) ? '#e74c3c' : '#2ecc71';
                document.getElementById('sim-temp-note').textContent = `${roomTempInput}°C Ortam`;

                const tolEl = document.getElementById('sim-tolerance');
                tolEl.textContent = `${result.toleranceWindow.toFixed(1)} Saat`;

                if (result.isRich && avgW <= 220) {
                    tolEl.style.color = '#f39c12';
                    document.getElementById('sim-w-note').innerHTML = `Ort.W: ${Math.round(avgW)} <br><span style="color:#f39c12; font-size:0.6rem;">(Zengin Hamur Sınırı)</span>`;
                } else {
                    tolEl.style.color = '#fff';
                    document.getElementById('sim-w-note').textContent = `Ort.W: ${Math.round(avgW)} `;
                }

                const advisorEl = document.getElementById('sim-advisor');
                advisorEl.innerHTML = result.analysis.map(msg => `
                    <div style="padding: 6px; border-radius: 4px; margin-top:4px; font-size:0.8rem; background: ${msg.type === 'warning' || msg.type === 'danger' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.1)'}; color: ${msg.type === 'warning' || msg.type === 'danger' ? '#e74c3c' : '#cfcfcf'}; border-left: 3px solid ${msg.type === 'warning' || msg.type === 'danger' ? '#e74c3c' : '#2ecc71'};">
                        ${msg.text}
                    </div>
                `).join('');

                if (result.isRich) {
                    advisorEl.innerHTML += `
                    <div style="padding: 6px; border-radius: 4px; margin-top:4px; font-size:0.8rem; background: rgba(52, 152, 219, 0.1); color: #3498db; border-left: 3px solid #3498db;">
                            ℹ️ <strong>Zengin Hamur:</strong> Süt/Yağ içeriği nedeniyle pik süresi uzatıldı ve tolerans penceresi güncellendi.
                    </div>`;
                }

                if (yeastCorrectionMsg) {
                    advisorEl.innerHTML += yeastCorrectionMsg;
                }

                // --- fdt calculation was here ---

                // --- FDT CALCULATION ---
                // --- FDT CALCULATION ---
                // --- FDT CALCULATION ---
                const flourTemp = flourT;

                // Use activeFriction determined at top of function (syncs with Mode)
                const currentFriction = activeFriction;

                const targetTemp = parseFloat(document.getElementById('target-dough-temp')?.value) || 24;
                const desiredDoughTemp = targetTemp;

                // Calculate using Helper
                const requiredWaterTemp = window.App.Engine ? window.App.Engine.calculateWaterTemp(desiredDoughTemp, roomTempInput, flourTemp, currentFriction) : 0;


                const fdtMsg = `<div style="margin-top:10px; font-size:0.85rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                    <div style="color:#aaa;">❄️ İDEAL SU SICAKLIĞI (HEDEF ${desiredDoughTemp}°C)</div>
                    <div style="font-size:1.1rem; font-weight:bold; color:${requiredWaterTemp < 10 ? '#3498db' : '#f1c40f'};">
                        ${requiredWaterTemp.toFixed(1)}°C
                        ${requiredWaterTemp < 4 ? '<span style="font-size:0.7rem; color:#e74c3c;">(BUZLU SU!)</span>' : ''}
                    </div>
                </div>`;
                advisorEl.innerHTML += fdtMsg;
            }
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
                     <input type="number" step="any" class="form-control flour-amount" placeholder="gr" value="${preAmount}" style="width:100%;">
                     <span style="font-size:0.7rem; color:#888;">gr</span>
                </div>
                <button type="button" class="icon-btn btn-remove-flour" style="color: var(--color-danger);"><ion-icon name="close-circle-outline"></ion-icon></button>
            `;

            container.appendChild(div);

            const self = this;
            div.querySelector('.flour-select').addEventListener('change', () => self.updateCalculations());
            div.querySelector('.flour-amount').addEventListener('input', () => self.updateCalculations());
            div.querySelector('.btn-remove-flour').onclick = async () => {
                // Don't allow removing last flour row to prevent empty state issues (optional but good UX)
                if (document.querySelectorAll('.flour-row').length > 1) {
                    div.remove();
                    self.updateCalculations();
                } else {
                    await window.App.showAlert('Uyarı', 'En az bir un çeşidi girmelisiniz.');
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
                <input type="number" step="any" class="form-control ing-amount" placeholder="gr" value="${preValue}" style="flex: 1;">
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
                        <div style="display:flex; align-items:center; gap:4px; flex: 1; min-width: 100px;">
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
            const btnAddRow = document.getElementById('btn-add-ingredient');
            const btnAddStep = document.getElementById('btn-add-step');
            const btnAddFlour = document.getElementById('btn-add-flour');

            // Input listeners for calc
            // Input listeners for calc
            // Input listeners for calc
            ['water-amount', 'ball-weight', 'room-temp', 'flour-temp', 'friction-factor', 'target-dough-temp'].forEach(id => {
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
                        const wantToEdit = await window.App.showConfirm(
                            'Adımlar Eksik',
                            'Bu reçetede üretim adımları (Yoğurma, Mayalanma vb.) tanımlanmamış. Üretim takibi yapabilmek için önce adımları eklemelisiniz. Düzenleme ekranına gitmek ister misiniz?'
                        );
                        if (wantToEdit) {
                            await self.openModal(rId);
                        }
                        return;
                    }

                    if (await window.App.showConfirm('Üretimi Başlat', `"${recipe.name}" için üretim süreci başlatılsın mı?`)) {
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
            // Form Submit (Refactored to be called from Nav Button too)
            const handleSave = async (e) => {
                if (e) e.preventDefault();

                try {
                    const editId = document.getElementById('edit-recipe-id').value;
                    const name = document.getElementById('recipe-name').value;
                    const waterAmount = parseFloat(document.getElementById('water-amount').value);
                    const ballWeight = parseFloat(document.getElementById('ball-weight').value);
                    const shelfLife = document.getElementById('shelf-life').value;
                    const roomTemp = parseFloat(document.getElementById('room-temp').value) || '';
                    const flourTemp = parseFloat(document.getElementById('flour-temp').value) || '';
                    const frictionFactor = parseFloat(document.getElementById('friction-factor').value) || '';
                    const targetDoughTemp = parseFloat(document.getElementById('target-dough-temp').value) || 24;
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

                    if (flours.length === 0) { await window.App.showAlert('Hata', 'En az bir un seçmelisiniz.'); return; }

                    const extraIngredients = [];
                    document.querySelectorAll('.ingredient-row').forEach(row => {
                        const select = row.querySelector('.ing-select');
                        const amount = parseFloat(row.querySelector('.ing-amount').value) || 0;
                        if (select.value) {
                            extraIngredients.push({ id: select.value, amount: amount });
                        }
                    });

                    // Get Steps
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

                    // Calculated totals
                    let milkWaterEq = 0;
                    let totalWeight = totalFlourAmount + waterAmount;

                    extraIngredients.forEach(i => {
                        const item = ingredients.find(inv => inv.id === i.id);
                        if (item) {
                            const nameLower = item.name.toLowerCase();
                            let factor = 0;
                            if (nameLower.includes('süt') || nameLower.includes('milk') || (item.type === 'milk')) factor = 0.87;
                            else if (nameLower.includes('yoğurt') || nameLower.includes('yoghurt')) factor = 0.85;
                            else if (nameLower.includes('ayran')) factor = 0.90;
                            else if (nameLower.includes('yumurta') || nameLower.includes('egg')) factor = 0.75;

                            if (factor > 0) milkWaterEq += (i.amount * factor);
                        }
                        totalWeight += i.amount;
                    });

                    const hydration = totalFlourAmount > 0 ? ((waterAmount / totalFlourAmount) * 100).toFixed(1) : 0;
                    const effectiveHydration = totalFlourAmount > 0 ? (((waterAmount + milkWaterEq) / totalFlourAmount) * 100).toFixed(1) : 0;

                    const recipeData = {
                        id: editId || Date.now().toString(),
                        name,
                        flourId: flours[0].id, // Legacy compat
                        flourAmount: flours[0].amount, // Legacy compat
                        flours: flours,
                        waterAmount,
                        ingredients: extraIngredients,
                        productionSteps: steps,
                        // Metadata
                        hydration: parseFloat(hydration),
                        effectiveHydration: parseFloat(effectiveHydration),
                        ballWeight,
                        totalWeight,
                        shelfLife,
                        roomTemp,
                        flourTemp,
                        frictionFactor,
                        targetDoughTemp,

                        notes,
                        // New Fields
                        devMode: document.querySelector('input[name="dev-mode"]:checked')?.value || 'beginner',
                        targetTime: parseInt(document.getElementById('target-time')?.value || 4),
                        waterTemp: parseFloat(document.getElementById('water-temp')?.value || 0),

                        isFavorite: false, // Default, preserved below
                        createdAt: Date.now()
                    };

                    // Preserve favorite if editing
                    if (editId) {
                        const existing = await window.App.Storage.getItemById('recipes', editId);
                        if (existing) {
                            recipeData.isFavorite = existing.isFavorite;
                            recipeData.createdAt = existing.createdAt || Date.now();
                        }
                    }

                    // Universal save (Upsert) - prevents 'Key already exists' error
                    await window.App.Storage.updateItem('recipes', recipeData);

                    modal.classList.remove('open');
                    await self.render().then(html => {
                        document.getElementById('main-view').innerHTML = html;
                        self.afterRender();
                    });

                } catch (e) {
                    console.error(e);
                    await window.App.showAlert('Hata', 'Kayıt sırasında hata oluştu: ' + e.message);
                }
            };

            if (form) form.onsubmit = handleSave;
            // Bind new Nav Save Button
            const navSaveBtn = document.getElementById('btn-save-recipe-nav');
            if (navSaveBtn) navSaveBtn.onclick = handleSave;

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
                    if (await window.App.showConfirm('Sil', 'Silmek istediğine emin misiniz?')) {
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
