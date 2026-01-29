/**
 * HAMUR ODASI - Main Application Logic
 */
(function () {
    const state = {
        currentView: 'showcase',
        theme: 'dark' // Default, will load async
    };

    // Helper: Global Utils
    window.App.Utils = {
        normalizeAmount(amount, unit) {
            const val = parseFloat(amount) || 0;
            if (unit === 'kg') return val * 1000;
            if (unit === 'lt') return val * 1000;
            if (unit === 'gr') return val;
            if (unit === 'ml') return val; // Treat ml as gr
            return val; // Fallback
        },
        formatCurrency(amount) {
            return parseFloat(amount).toFixed(2) + ' ₺';
        }
    };

    // Helper: Global Confirm/Alert (Promise-based)
    window.App.showConfirm = function (title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-confirm');
            const titleEl = document.getElementById('confirm-title');
            const msgEl = document.getElementById('confirm-message');
            const btnOk = document.getElementById('btn-confirm-ok');
            const btnCancel = document.getElementById('btn-confirm-cancel');

            titleEl.textContent = title;
            msgEl.innerHTML = message;
            btnCancel.style.display = 'block'; // Ensure cancel is visible
            btnOk.textContent = 'Evet, Onayla';
            btnOk.className = 'btn btn-primary';

            // Clean previous listeners by cloning
            const newBtnOk = btnOk.cloneNode(true);
            btnOk.parentNode.replaceChild(newBtnOk, btnOk);
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

            const close = (result) => {
                modal.classList.remove('open');
                resolve(result);
            };

            newBtnOk.addEventListener('click', () => close(true));
            newBtnCancel.addEventListener('click', () => close(false));

            // Background click to cancel
            modal.onclick = (e) => {
                if (e.target === modal) close(false);
            };

            modal.classList.add('open');
        });
    };

    window.App.showAlert = function (title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-confirm');
            const titleEl = document.getElementById('confirm-title');
            const msgEl = document.getElementById('confirm-message');
            const btnOk = document.getElementById('btn-confirm-ok');
            const btnCancel = document.getElementById('btn-confirm-cancel');

            titleEl.textContent = title;
            msgEl.innerHTML = message;
            btnCancel.style.display = 'none'; // Hide cancel
            btnOk.textContent = 'Tamam';
            btnOk.className = 'btn btn-primary';

            const newBtnOk = btnOk.cloneNode(true);
            btnOk.parentNode.replaceChild(newBtnOk, btnOk);

            const close = () => {
                modal.classList.remove('open');
                resolve();
            };

            newBtnOk.addEventListener('click', close);
            // Background click to close
            modal.onclick = (e) => {
                if (e.target === modal) close();
            };

            modal.classList.add('open');
        });
    };

    const elements = {
        pageTitle: document.getElementById('page-title'),
        mainView: document.getElementById('main-view'),
        navItems: document.querySelectorAll('.nav-item'),
        themeToggle: document.getElementById('theme-toggle'),
        addRecipeBtn: document.getElementById('add-recipe-btn')
    };

    const routes = {
        'showcase': { title: 'Hamur Odası', module: 'Showcase' },
        'production': { title: 'Fermantasyon Takibi', module: 'Production' },
        'inventory': { title: 'Malzeme Yönetimi', module: 'Inventory' },
        'recipes': { title: 'Reçete Odası', module: 'Recipes' },
        'process': { title: 'Üretim Takibi', module: 'Process' }
    };

    async function init() {
        console.log('Hamur Odası başlatılıyor...');

        // Initialize DB
        await window.App.Storage.initDB();

        // Load Theme
        const savedTheme = await window.App.Storage.getSetting('theme');
        if (savedTheme) state.theme = savedTheme;
        applyTheme(state.theme);

        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Find closest anchor in case icon was clicked
                const targetEl = e.target.closest('.nav-item');
                const target = targetEl.dataset.target;
                navigateTo(target);
            });
        });

        if (elements.addRecipeBtn) {
            elements.addRecipeBtn.addEventListener('click', async () => {
                if (state.currentView !== 'recipes') {
                    await navigateTo('recipes');
                }
                if (window.App.Recipes && window.App.Recipes.openModal) {
                    window.App.Recipes.openModal();
                }
            });
        }

        elements.themeToggle.addEventListener('click', toggleTheme);

        // Initial Navigate
        await navigateTo(state.currentView);
    }

    async function navigateTo(viewName) {
        if (!routes[viewName]) return;

        state.currentView = viewName;

        elements.navItems.forEach(item => {
            if (item.dataset.target === viewName) item.classList.add('active');
            else item.classList.remove('active');
        });

        elements.pageTitle.textContent = routes[viewName].title;

        // Render View
        const moduleName = routes[viewName].module;
        if (window.App[moduleName]) {
            // Show loading or spinner here if needed
            elements.mainView.innerHTML = '<div class="empty-state"><ion-icon name="sync-outline" class="spin"></ion-icon><p>Yükleniyor...</p></div>';

            // Async Render
            const content = await window.App[moduleName].render();
            elements.mainView.innerHTML = content;

            if (window.App[moduleName].afterRender) {
                window.App[moduleName].afterRender();
            }
        } else {
            elements.mainView.innerHTML = `<div class="empty-state"><p>Modül yüklenemedi: ${moduleName}</p></div>`;
        }
    }

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        window.App.Storage.setSetting('theme', state.theme);
        applyTheme(state.theme);
    }

    function applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        const icon = elements.themeToggle.querySelector('ion-icon');
        if (icon) {
            icon.setAttribute('name', themeName === 'dark' ? 'sunny-outline' : 'moon-outline');
        }
    }

    // Export navigation so modules can use it
    window.App.navigateTo = navigateTo;

    // Start
    document.addEventListener('DOMContentLoaded', init);

})();
