
/**
 * Scientific Dough Engine
 * Based on 'scientific_dough_model.md'
 * 
 * CORE CONSTANTS (Bio-Chemical Baseline)
 * --------------------------------------
 * Ref Temp: 24°C
 * Ref Hydration: 60%
 * Ref Yeast (Dry): 0.5% (to Flour Weight)
 * Ref Salt: 2.0%
 * 
 * BASELINE PERFORMANCE
 * --------------------
 * Time to Peak (2x Volume): ~240 Minutes (4 Hours)
 */

(function () {
    window.App.Engine = {

        // --- 1. CONVERSION LOGIC (Normalization) ---

        /**
         * Converts any yeast type/amount to 'Instand Dry Yeast' percentage relative to flour.
         * @param {number} amount - Grams of yeast
         * @param {string} type - 'instant', 'active_dry', 'fresh'
         * @param {number} totalFlour - Total flour weight in grams
         * @returns {number} - Effective Dry Yeast Percentage (e.g., 0.5 for 0.5%)
         */
        getEffectiveYeastPercent(amount, type, totalFlour) {
            if (totalFlour <= 0) return 0;

            let equivalentDry = 0;

            // Conversion Factors (Relative to Instant Dry)
            // Fresh (Yaş) = 1/3 strength of Dry -> Need 3g Fresh to equal 1g Dry
            // Active Dry = ~1.2x needed compared to Instant (Roughly), but often treated 1:1 in home settings. 
            // We will use: Instant=1.0, Active=1.1, Fresh=3.0 (So dividing by 3 gives dry eq)

            if (type === 'fresh') {
                equivalentDry = amount / 3.0; // Pakmaya rule: 100g Fresh ~ 33g Dry
            } else if (type === 'active_dry') {
                equivalentDry = amount / 1.1; // Slightly weaker than instant
            } else {
                equivalentDry = amount; // Instant is baseline
            }

            return (equivalentDry / totalFlour) * 100;
        },

        // --- 2. KINETIC CALCULATORS (The Physics) ---

        /**
         * Calculates the Temperature Factor (Q10 Rule adjusted for Dough)
         * Higher Factor = Faster Fermentation
         */
        getTempFactor(celsius) {
            // Baseline: 24°C = 1.0
            // Q10 Rule: Rate doubles every 10°C
            // Formula: Rate = Baseline * 2^((T - 24) / 10)

            // Safety Clamps
            if (celsius < 4) return 0.1; // Fridge (Sleeping)
            if (celsius > 40) return 3.0; // Too hot, yeast dying/stressing

            return Math.pow(2, (celsius - 24) / 10);
        },

        /**
         * Calculates Hydration Factor (Enzyme Mobility)
         * Wetter dough = Faster fermentation
         */
        getHydrationFactor(hydrationPercent) {
            // Baseline: 60% = 1.0
            // Simple Linear Approx: Every 10% water adds ~15% speed
            const diff = hydrationPercent - 60;
            const factor = 1.0 + (diff * 0.015);
            return Math.max(0.5, factor); // Minimum speed constraint
        },

        /**
         * Calculates Salt Factor (Brake pedal)
         * Salt retards yeast.
         */
        getSaltFactor(saltPercent) {
            // Baseline: 2% = 1.0
            // 0% Salt = ~1.2x Speed (Faster)
            // 3% Salt = ~0.9x Speed (Slower)
            // Linear approx around 2%
            // Salt % usually 0-3%
            const diff = saltPercent - 2.0;
            // +1% Salt = -10% Speed roughly
            return 1.0 - (diff * 0.1);
        },

        // --- 3. MAIN SIMULATION ---

        /**
         * Predicts dough behavior based on ingredients and environment.
         * @param {Object} params
         * @param {number} params.totalFlour - grams
         * @param {number} params.wValue - Average W value of flour mix
         * @param {number} params.yeastAmount - grams
         * @param {string} params.yeastType - 'instant', 'fresh', etc.
         * @param {number} params.saltAmount - grams
         * @param {number} params.sugarAmount - grams (optional)
         * @param {number} params.fatAmount - grams (oil/butter) (optional)
         * @param {number} params.waterAmount - grams (total liquid eq)
         * @param {number} params.roomTemp - Celsius
         */
        simulate(params) {
            const BASELINE_TIME_MIN = 240; // 4 Hours for Reference
            const REF_YEAST_PCT = 0.5; // 0.5% Instant Yeast

            // 1. Calculate Ratios
            const yeastPct = this.getEffectiveYeastPercent(params.yeastAmount, params.yeastType, params.totalFlour);
            const hydrationPct = (params.waterAmount / params.totalFlour) * 100;
            const saltPct = (params.saltAmount / params.totalFlour) * 100;

            // 2. Yeast Factor
            // Rate is proportional to yeast amount (up to a saturation point ~3-4%)
            // Factor = New% / Ref%
            let yeastFactor = (yeastPct > 0) ? (yeastPct / REF_YEAST_PCT) : 0;
            // Diminishing returns above 3% dry eq
            if (yeastPct > 3.0) yeastFactor *= 0.8;

            // 3. Environmental Factors
            const tempFactor = this.getTempFactor(params.roomTemp);
            const hydroFactor = this.getHydrationFactor(hydrationPct);
            const saltFactor = this.getSaltFactor(saltPct);

            // 4. Combined Speed Multiplier
            // Total Speed = YeastForce * TempBoost * HydroBoost * SaltBrake
            const totalSpeed = yeastFactor * tempFactor * hydroFactor * saltFactor;

            // 5. Predict Time
            // Time = Baseline / Speed
            // If speed is 2x, time is 0.5x
            const predictedMin = (totalSpeed > 0) ? (BASELINE_TIME_MIN / totalSpeed) : 9999;

            // 6. Tolerance (Shelf Life) Analysis
            // Base Tolerance at W200, 24°C = ~2-3 hours AFTER peak
            // Tolerance scales linearly with W, but inversely with Temperature (Hot dough rots faster)
            const wVal = params.wValue || 200; // Default W 200
            const toleranceBaseHours = (wVal / 200) * 3; // W200->3h, W400->6h raw tolerance at 24C
            // Adjust for Temp: Hotter = Less Tolerance
            const tempDecay = this.getTempFactor(params.roomTemp); // Same curve acts as decay
            const toleranceHours = toleranceBaseHours / tempDecay;

            return {
                timeToPeak: Math.round(predictedMin), // Minutes
                toleranceWindow: parseFloat(toleranceHours.toFixed(1)), // Hours
                factors: {
                    yeast: parseFloat(yeastFactor.toFixed(2)),
                    temp: parseFloat(tempFactor.toFixed(2)),
                    hydration: parseFloat(hydroFactor.toFixed(2))
                },
                analysis: this.getAdvisoryAnalysis(predictedMin, wVal, yeastPct)
            };
        },

        // --- 4. ADVISOR (The Chef's Voice) ---

        getAdvisoryAnalysis(minutes, wVal, yeastPct) {
            let messages = [];

            // Time Analysis
            if (minutes < 60) {
                messages.push({ type: 'warning', text: "Çok Hızlı Fermantasyon! Hamur lezzet geliştiremeden şişecek. (Tavsiye: Mayayı azaltın veya ortamı soğutun)." });
            } else if (minutes > 600) {
                messages.push({ type: 'warning', text: "Çok Yavaş. Hamur kuruyabilir veya enzimler gluteni parçalayabilir. (Tavsiye: Mayayı artırın)." });
            } else {
                messages.push({ type: 'success', text: "İdeal Fermantasyon Hızı. Aroma gelişimi için uygun." });
            }

            // Strength Analysis
            if (wVal < 180 && minutes > 240) {
                messages.push({ type: 'danger', text: "Ununuz zayıf (Düşük W). Bu kadar uzun mayalanmaya dayanamayıp çökebilir." });
            } else if (wVal > 300 && minutes < 120) {
                messages.push({ type: 'info', text: "Çok güçlü un (Yüksek W) kullanıyorsunuz ama süre kısa. Hamur çok sert/lastik gibi olabilir." });
            }

            return messages;
        }
    };
})();
