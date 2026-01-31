const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'recipes.js');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Target Range to Delete: Lines 660 to 722 (1-based)
// Index 659 to 721 (0-based)
// Count: 722 - 660 + 1 = 63 lines.

console.log('Removing lines 660-722...');
// Verify start and end roughly (optional but good practice)
console.log('Line 660:', lines[659]); // Should be });
console.log('Line 722:', lines[721]); // Should be }

lines.splice(659, 63);

// The Loop End (});) was at line 735 (Index 734) in the OLD file.
// After removing 63 lines, everything shifts up.
// New Index for Loop End = 734 - 63 = 671.
// Let's verify line 671 (was 735).
// Wait. 735 - 660 = 75 lines AFTER the start of deletion.
// Since we deleted from 660...
// The lines 723-735 (which we KEPT) are now shifted.
// They were at 723. Now at 660.
// So the loop end `});` (was 735) is now at Index 735 - 63 - 1? No.
// Old 723 is now 660.
// Old 735 is now 672. (735 - 63 = 672? 735-722 = 13 lines. 660+13 = 673?)
// Let's count. We kept lines 723 to 735 (13 lines).
// New position: 660 to 672.
// So Index 672 should be the `});` (Loop close).

console.log('New Line 673 (Index 672):', lines[672]);

// We want to insert AFTER the loop close.
// So insert at Index 673.

const logic = `
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
            
            // UI Visibility & Calculation
            const beginnerControls = document.getElementById('beginner-controls');
            const frictionGroup = document.getElementById('friction-group');

            if (mode === 'beginner') {
                if(beginnerControls) beginnerControls.style.display = 'block';
                if(frictionGroup) frictionGroup.style.display = 'none'; // Hide friction in beginner
                
                if(targetDoughTempInput) {
                    targetDoughTempInput.readOnly = true;
                    targetDoughTempInput.style.color = '#888';
                }
                if(autoBadge) autoBadge.style.display = 'inline-block';
                
                // Auto-Calc Target Temp
                const time = parseInt(targetTimeSlider?.value || 4);
                if(targetTimeVal) targetTimeVal.textContent = time + ' Saat';
                 
                // engine might be undefined during pure strict mode? No, window.App.Engine
                const idealTarget = window.App.Engine ? window.App.Engine.calculateTargetDoughTemp(time) : 24;
                if(targetDoughTempInput) targetDoughTempInput.value = idealTarget; // Auto-set
                
                // Auto-Calc Water Temp (Friction=5 default for Beginner)
                const wTemp = window.App.Engine ? window.App.Engine.calculateWaterTemp(idealTarget, roomT, flourT, 5) : 0;
                if(waterTempInput) {
                    waterTempInput.value = wTemp;
                    waterTempInput.style.color = wTemp > 50 ? 'red' : (wTemp < 4 ? 'blue' : 'var(--color-primary)');
                }

            } else {
                // Master Mode
                if(beginnerControls) beginnerControls.style.display = 'none';
                if(frictionGroup) frictionGroup.style.display = 'block';
                
                if(targetDoughTempInput) {
                    targetDoughTempInput.readOnly = false;
                    targetDoughTempInput.style.color = 'var(--color-primary)';
                }
                if(autoBadge) autoBadge.style.display = 'none';
                
                // Manual Calc
                const manTarget = parseFloat(targetDoughTempInput?.value) || 24;
                const manFriction = parseFloat(frictionInput?.value) || 5;
                const wTemp = window.App.Engine ? window.App.Engine.calculateWaterTemp(manTarget, roomT, flourT, manFriction) : 0;
                if(waterTempInput) {
                    waterTempInput.value = wTemp;
                    waterTempInput.style.color = wTemp > 50 ? 'red' : 'var(--color-primary)';
                }
            }
`;

lines.splice(673, 0, logic);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed recipes.js');
