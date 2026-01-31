
(function () {
    // Audio Context Singleton (Lazy Loaded)
    let audioCtx = null;
    let alarmInterval = null;
    let timerInterval = null;
    let soundPlayed = false;

    function getAudioContext() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext; // Safari compat
            if (Ctx) audioCtx = new Ctx();
        }
        return audioCtx;
    }

    function playAlert() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            // Important: Resume context if suspended (browser autoplay policy)
            if (ctx.state === 'suspended') {
                ctx.resume().catch(e => console.warn("Audio resume failed:", e));
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    function startAlarm() {
        if (alarmInterval) return;
        playAlert();
        // Alarm Loop
        alarmInterval = setInterval(playAlert, 2000);
    }

    function stopAlarm() {
        if (alarmInterval) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }
    }

    window.App.Process = {
        async render() {
            const activeProcess = JSON.parse(localStorage.getItem('active_process'));

            if (!activeProcess) {
                stopAlarm();
                return `
                    <div class="empty-state">
                        <ion-icon name="timer-outline"></ion-icon>
                        <p>Aktif bir üretim yok.</p>
                        <button class="btn btn-primary" onclick="window.App.navigateTo('recipes')">Reçete Seç</button>
                    </div>
                `;
            }

            const currentStep = activeProcess.steps[activeProcess.currentStepIndex];
            const isDone = activeProcess.status === 'done';

            // Calculate remaining time for UI
            let remainingSec = 0;
            if (currentStep) {
                if (currentStep.status === 'active' && currentStep.startedAt) {
                    const elapsed = Math.floor((Date.now() - currentStep.startedAt) / 1000);
                    remainingSec = Math.max(0, (currentStep.durationMin * 60) - elapsed);
                } else if (currentStep.status === 'paused') {
                    remainingSec = currentStep.remainingWhenPaused || (currentStep.durationMin * 60);
                } else {
                    remainingSec = currentStep.durationMin * 60;
                }
            }

            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

            return `
                <div class="section-header" style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="font-size: 1.2rem; color: var(--color-text-secondary);">Üretim Takibi</h2>
                        <h1 style="color: var(--color-primary);">${activeProcess.recipeName}</h1>
                    </div>
                    <button class="btn" onclick="window.App.Process.resetAction()" style="width:auto; background:rgba(255,255,255,0.1);">
                        <ion-icon name="refresh-outline"></ion-icon> İptal
                    </button>
                </div>

                ${isDone ? `
                    <div style="text-align: center; padding: 40px; background: rgba(0,255,0,0.1); border-radius: 12px; border: 1px solid var(--color-secondary);">
                        <ion-icon name="checkmark-done-circle" style="font-size: 64px; color: var(--color-secondary);"></ion-icon>
                        <h2 style="margin-top:20px;">Adımlar Tamamlandı!</h2>
                        <p style="color:#aaa; margin-bottom:20px;">Hamurunuz hazırlandı. Stoğa almak için aşağıdan onaylayın.</p>
                        <button class="btn btn-primary" onclick="window.App.Process.finishProduction()" style="width: auto; padding: 12px 30px; font-size:1.1rem;">
                            <ion-icon name="save-outline" style="margin-right:8px;"></ion-icon> Hazırlananlara Ekle
                        </button>
                    </div>
                ` : `
                    <!-- Active Step Card -->
                    <div class="card" style="text-align: center; padding: 30px 20px; margin-bottom: 20px; border: 1px solid var(--color-primary);">
                        <span class="badge" style="background: rgba(255,255,255,0.1); font-size: 0.9rem; margin-bottom: 10px; display:inline-block;">
                            ${currentStep.type === 'knead' ? 'Yoğurma' : (currentStep.type === 'rest' ? 'Dinlendirme' : 'İşlem')}
                        </span>
                        <h2 style="font-size: 2rem; margin-bottom: 10px;">${currentStep.title}</h2>
                        
                        <div id="timer-display" style="font-size: 4rem; font-weight: bold; font-family: monospace; color: ${currentStep.status === 'active' ? '#fff' : '#888'};">
                            ${timeStr}
                        </div>

                        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                            ${currentStep.status !== 'active' ? `
                                <button class="btn btn-primary" onclick="window.App.Process.updateStep('start')" style="width: auto; padding: 12px 30px;">
                                    <ion-icon name="play" style="font-size: 1.5rem;"></ion-icon> Başlat
                                </button>
                            ` : `
                                <button class="btn" onclick="window.App.Process.updateStep('pause')" style="width: auto; padding: 12px 30px; background: #e67e22;">
                                    <ion-icon name="pause" style="font-size: 1.5rem;"></ion-icon> Duraklat
                                </button>
                            `}
                            
                           ${remainingSec <= 0 ? `
                                <button class="btn btn-success" id="btn-done-step" onclick="window.App.Process.updateStep('done')" style="width: auto; padding: 12px 30px; background: var(--color-success); color: #fff; box-shadow: 0 0 15px rgba(46, 204, 113, 0.5);">
                                    <ion-icon name="checkmark-done-circle" style="font-size: 1.5rem;"></ion-icon> Tamamla
                                </button>
                            ` : `
                                <button class="btn" id="btn-done-step" onclick="window.App.Process.updateStep('done')" style="width: auto; padding: 12px 30px; background: rgba(255,255,255,0.1);">
                                    <ion-icon name="checkmark" style="font-size: 1.5rem;"></ion-icon> Bitti
                                </button>
                            `}
                        </div>
                    </div>

                    <!-- Steps List -->
                    <div style="display: flex; flex-direction: column; gap: 10px; opacity: 0.8;">
                        ${activeProcess.steps.map((step, idx) => {
                let icon = 'ellipse-outline';
                let color = '#666';
                if (idx < activeProcess.currentStepIndex) { icon = 'checkmark-circle'; color = 'var(--color-secondary)'; }
                else if (idx === activeProcess.currentStepIndex) { icon = 'play-circle'; color = 'var(--color-primary)'; }

                return `
                                <div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; ${idx === activeProcess.currentStepIndex ? 'border-left: 3px solid var(--color-primary); background: rgba(255,255,255,0.08);' : ''}">
                                    <ion-icon name="${icon}" style="font-size: 1.2rem; color: ${color};"></ion-icon>
                                    <div style="flex:1;">
                                        <div style="font-weight: bold; ${idx === activeProcess.currentStepIndex ? 'color:white;' : 'color:#aaa;'}">${step.title}</div>
                                        <div style="font-size: 0.8rem; color: #666;">${step.durationMin} dk • ${step.type === 'knead' ? 'Yoğur' : (step.type === 'rest' ? 'Dinlendir' : step.type)}</div>
                                    </div>
                                    ${step.status === 'done' ? '<span class="badge badge-success" style="font-size:0.7rem;">Tamamlandı</span>' : ''}
                                </div>
                            `;
            }).join('')}
                    </div>
                `}
            `;
        },

        afterRender() {
            const activeProcess = JSON.parse(localStorage.getItem('active_process'));

            if (!activeProcess) return;

            // Handlers are now inline for robustness

            // Timer Logic

            // Timer Logic
            if (timerInterval) clearInterval(timerInterval);

            const currentStep = activeProcess.steps[activeProcess.currentStepIndex];
            if (currentStep && currentStep.status === 'active') {
                // Determine initial sound state (don't play if loaded already done)
                const initialElapsed = Math.floor((Date.now() - currentStep.startedAt) / 1000);
                const initialRemaining = Math.max(0, (currentStep.durationMin * 60) - initialElapsed);
                if (initialRemaining <= 0) soundPlayed = true;
                else soundPlayed = false;

                timerInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - currentStep.startedAt) / 1000);
                    const remaining = Math.max(0, (currentStep.durationMin * 60) - elapsed);

                    const min = Math.floor(remaining / 60);
                    const sec = remaining % 60;

                    const display = document.getElementById('timer-display');
                    if (display) display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

                    // Update Done Button State
                    const btnDone = document.getElementById('btn-done-step');
                    if (remaining <= 0) {
                        if (display) display.style.color = 'var(--color-success)';

                        // Play Sound LOOP
                        if (!soundPlayed) {
                            startAlarm();
                            soundPlayed = true;
                        }

                        // Make Done button green and obvious (Only update if not already updated)
                        if (btnDone && !btnDone.classList.contains('btn-success')) {
                            btnDone.className = "btn btn-success";
                            btnDone.style.background = "var(--color-success)";
                            btnDone.style.color = "#fff";
                            btnDone.style.boxShadow = "0 0 15px rgba(46, 204, 113, 0.5)";
                            btnDone.innerHTML = '<ion-icon name="checkmark-done-circle" style="font-size: 1.5rem;"></ion-icon> Tamamla';
                        }
                    } else {
                        // Reset if needed (though usually we go down only)
                        if (display) display.style.color = '#fff';
                    }
                }, 1000);
            }
        },

        async finishProduction() {
            const activeProcess = JSON.parse(localStorage.getItem('active_process'));
            if (!activeProcess) return;

            // Fetch Recipe
            const recipe = await window.App.Storage.getItemById('recipes', activeProcess.recipeId);
            if (!recipe) {
                await window.App.showAlert('Hata', 'Orijinal reçete bulunamadı.');
                return;
            }

            // Create Snapshot
            const allIngredients = await window.App.Storage.getAllItems('ingredients');
            let flourName = 'Un';

            if (recipe.flours && recipe.flours.length > 0) {
                const names = recipe.flours.map(f => {
                    const item = allIngredients.find(i => i.id === f.id);
                    return item ? item.name : '??';
                });
                flourName = names.join(' + ');
            } else if (recipe.flourId) {
                const item = allIngredients.find(i => i.id === recipe.flourId);
                flourName = item ? item.name : 'Un';
            }

            const snapshot = {
                recipeId: recipe.id,
                recipeName: recipe.name,
                flourName: flourName,
                flourAmount: recipe.flourAmount,
                waterAmount: recipe.waterAmount,
                hydration: recipe.hydration,
                totalWeight: recipe.totalWeight,
                ballWeight: recipe.ballWeight,
                yieldCount: Math.floor((recipe.totalWeight || 0) / (recipe.ballWeight || 250)),
                ingredients: recipe.ingredients // Snapshot ingredients for dynamic calculation
            };

            const newBatch = {
                id: Date.now().toString(),
                recipeId: recipe.id,
                recipeName: recipe.name,
                snapshot: snapshot,
                startTime: activeProcess.startedAt || Date.now(),
                fridgeStartTime: null,
                finalRoomStartTime: null,
                status: 'room',
                history: []
            };

            await window.App.Storage.addItem('production_logs', newBatch);
            localStorage.removeItem('active_process');

            // Re-render (will fallback to list)
            const html = await this.render();
            document.getElementById('main-view').innerHTML = html;
            this.afterRender();
        },

        updateStep(action) {
            stopAlarm(); // Stop any ringing alarm
            const process = JSON.parse(localStorage.getItem('active_process'));
            const step = process.steps[process.currentStepIndex];

            if (action === 'start') {
                step.status = 'active';
                // If resuming, adjust start time so elapsed matches previous run.
                if (step.remainingWhenPaused) {
                    step.startedAt = Date.now() - ((step.durationMin * 60) - step.remainingWhenPaused) * 1000;
                    delete step.remainingWhenPaused;
                } else {
                    step.startedAt = Date.now();
                }

                // Unlock Audio Context on user gesture
                const ctx = getAudioContext();
                if (ctx && ctx.state === 'suspended') {
                    ctx.resume();
                }
            } else if (action === 'pause') {
                step.status = 'paused';
                const elapsed = Math.floor((Date.now() - step.startedAt) / 1000);
                step.remainingWhenPaused = Math.max(0, (step.durationMin * 60) - elapsed);
                step.startedAt = null;
            } else if (action === 'done') {
                step.status = 'done';
                step.startedAt = null;
                process.currentStepIndex++;
                if (process.currentStepIndex >= process.steps.length) {
                    process.status = 'done';
                }
            }

            localStorage.setItem('active_process', JSON.stringify(process));

            // Re-render
            this.render().then(html => {
                document.getElementById('main-view').innerHTML = html;
                this.afterRender();
            });
        },
        async resetAction() {
            if (await window.App.showConfirm('İptal', 'Üretim süreci iptal edilecek. Emin misin?')) {
                stopAlarm();
                localStorage.removeItem('active_process');
                this.render().then(html => {
                    document.getElementById('main-view').innerHTML = html;
                    this.afterRender();
                });
            }
        }
    };
})();
