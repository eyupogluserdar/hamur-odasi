/**
 * Storage Module - IndexedDB Implementation
 * Database: hamur_odasi_db
 * Version: 1
 */
(function () {
    const DB_NAME = 'hamur_odasi_db';
    const DB_VERSION = 1;

    const STORES = {
        RECIPES: 'recipes',
        INGREDIENTS: 'ingredients',
        FLOURS: 'flours',
        PRODUCTION: 'production_logs',
        NOTES: 'notes'
    };

    let db = null;

    // Helper: Promisify IDBRequest
    const promisifyRequest = (request) => {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    window.App.Storage = {
        STORES,

        async initDB() {
            if (db) return db;

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (e) => {
                    const database = e.target.result;
                    // Create object stores if not exists
                    Object.values(STORES).forEach(storeName => {
                        if (!database.objectStoreNames.contains(storeName)) {
                            database.createObjectStore(storeName, { keyPath: 'id' });
                        }
                    });
                };

                request.onsuccess = (e) => {
                    db = e.target.result;
                    console.log('IndexedDB Connected:', db.name);
                    resolve(db);
                };

                request.onerror = (e) => {
                    console.error('IndexedDB Error:', e.target.error);
                    reject(e.target.error);
                };
            });
        },

        // Generic CRUD Wrappers
        async addItem(storeName, data) {
            await this.initDB();
            if (!data.id) data.id = Date.now().toString(); // Ensure ID
            if (!data.createdAt) data.createdAt = new Date().toISOString();

            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.add(data));
        },

        async getAllItems(storeName) {
            await this.initDB();
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.getAll());
        },

        async getItemById(storeName, id) {
            await this.initDB();
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.get(id));
        },

        async updateItem(storeName, data) {
            await this.initDB();
            if (!data.id) throw new Error('Update requires data.id');

            // Fetch old item to preserve creation date
            const old = await this.getItemById(storeName, data.id);

            const merged = {
                ...(old || {}),
                ...data,
                createdAt: (old && old.createdAt) ? old.createdAt : (data.createdAt || new Date().toISOString()),
                updatedAt: new Date().toISOString()
            };

            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.put(merged));
        },

        async deleteItem(storeName, id) {
            await this.initDB();
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.delete(id));
        },

        async clearStore(storeName) {
            await this.initDB();
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            return promisifyRequest(store.clear());
        },

        // Backup & Restore
        async exportAllData() {
            await this.initDB();
            const exportData = {};
            const storeNames = Object.values(STORES);

            for (const name of storeNames) {
                exportData[name] = await this.getAllItems(name);
            }

            exportData.exportDate = new Date().toISOString();
            exportData.version = DB_VERSION;

            // Trigger Download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `hamur_odasi_backup_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        },

        async importBackupData(jsonData) {
            await this.initDB();

            try {
                // Clear and Restore
                const storeNames = Object.values(STORES);

                // 1. Clear all existing data first
                for (const name of storeNames) {
                    await this.clearStore(name);
                }

                // 2. Restore data
                for (const name of storeNames) {
                    if (jsonData[name] && Array.isArray(jsonData[name])) {
                        const tx = db.transaction(name, 'readwrite');
                        const store = tx.objectStore(name);

                        for (const item of jsonData[name]) {
                            // Ensure properties
                            if (!item.createdAt) item.createdAt = new Date().toISOString();
                            // Use put instead of add for safety, though we cleared store
                            store.put(item);
                        }

                        // Wait for transaction to complete
                        await new Promise((resolve, reject) => {
                            tx.oncomplete = resolve;
                            tx.onerror = () => reject(tx.error);
                        });
                    }
                }
                console.log('Backup restored successfully.');
                window.location.reload();
            } catch (err) {
                console.error("Backup import failed:", err);
                alert("Yedek yükleme sırasında hata oluştu: " + err.message);
            }
        },

        // Legacy compatibility for simple Key-Value store (Settings etc.)
        // Using a wrapper around 'notes' or a separate store if needed.
        // For simplicity, let's keep Settings in localStorage OR use a generic store.
        // Task didn't specify Settings store, only Recipes/Ing/Flour/Logs/Notes.
        // I will map generic settings to `notes` or let them stay in LocalStorage as they are minor config.
        // BUT user said "LocalStorage hiç kullanılmayacak".
        // So I'll add a simple KV way using 'notes' store where id='settings_theme' etc.

        async getSetting(key) {
            const item = await this.getItemById(STORES.NOTES, 'setting_' + key);
            return item ? item.value : null;
        },

        async setSetting(key, value) {
            return this.updateItem(STORES.NOTES, { id: 'setting_' + key, value: value });
        }
    };
})();
