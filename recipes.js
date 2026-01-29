
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
                                        
                                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Raf Ömrü</label>
                                                <input type="text" class="form-control" id="shelf-life" placeholder="Örn: 3 Gün" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Ortam (°C)</label>
                                                <input type="number" class="form-control" id="room-temp" placeholder="22" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                                              <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Hedef Hamur (°C)</label>
                                                <input type="number" class="form-control" id="target-dough-temp" value="24" style="padding:6px; font-size:0.85rem; color: var(--color-primary); font-weight: bold;">
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:10px;">
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Un (°C)</label>
                                                <input type="number" class="form-control" id="flour-temp" placeholder="22" style="padding:6px; font-size:0.85rem;">
                                            </div>
                                            <div style="flex:1;">
                                                <label style="font-size:0.7rem; color:#666;">Sürtünme</label>
                                                <input type="number" class="form-control" id="friction-factor" value="5" style="padding:6px; font-size:0.85rem;">
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
            // Sim Data
            let weightedW = 0;

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

                        // W Value Estimation
                        let valW = flourItem.wValue ? parseFloat(flourItem.wValue) : (flourItem.protein ? (flourItem.protein < 10.5 ? 110 : (flourItem.protein < 12 ? 200 : (flourItem.protein < 13 ? 250 : 320))) : 200);
                        weightedW += (valW * amt);
                    }
                }
            });

            let totalWeight = totalFlourAmount + waterAmount;

            // 2. Extras (Ingredients)
            let milkWaterEq = 0;
            let totalYeast = 0;
            let yeastType = 'instant';
            let totalSalt = 0;

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
                        // Sim: Yeast & Salt
                        if (item.type === 'yeast') {
                            totalYeast += amount;
                            if (item.yeastType) yeastType = item.yeastType;
                        }
                        if (item.type === 'salt' || nameLower.includes('tuz')) {
                            totalSalt += amount;
                        }
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
                    if (saltRatio > 3.0) {
                        color = '#e74c3c'; // Red
                        msg = '🛑 Aşırı Tuzlu (Yenmez)';
                    } else if (saltRatio > 2.5) {
                        color = '#e67e22'; // Orange
                        msg = '⚠️ Çok Tuzlu';
                    } else if (saltRatio > 2.2) {
                        color = '#27ae60'; // Dark Green
                        msg = '✅ Lezzetli (Napoli)';
                    } else if (saltRatio > 1.8) {
                        color = '#2ecc71'; // Green
                        msg = '✅ İdeal (Standart)';
                    } else if (saltRatio > 1.5) {
                        color = '#f1c40f'; // Yellow
                        msg = '⚠️ Alt Sınır';
                    } else if (saltRatio > 1.0) {
                        color = '#f39c12'; // Orange
                        msg = '📉 Diyet (Az Tuzlu)';
                    } else {
                        color = '#95a5a6'; // Grey
                        msg = '❌ Tuzsuz / Tatsız';
                    }

                    saltEl.textContent = `%${saltRatio.toFixed(2)}`;
                    saltEl.style.color = color;
                    saltMsgEl.textContent = msg;
                    saltMsgEl.style.color = color;
                }
            }

            // 3. Hydration Stats (Moved up for dependencies)
            const hydration = totalFlourAmount > 0 ? ((waterAmount / totalFlourAmount) * 100) : 0;
            const milkContribution = totalFlourAmount > 0 ? ((milkWaterEq / totalFlourAmount) * 100) : 0;
            const effectiveHydration = totalFlourAmount > 0 ? (((waterAmount + milkWaterEq) / totalFlourAmount) * 100) : 0;

            // --- STRUCTURE & TEXTURE ANALYSIS ---
            const structureMsgs = [];
            const structureContainer = document.getElementById('structure-analysis-msgs');

            if (structureContainer && totalFlourAmount > 0) {
                // Helper to push standardized messages
                const addMsg = (icon, title, text, type = 'info') => {
                    structureMsgs.push({ icon, title, text, type });
                };

                // 2. Sugar Effect (Softener)
                let totalSugar = 0;
                let totalFat = 0;
                let totalMilk = 0;

                document.querySelectorAll('.ingredient-row').forEach(row => {
                    const select = row.querySelector('.ing-select');
                    const amt = parseFloat(row.querySelector('.ing-amount').value) || 0;
                    if (select.value && amt > 0) {
                        const item = ingredients.find(i => i.id === select.value);
                        if (item) {
                            const n = item.name.toLowerCase();
                            const t = item.type;
                            if (n.includes('şeker') || n.includes('sugar') || t === 'sugar' || n.includes('pekmez') || n.includes('bal')) totalSugar += amt;
                            if (n.includes('yağ') || n.includes('oil') || n.includes('butter') || n.includes('zeytin') || t === 'oil') totalFat += amt;
                            if (n.includes('süt') || n.includes('milk') || t === 'milk') totalMilk += amt;
                        }
                    }
                });


                const sugarRatio = (totalSugar / totalFlourAmount) * 100;
                const fatRatio = (totalFat / totalFlourAmount) * 100;
                const milkRatio = (totalMilk / totalFlourAmount) * 100;

                // 1. Hydration Phase
                if (effectiveHydration < 50) {
                    addMsg('🧱', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Çok sıkı, makarnalık veya mantı hamuru kıvamı. Elle yoğurması güçtür.', 'warn');
                } else if (effectiveHydration < 58) {
                    addMsg('🥯', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Sıkı yapı. Bagel, Simit veya Pretzel için ideal.', 'info');
                } else if (effectiveHydration < 65) {
                    addMsg('🍞', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Standart Ekmek/Pizza. İdeal denge, kolay işlenebilirlik.', 'success');
                } else if (effectiveHydration < 75) {
                    addMsg('☁️', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Yüksek Hidrasyon. Artisan ekmek, geniş gözenekli iç yapı.', 'info');
                } else {
                    addMsg('💧', 'HİDRASYON (%' + effectiveHydration.toFixed(1) + ')', 'Çok Yüksek Sıvı (Ciabatta/Focaccia). Yoğurma gerektirmez, katlama ister.', 'warn');
                }

                // --- SUGAR ANALYSIS (Granular) ---
                if (sugarRatio > 25) {
                    addMsg('🍰', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Aşırı Yüksek (Kek). Maya aktivitesi durma noktasına gelir. Tamamen kimyasal kabartıcı (kabartma tozu) davranışına yaklaşır.', 'warn');
                } else if (sugarRatio > 15) {
                    addMsg('🍩', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Çok Tatlı (Çörek/Donut). Belirgin tatlılık. Osmo-tolerans sınırı aşıldığı için maya yavaşlar.', 'warn');
                } else if (sugarRatio > 8) {
                    addMsg('🍔', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Tatlı Ekmek (Sandviç). Hamburger ekmeği için ideal. Yumuşak kabuk, nemli iç yapı.', 'info');
                } else if (sugarRatio > 5) {
                    addMsg('🥯', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Hafif Tatlılık. Kahvaltılık ekmekler için uygun. Maillard reaksiyonu çok güçlüdür (koyu kabuk).', 'info');
                } else if (sugarRatio > 2) {
                    addMsg('🎨', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Renk & Aktivite. Standart ekmek için üst sınır. Kabuk rengini hızlandırır.', 'info');
                } else if (sugarRatio > 0) {
                    addMsg('⚡', 'ŞEKER (%' + sugarRatio.toFixed(1) + ')', 'Maya Besini. Fermantasyonu başlatmak için yeterli.', 'info');
                }

                // --- FAT ANALYSIS (Granular) ---
                if (fatRatio > 40) {
                    addMsg('🥐', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Kurabiye Hamuru. Gluten tamamen kopar. Elle şekil verilemez, kalıp veya sıkma torbası gerekir.', 'warn');
                } else if (fatRatio > 30) {
                    addMsg('🥧', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Tart Hamuru (Shortcrust). Çok gevrek, ağızda dağılan yapı.', 'warn');
                } else if (fatRatio > 20) {
                    addMsg('🧈', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Brioche (Çok Zengin). Pamuksu, kekimsi, lif lif ayrılan yapı.', 'info');
                } else if (fatRatio > 10) {
                    addMsg('🍞', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Zenginleştirilmiş. Tost ekmeği/Sandviç. Sıkı ama yumuşak, bayatlamayan yapı.', 'info');
                } else if (fatRatio > 5) {
                    addMsg('🍪', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Orta Gevrek (Roma Usulü). Kenarlarda bisküvi kıtırlığı.', 'info');
                } else if (fatRatio > 2) {
                    addMsg('💧', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Hafif Gevrek. Standart Pizza/Ekmek katkısı.', 'info');
                } else if (fatRatio > 0) {
                    addMsg('✨', 'YAĞ (%' + fatRatio.toFixed(1) + ')', 'Eser Miktar. Sadece işlenebilirlik sağlar.', 'info');
                }

                // 4. Milk Effect (Granular & Scientific)
                if (milkRatio > 60) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Tamamen Sütlü. Hamur pH\'ı yükselir, fermantasyon yavaşlar. Kabuk çok yumuşak ve koyu renkli olur.', 'warn');
                } else if (milkRatio > 50) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Yarı Yarıya (Çok Yoğun). Suyla yarı yarıya. Besleyicilik maksimum seviyede, çok yumuşak yapı.', 'info');
                } else if (milkRatio > 40) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Yoğun Sütlü. İç doku çok sıkı ve kadifemsi (Velvet crumb).', 'info');
                } else if (milkRatio > 30) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Zengin Süt Aroması. Belirgin tatlılık, çok iyi renk alan kabuk.', 'info');
                } else if (milkRatio > 20) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Sütlü Ekmek. Belirgin süt tadı ve yumuşaklık.', 'info');
                } else if (milkRatio > 10) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Doku İyileştirici. Suya göre daha zengin, yumuşak bir iç yapı sağlar.', 'info');
                } else if (milkRatio > 0) {
                    addMsg('🥛', 'SÜT (%' + milkRatio.toFixed(1) + ')', 'Doku & Besin. Suya kıyasla daha yumuşak bir iç yapı (crumb) ve iyi bir kabuk rengi sağlar.', 'info');
                }

                // --- SMART MEMORY: PAST EXPERIENCES ---
                // Scan saved recipes for similar ratios (+/- 2% tolerance)
                if (window.App && window.App.State && window.App.State.recipes) {
                    const savedRecipes = window.App.State.recipes;
                    const tolerance = 2.0;

                    savedRecipes.forEach(r => {
                        // Skip if no notes
                        if (!r.notes || r.notes.trim().length < 3) return;
                        if (r.id === (document.getElementById('edit-recipe-id')?.value)) return; // Don't match self being edited

                        // Calculate ratios for saved recipe
                        // We need to re-calculate them or assume they are close if we stored them?
                        // Saved recipes have ingredients list. We need to parse them.

                        let rFlour = r.flourAmount || 0; // Legacy
                        if (r.flours && r.flours.length > 0) {
                            rFlour = r.flours.reduce((sum, f) => sum + f.amount, 0);
                        }
                        if (rFlour === 0) return;

                        let rWater = r.ingredients.find(i => i.type === 'water')?.amount || (parseFloat(r.hydration) ? (rFlour * parseFloat(r.hydration) / 100) : 0);
                        // Accessing raw ingredients for ratios
                        // This might be expensive for many recipes, but for <100 it's fine.

                        let rSugar = 0;
                        let rFat = 0;
                        let rMilk = 0;

                        r.ingredients.forEach(i => {
                            if (i.id) {
                                // We need to find the type/name from global inventory? 
                                // Or rely on what is saved. usually name/type is saved
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

                        const rFatRatio = (rFat / rFlour) * 100;
                        const rSugarRatio = (rSugar / rFlour) * 100;
                        const rMilkRatio = (rMilk / rFlour) * 100;

                        // Check similarity
                        const matchFat = Math.abs(rFatRatio - fatRatio) < tolerance;
                        const matchSugar = Math.abs(rSugarRatio - sugarRatio) < tolerance;
                        const matchMilk = Math.abs(rMilkRatio - milkRatio) < tolerance;

                        if (matchFat && matchSugar && matchMilk) {
                            // Found a similar recipe!
                            addMsg('🧠', 'AKILLI HAFIZA (' + r.name + ')', `"${r.notes}"`, 'warn');
                        }
                    });
                }

                // 5. Final Character Summary (Detailed Aggregation)
                let crustChar = 'Çıtır/Orta';
                let crumbChar = 'Orta/Esnek';
                let fermentChar = 'Normal';
                let typeChar = 'Standart Ekmek';

                // Analyze Crust
                if (fatRatio > 20 || sugarRatio > 12) crustChar = 'Yumuşak & İnce';
                else if (milkRatio > 50) crustChar = 'Kızarmış & Yumuşak';
                else if (fatRatio > 5) crustChar = 'Gevrek (Bisküvi)';
                else if (effectiveHydration > 75) crustChar = 'İnce & Çıtır';
                else if (effectiveHydration < 55) crustChar = 'Kalın & Sert';

                // Analyze Crumb
                if (fatRatio > 20) crumbChar = 'Pamuksu (Kekimsi)';
                else if (milkRatio > 40) crumbChar = 'Kadifemsi (Velvet)';
                else if (effectiveHydration > 70) crumbChar = 'Geniş Gözenekli (Havadar)';
                else if (effectiveHydration < 50) crumbChar = 'Çok Sıkı/Yoğun';
                else if (fatRatio > 10) crumbChar = 'Sıkı & Yumuşak';

                // Analyze Fermentation
                if (sugarRatio > 12) fermentChar = 'Çok Yavaş (Osmo-Baskı)';
                else if (sugarRatio > 2) fermentChar = 'Hızlı (Aktif)';
                else if (milkRatio > 50) fermentChar = 'Yavaş (Tamponlanmış)';

                // Overall Type
                if (fatRatio > 30) typeChar = 'TART/KURABİYE';
                else if (fatRatio > 15 || sugarRatio > 15) typeChar = 'BRİOCHE / ZENGİN';
                else if (effectiveHydration > 72) typeChar = 'ARTİSAN / RUSTİK';
                else if (fatRatio > 5 && sugarRatio > 5) typeChar = 'KAHVALTILIK / TOST';
                else if (effectiveHydration < 58) typeChar = 'BAGEL / SİMİT';

                const finalSummary = `
                    <div style="display:flex; flex-direction:column; gap:4px; margin-top:5px;">
                        <div><strong>Tür:</strong> ${typeChar}</div>
                        <div><strong>Kabuk:</strong> ${crustChar}</div>
                        <div><strong>İç Doku:</strong> ${crumbChar}</div>
                        <div><strong>Fermantasyon:</strong> ${fermentChar}</div>
                    </div>
                `;

                addMsg('🎯', 'SONUÇ KARAKTERİ', finalSummary, 'success');

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

            // Hydration UI Update
            document.getElementById('calc-hydration-base').textContent = `Hidrasyon(Su): % ${hydration.toFixed(1)} `;
            document.getElementById('calc-hydration-milk').textContent = `Süt Katkısı: +% ${milkContribution.toFixed(1)} `;
            const effEl = document.getElementById('calc-hydration-effective');
            effEl.textContent = `Efektif Hidrasyon: % ${effectiveHydration.toFixed(1)} `;

            // --- RUN SIMULATION ---
            if (window.App.Engine && totalFlourAmount > 0) {
                const avgW = totalFlourAmount > 0 ? (weightedW / totalFlourAmount) : 200;
                const roomTempInput = parseFloat(document.getElementById('room-temp')?.value) || 24;

                const result = window.App.Engine.simulate({
                    totalFlour: totalFlourAmount,
                    wValue: avgW,
                    yeastAmount: totalYeast,
                    yeastType: yeastType,
                    saltAmount: totalSalt,
                    waterAmount: waterAmount + milkWaterEq,
                    roomTemp: roomTempInput
                });

                if (document.getElementById('sim-time')) {
                    const hours = Math.floor(result.timeToPeak / 60);
                    const mins = result.timeToPeak % 60;
                    document.getElementById('sim-time').textContent = `${hours}s ${mins} dk`;
                    document.getElementById('sim-time').style.color = (result.timeToPeak < 60 || result.timeToPeak > 600) ? '#e74c3c' : '#2ecc71';

                    document.getElementById('sim-temp-note').textContent = `${roomTempInput}°C Ortam`;
                    document.getElementById('sim-tolerance').textContent = `${result.toleranceWindow} Saat`;
                    document.getElementById('sim-w-note').textContent = `Ort.W: ${Math.round(avgW)} `;

                    const advisorEl = document.getElementById('sim-advisor');
                    advisorEl.innerHTML = result.analysis.map(msg => `
                <div style="padding: 6px; border-radius: 4px; margin-top:4px; font-size:0.8rem; background: ${msg.type === 'warning' || msg.type === 'danger' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.1)'}; color: ${msg.type === 'warning' || msg.type === 'danger' ? '#e74c3c' : '#cfcfcf'}; border-left: 3px solid ${msg.type === 'warning' || msg.type === 'danger' ? '#e74c3c' : '#2ecc71'};">
                    ${msg.text}
                </div>
                `).join('');

                    // --- FDT CALCULATION ---
                    const flourTemp = parseFloat(document.getElementById('flour-temp')?.value) || 22;
                    const friction = parseFloat(document.getElementById('friction-factor')?.value) || 5;
                    const targetTemp = parseFloat(document.getElementById('target-dough-temp')?.value) || 24;
                    const desiredDoughTemp = targetTemp;

                    // Formula: WaterTemp = (Desired * 3) - (Room + Flour + Friction)
                    const requiredWaterTemp = (desiredDoughTemp * 3) - (roomTempInput + flourTemp + friction);

                    const fdtMsg = `<div style="margin-top:10px; font-size:0.85rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                        <div style="color:#aaa;">❄️ İDEAL SU SICAKLIĞI (HEDEF ${desiredDoughTemp}°C)</div>
                        <div style="font-size:1.1rem; font-weight:bold; color:${requiredWaterTemp < 10 ? '#3498db' : '#f1c40f'};">
                            ${requiredWaterTemp.toFixed(1)}°C
                            ${requiredWaterTemp < 4 ? '<span style="font-size:0.7rem; color:#e74c3c;">(BUZLU SU!)</span>' : ''}
                        </div>
                    </div>`;

                    advisorEl.innerHTML += fdtMsg;
                }
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
                        const wantToEdit = await window.App.showConfirm('Adım Yok', 'Bu reçetede tanımlı üretim adımı yok. Önce adımları tanımlamak ister misiniz?');
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

                await window.App.Storage.addItem('recipes', recipeData);
                modal.classList.remove('open');
                await self.render().then(html => {
                    document.getElementById('main-content').innerHTML = html;
                    self.afterRender();
                });
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
