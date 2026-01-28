
/**
 * Inventory Module
 */
(function () {
    let ingredients = [];
    const Storage = window.App.Storage;

    async function refreshData() {
        ingredients = await window.App.Storage.getAllItems('ingredients') || [];
    }

    // Helper: Determine Gluten Strength
    function calculateGlutenStrength(protein) {
        if (!protein) return { label: '-', color: '#555', percent: 0 };
        const p = parseFloat(protein);

        if (p < 10.5) return { label: 'Zayıf (Bisküvilik)', color: '#FFCDD2', percent: 25, textColor: '#C62828' };
        if (p < 12.0) return { label: 'Orta (Genel)', color: '#FFF9C4', percent: 50, textColor: '#FBC02D' };
        if (p < 13.5) return { label: 'Güçlü (Ekmeklik)', color: '#C8E6C9', percent: 75, textColor: '#388E3C' };
        return { label: 'Çok Güçlü (Manitoba)', color: '#BBDEFB', percent: 100, textColor: '#1976D2' };
    }

    function renderEmptyState() {
        return `
            <div class="empty-state">
                <ion-icon name="cube-outline"></ion-icon>
                <p>Listeniz boş.</p>
                <p style="font-size: 0.8rem; margin-top: 5px;">Reçete oluşturmak için önce un ve malzeme ekleyin.</p>
            </div>
        `;
    }

    function renderList() {
        return `
            <div class="inventory-grid" style="display: grid; gap: 12px;">
                ${ingredients.map(item => {
            // BACKWARD COMPATIBILITY: One-time migration on load/display
            if (!item.packageUnit && item.unit) {
                item.packageUnit = item.unit;
            }

            let detailHtml = '';
            if (item.type === 'flour') {
                const strength = calculateGlutenStrength(item.protein);
                detailHtml = `
                            <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                                <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${strength.percent}%; height: 100%; background: ${strength.textColor};"></div>
                                </div>
                                <span style="font-size: 0.75rem; color: ${strength.color}; opacity: 0.9;">${strength.label} (%${item.protein})</span>
                            </div>
                         `;
            } else {
                detailHtml = `<div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">${item.notes || ''}</div>`;
            }

            return `
                    <div class="card ingredient-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                        <div class="info" style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="badge" style="background: ${getTypeColor(item.type)}; color: #fff;">
                                    ${getTypeLabel(item.type)}
                                </span>
                                <h4 style="font-weight: 500;">${item.name}</h4>
                            </div>
                            
                            ${detailHtml}

                            <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">
                                ${item.price && item.packageSize && item.packageUnit ? `${(item.price / item.packageSize).toFixed(2)} ₺/${item.packageUnit}` : '-'}
                            </div>
                        </div>
                        <div class="actions">
                            <button class="icon-btn btn-delete" data-id="${item.id}" style="color: var(--color-danger);">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    function getTypeLabel(type) {
        const map = { 'flour': 'Un', 'yeast': 'Maya', 'water': 'Su', 'salt': 'Tuz', 'other': 'Diğer' };
        return map[type] || type;
    }

    function getTypeColor(type) {
        const map = {
            'flour': '#FCA311',
            'yeast': '#E6C2BF',
            'water': '#90CAF9',
            'salt': '#EEEEEE',
            'other': '#9E9E9E'
        };
        return map[type] || '#555';
    }

    window.App.Inventory = {
        async render() {
            await refreshData();

            return `
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h2>Malzeme Stoğu</h2>
                        <p style="color: var(--color-text-secondary); font-size: 0.9rem;">Unlar ve diğer bileşenler</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-ingredient" style="width: auto; padding: 8px 16px;">
                        <ion-icon name="add-circle-outline" style="font-size: 1.2rem; margin-right: 4px;"></ion-icon>
                        Ekle
                    </button>
                </div>

                ${ingredients.length === 0 ? renderEmptyState() : renderList()}

                <!-- Add Ingredient Modal -->
                <div class="modal-overlay" id="modal-add-ingredient">
                    <div class="modal-content">
                        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3>Yeni Malzeme Ekle</h3>
                            <button class="icon-btn" id="btn-close-modal"><ion-icon name="close-outline"></ion-icon></button>
                        </div>
                        <form id="form-ingredient">
                            <div class="form-group">
                                <label class="form-label">Malzeme Tipi</label>
                                <div class="type-selector" style="display: flex; gap: 10px; margin-bottom: 10px;">
                                    <button type="button" class="type-btn active" data-type="flour">Un</button>
                                    <button type="button" class="type-btn" data-type="yeast">Maya</button>
                                    <button type="button" class="type-btn" data-type="other">Diğer</button>
                                </div>
                                <input type="hidden" id="inp-type" value="flour">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Marka / Ad</label>
                                <input type="text" class="form-control" id="inp-name" placeholder="Örn: Beşintaş" required>
                            </div>

                            <!-- Flour Specific Fields -->
                            <div id="flour-fields">
                                <div class="form-group">
                                    <label class="form-label">Protein Oranı (%)</label>
                                    <input type="number" step="0.1" class="form-control" id="inp-protein" placeholder="Örn: 13.5">
                                </div>
                                
                                <!-- Automatic Gluten Display -->
                                <div class="form-group" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                                    <label class="form-label" style="font-size: 0.8rem; color: #888; margin-bottom: 4px;">Tahmini Gluten Gücü</label>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span id="txt-gluten-label" style="font-weight: bold; color: #999;">-</span>
                                        <div style="width: 50%; height: 6px; background: #333; border-radius: 3px; overflow: hidden;">
                                             <div id="bar-gluten-strength" style="width: 0%; height: 100%; background: #555; transition: width 0.3s, background 0.3s;"></div>
                                        </div>
                                    </div>
                                    <input type="hidden" id="inp-gluten"> <!-- Storing label automatically -->
                                </div>
                            </div>

                            <div class="form-row" style="display: flex; gap: 10px;">
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Paket</label>
                                    <div style="display: flex; gap: 5px;">
                                        <input type="number" step="0.1" class="form-control" id="inp-package" placeholder="25" style="flex: 1;">
                                        <select class="form-control" id="inp-unit" style="width: 70px; padding: 0 4px; text-align: center;">
                                            <option value="kg">kg</option>
                                            <option value="lt">lt</option>
                                            <option value="gr">gr</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Fiyat (₺)</label>
                                    <input type="number" step="0.5" class="form-control" id="inp-price" placeholder="850">
                                </div>
                            </div>

                             <div class="form-group">
                                <label class="form-label">Notlar</label>
                                <textarea class="form-control" id="inp-notes" rows="2" placeholder="Örn: Su tutma kapasitesi yüksek."></textarea>
                            </div>

                            <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Kaydet</button>
                        </form>
                    </div>
                </div>
            `;
        },

        afterRender() {
            const modal = document.getElementById('modal-add-ingredient');
            const btnAdd = document.getElementById('btn-add-ingredient');
            const btnClose = document.getElementById('btn-close-modal');
            const form = document.getElementById('form-ingredient');
            const typeBtns = document.querySelectorAll('.type-btn');
            const typeInput = document.getElementById('inp-type');
            const flourFields = document.getElementById('flour-fields');
            const proteinInput = document.getElementById('inp-protein');

            // Auto-Gluten Logic
            if (proteinInput) {
                proteinInput.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    const strength = calculateGlutenStrength(val);

                    document.getElementById('txt-gluten-label').textContent = strength.label;
                    document.getElementById('txt-gluten-label').style.color = strength.textColor;

                    const bar = document.getElementById('bar-gluten-strength');
                    bar.style.width = strength.percent + '%';
                    bar.style.background = strength.textColor;

                    // Update hidden input if needed for storage, or just recalc on display
                    document.getElementById('inp-gluten').value = strength.label;
                });
            }

            if (btnAdd) btnAdd.onclick = () => {
                modal.classList.add('open');
                // Reset fields
                form.reset();
                document.getElementById('inp-type').value = 'flour';
                typeBtns.forEach(b => b.classList.remove('active'));
                typeBtns[0].classList.add('active'); // Set Flour active
                document.getElementById('inp-unit').value = 'kg'; // Default flour unit
                flourFields.style.display = 'block';

                // Reset visualization
                document.getElementById('txt-gluten-label').textContent = '-';
                document.getElementById('bar-gluten-strength').style.width = '0%';
            }
            if (btnClose) btnClose.onclick = () => modal.classList.remove('open');

            typeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    typeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const type = btn.dataset.type;
                    typeInput.value = type;
                    flourFields.style.display = (type === 'flour') ? 'block' : 'none';

                    // Default Unit
                    const unitSelect = document.getElementById('inp-unit');
                    if (type === 'flour') unitSelect.value = 'kg';
                    else if (type === 'water') unitSelect.value = 'lt';
                    else if (type === 'yeast') unitSelect.value = 'gr';
                    else unitSelect.value = 'gr';
                });
            });

            if (form) {
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    // Basic validation
                    if (!document.getElementById('inp-name').value) return;

                    const formData = {
                        id: Date.now().toString(),
                        type: document.getElementById('inp-type').value,
                        name: document.getElementById('inp-name').value,
                        packageSize: parseFloat(document.getElementById('inp-package').value) || 0,
                        packageUnit: document.getElementById('inp-unit').value,
                        price: parseFloat(document.getElementById('inp-price').value) || 0,
                        notes: document.getElementById('inp-notes').value
                    };

                    if (formData.type === 'flour') {
                        formData.protein = document.getElementById('inp-protein').value;
                        formData.gluten = document.getElementById('inp-gluten').value; // Stores label, mainly for legacy compatibility or quick read
                    }

                    await window.App.Storage.addItem('ingredients', formData);
                    modal.classList.remove('open');

                    // Force refresh
                    document.querySelector('[data-target="inventory"]').click();
                };
            }

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Silmek istediğine emin misin?')) {
                        const id = btn.dataset.id;
                        await window.App.Storage.deleteItem('ingredients', id);
                        document.querySelector('[data-target="inventory"]').click();
                    }
                });
            });
        }
    };
})();
