
(function () {
    window.App.Showcase = {
        async render() {
            const recipes = await window.App.Storage.getAllItems('recipes') || [];
            const ingredients = await window.App.Storage.getAllItems('ingredients') || [];

            return `
                <div class="section-header" style="margin-bottom: 20px;">
                    <h2>Vitrin</h2>
                    <p style="color: var(--color-text-secondary);">En son reçeteler</p>
                </div>
                
                ${recipes.length === 0 ? `
                    <div class="empty-state">
                        <ion-icon name="grid-outline"></ion-icon>
                        <p>Vitrinde henüz reçete yok.</p>
                        <button class="btn btn-primary" onclick="window.App.navigateTo('recipes')" style="margin-top: 10px;">Reçete Oluştur</button>
                    </div>
                ` : `
                    <div class="recipe-grid">
                        ${recipes.slice().reverse().map(recipe => {
                const flour = ingredients.find(i => i.id === recipe.flourId);
                return `
                            <div class="card recipe-card">
                                <div class="card-header">
                                    <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${recipe.name}</h3>
                                    <span class="badge badge-success">Onaylı</span>
                                </div>
                                <div class="card-body" style="margin: 10px 0;">
                                    <p class="text-secondary">${flour ? flour.name : 'Bilinmeyen Un'}</p>
                                    <p style="font-size: 0.9rem; margin-top: 4px;"> 💧 %${recipe.hydration} Su • ⏳ Hazır</p>
                                </div>
                                <div style="margin-top: 8px;">
                                    <button class="btn btn-primary btn-start-prod" data-id="${recipe.id}" style="font-size: 0.8rem; padding: 6px 12px; width: 100%;">
                                        Üretime Al
                                    </button>
                                </div>
                            </div>
                            `;
            }).join('')}
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
        afterRender() {
            document.querySelectorAll('.btn-start-prod').forEach(btn => {
                btn.onclick = () => {
                    const id = btn.dataset.id;
                    // Custom Confirm
                    if (window.App.showConfirm) {
                        window.App.showConfirm(
                            "Üretim Başlat",
                            "Bu reçete ile yeni bir üretim süreci başlatılacak.",
                            () => {
                                window.App.Production.startProduction(id);
                            }
                        );
                    } else {
                        // Fallback if App.js not reloaded yet? Shouldn't happen but safe code
                        if (confirm("Bu reçete ile üretim başlatılsın mı?")) {
                            window.App.Production.startProduction(id);
                        }
                    }
                }
            });

            // Backup Handlers
            const btnExport = document.getElementById('btn-backup-export');
            const btnImport = document.getElementById('btn-backup-import');
            const fileInput = document.getElementById('file-import');

            if (btnExport) btnExport.onclick = async () => await window.App.Storage.exportAllData();

            if (btnImport) btnImport.onclick = () => fileInput.click();

            if (fileInput) fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        window.App.showConfirm(
                            "Yedekten Geri Yükle",
                            "Mevcut veriler silinecek ve yedek yüklenecek. Onaylıyor musun?",
                            async () => {
                                await window.App.Storage.importBackupData(json);
                            }
                        );
                    } catch (err) {
                        alert("Dosya okunamadı! Hatalı JSON formatı.");
                        console.error(err);
                    }
                };
                reader.readAsText(file);
            };
        }
    };
})();
