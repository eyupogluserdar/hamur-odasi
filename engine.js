
/**
 *   Base on 'scientific_dough_model.md'
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

        // --- 0. PRODUCT SUGGESTION ENGINE (Rule Based) ---
        getSuggestedProducts(hyd, fatRatio, milkRatio) {
            let products = [];

            // STRICT RICHNESS THRESHOLD (Per User Request)
            // Only show rich products if Milk >= 20% OR Fat >= 8%
            const isRichProductClass = (milkRatio >= 20 || fatRatio >= 8);

            // 1. Rich Doughs (Priority 1)
            if (isRichProductClass) {
                // Determine subtypes of rich dough
                if (fatRatio >= 20 || milkRatio >= 30) {
                    products.push("Brioche (Fransız)");
                    products.push("Paskalya Çöreği");
                    products.push("Panettone");
                } else {
                    products.push("Yumuşak Poğaça");
                    products.push("Sütlü Ekmek");
                    products.push("Hamburger Ekmeği");
                    products.push("Yumuşak Sandviç");
                    products.push("Viyana Ekmekçiliği");
                }
                return products.join(" / ");
            }

            // 2. Lean / Standard Doughs (Hydration Based)
            // IMPORTANT: No rich names in this block.

            if (hyd < 55) {
                products.push("Mantı / Makarna Hamuru");
                products.push("Sert Grisini");
                products.push("Lavaş (Sıkı)");
            } else if (hyd < 60) {
                products.push("Simit");
                products.push("Bagel");
                products.push("Sert Pide / Lahmacun");
                products.push("Pretzel");
            } else if (hyd < 68) {
                products.push("Standart Ekmek");
                products.push("Pizza (Napoli/Klasik)");
                products.push("Pide (Yumuşak)");
                products.push("Bazlama");
            } else if (hyd < 75) {
                products.push("Artisan Ekmek");
                products.push("Focaccia (Düşük Su)");
                products.push("Ciabatta (Klasik)");
                products.push("Rustik Baget");
            } else {
                // High Hydration (>= 75%)
                // STRICTLY ARTISAN ONLY - NO POĞAÇA/SOFT BREAD
                products.push("Ciabatta (Yüksek Su)");
                products.push("Focaccia (Geleneksel)");
                products.push("Tava Ekmeği (Pan de Cristal)");
                products.push("Ekşi Mayalı Köy Ekmeği");
                products.push("Pizza (Taglio/Roma)");
            }

            return products.join(" / ");
        },

        // --- 0. TEXT ENGINE (Dynamic Description) ---
        /**
         * Generates dynamic text based on multiple parameters.
         * GOLDEN RULE: Never rely on a single parameter.
         */
        describeDough(params, analysis) {
            const hyd = (params.effectiveHydration !== undefined) ? params.effectiveHydration :
                ((params.waterAmount / params.totalFlour) * 100);

            const fat = params.fatRatio || 0;
            const milk = params.milkRatio || 0;
            const speed = analysis.speed || 1.0;

            const isRich = (fat >= 3 || milk >= 5);
            const isVeryRich = (fat > 8 || milk > 20);

            // USER RULE: Strict rich dough threshold for Fermentation Text (Step 383)
            const isHeavyRich = (milk >= 20 || fat >= 8);

            // 1. CRUMB (İç Doku) - Hydration + Richness
            let crumb = "";

            // GOLDEN RULE OVERRIDE (For Crumb/Hydration) - Kept logic but updated text
            if (isHeavyRich) {
                // Ignore hydration semantics completely for these doughs
                crumb = "Pamuksu / lifli iç doku. Yağ ve süt yedirilerek geliştirilen, sıkı ama yumuşak yapı. (Yoğun zengin içerik)";
            } else {
                // Standard Logic (Behavioral Only - No Product Names)
                if (hyd < 60) {
                    crumb = "Sıkı / Kapalı";
                } else if (hyd < 70) {
                    crumb = "Orta Gözenekli";
                } else if (hyd < 75) {
                    // 70-75% Range
                    crumb = "Yüksek sıvı oranı. Katlama gerektirir, akışkan yapı kontrol ister.";
                } else {
                    // 75%+ Range
                    crumb = "Çok yüksek sıvı oranı. Yoğurma yerine katlama ve yüzey gerilimiyle yapı kazanır.";
                }
            }

            // 2. CRUST (Kabuk) - Fat + Hydration
            let crust = "";

            if (isHeavyRich) {
                crust = "Yumuşak & İnce / Karamelize (Zengin)";
            } else {
                if (fat >= 4) {
                    crust = "İnce Çıtır – Yumuşak Geçişli";
                } else if (hyd >= 70) {
                    crust = "Çıtır / Elastik";
                } else {
                    crust = "Gevrek / Sert";
                }
                if (isVeryRich && !isHeavyRich) crust = "Yumuşak & İnce / Karamelize";
            }

            // 3. FERMENTATION (Step 546: Yeast + Temp Priority)
            let ferment = "Dengeli / Kontrollü"; // Default

            // Calculate pseudo yeast percent for Rule Check
            const yPct = (params.yeastAmount / params.totalFlour) * 100;
            const rTemp = params.roomTemp || 24;

            // RULE 0: Zero Yeast Protection (Step 573)
            // Locks fermentation to Passive if yeast is negligible.
            if (yPct <= 0.1) {
                ferment = "Çok Yavaş / Pasif (Gaz üretimi sınırlı)";
            }
            // RULE 1: Low Temp Override (Absolute Floor)
            else if (rTemp <= 16) {
                ferment = "Yavaş / Kontrollü (Soğuk Ortam)";
            }
            // RULE 2: Fast Condition (Primary Factor)
            // Yeast >= 0.5% AND Temp >= 18C -> Fast
            else if (yPct >= 0.5 && rTemp >= 18) {
                ferment = "Hızlı / Aktif";
            }
            // Default remains "Dengeli / Kontrollü"

            // RULE 3 & 4: Richness/Hydration
            // "Hız etiket değişmez, sadece açıklama metninde belirtilir."
            // We do NOT downgrade "Fast" based on milk/fat/water anymore.

            // Heavy Rich Note (Appended if relevant, but not changing the main label if it's Fast)
            if (isHeavyRich && ferment !== "Yavaş / Kontrollü (Soğuk Ortam)") {
                // If it IS Fast or Balanced, we keep it. Heavy Rich doesn't force "Slow" label anymore,
                // but the Advisor logic (lines 383+) covers the warning.
            }

            // 4. TYPE (Karakter) - Combined Check
            let type = "";

            if (isHeavyRich) {
                type = "ZENGİN HAMUR / BRIOCHE SINIFI (Yoğurma Gerektirir)";
            } else {
                if (isVeryRich) {
                    type = "BRIOCHE / ZENGİN HAMUR";
                } else if (hyd >= 70 && !isRich) {
                    type = "ARTİSAN / RUSTİK";
                } else if (hyd < 62 && fat >= 3) {
                    type = "PIZZA / SOFT DOUGH";
                } else if (hyd < 55) {
                    type = "SERT HAMUR (MANTI/MAKARNA)";
                } else {
                    type = "DENGELİ HAMUR";
                }
            }

            return { crumb, crust, fermentation: ferment, type };
        },

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
         * Calculates Target Dough Temperature based on Target Fermentation Time.
         * (Reverse Engineering: Slower fermentation needs colder dough)
         * @param {number} hours - Target Time (2, 4, 8, 12, 24)
         * @returns {number} Ideal Target Temp (Celsius)
         */
        calculateTargetDoughTemp(hours) {
            // Rule Table (User Provided)
            if (hours <= 2) return 27.5; // 27-28
            if (hours <= 4) return 24.5; // 24-25
            if (hours <= 8) return 22.5; // 22-23
            if (hours <= 12) return 20.5; // 20-21
            // 24h+
            return 18.5; // 18-19
        },

        /**
         * Calculates Required Water Temperature.
         * Formula: Water°C = (Target°C * 3) - (Room°C + Flour°C + Friction°C)
         */
        calculateWaterTemp(targetTemp, roomTemp, flourTemp, frictionInput) {
            // Default Friction: 4 (Normal) if undefined
            const friction = (frictionInput !== undefined) ? frictionInput : 4;
            // Default Flour Temp: Room Temp if undefined
            const flourT = (flourTemp !== undefined) ? flourTemp : roomTemp;

            // Formula
            let waterT = (targetTemp * 3) - (roomTemp + flourT + friction);

            // Safety Clamps? No, return raw value, UI handles warnings.
            return parseFloat(waterT.toFixed(1));
        },

        /**
         * Auto-corrects yeast amount for target time.
         * Returns suggested yeast % or null if current is acceptable.
         */
        validateYeastForTime(currentYeastPct, hours) {
            let idealMin, idealMax;

            // Standard Reference Table (Artisan/Commercial)
            if (hours <= 2) { idealMin = 1.2; idealMax = 2.5; }
            else if (hours <= 4) { idealMin = 0.6; idealMax = 1.2; }
            else if (hours <= 8) { idealMin = 0.3; idealMax = 0.6; }
            else if (hours <= 12) { idealMin = 0.15; idealMax = 0.3; }
            else { idealMin = 0.05; idealMax = 0.15; } // 24h

            if (currentYeastPct < idealMin) return idealMin;
            if (currentYeastPct > idealMax) return idealMax;

            return null; // Acceptable
        },

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
         *   @param {number} params.waterAmount - grams (simple water)
         *   @param {number} params.effectiveWaterAmount - grams (total effective water)
         *   @param {number} params.milkRatio - percentage (0-100)
         *   @param {number} params.fatRatio - percentage (0-100)
         *   @param {number} params.roomTemp - Celsius
         */
        /**
         * Calculates the fermentation speed multiplier (Rate)
         * - 1.0 = Baseline Speed (at 24C, 60% Hydration, 2% Salt, Ref Yeast)
         * - Returns float (e.g. 0.15 for Fridge, 1.5 fast)
         */
        calculateFermentationSpeed(params) {
            const REF_YEAST_PCT = 0.333; // 1% Fresh Yeast Baseline

            // 1. Calculate Ratios
            const yeastPct = this.getEffectiveYeastPercent(params.yeastAmount, params.yeastType, params.totalFlour);
            // USE EFFECTIVE HYDRATION
            const effWater = params.effectiveWaterAmount !== undefined ? params.effectiveWaterAmount : params.waterAmount;
            const hydrationPct = (effWater / params.totalFlour) * 100;
            const saltPct = (params.saltAmount / params.totalFlour) * 100;

            // 2. Yeast Factor
            let yeastFactor = (yeastPct > 0) ? (yeastPct / REF_YEAST_PCT) : 0;
            if (yeastPct > 3.0) yeastFactor *= 0.8;

            // 3. Environmental Factors
            const tempFactor = this.getTempFactor(params.roomTemp); // Uses params.roomTemp
            const hydroFactor = this.getHydrationFactor(hydrationPct);
            const saltFactor = this.getSaltFactor(saltPct);

            // 4. Combined Speed
            let totalSpeed = yeastFactor * tempFactor * hydroFactor * saltFactor;

            // 5. Rich Dough Correction (Engine Level)
            if (params.milkRatio > 5) totalSpeed *= 0.8;
            if (params.fatRatio > 3) totalSpeed *= 0.85;

            // 6. Very Rich Dough Correction (Brioche Class) - Extra Clamp
            if (params.milkRatio > 20 || params.fatRatio > 8) {
                totalSpeed *= 0.9;
            }

            return totalSpeed;
        },

        simulate(params) {
            const BASELINE_TIME_MIN = 180; // 3 Hours

            const totalSpeed = this.calculateFermentationSpeed(params);

            // Predict Time
            const predictedMin = (totalSpeed > 0) ? (BASELINE_TIME_MIN / totalSpeed) : 9999;

            // Tolerance Analysis
            const wVal = params.wValue || 200;
            // Base tolerance (Old Logic)
            const toleranceBaseHours = (wVal / 200) * 3;
            const tempDecay = this.getTempFactor(params.roomTemp);
            let toleranceHours = toleranceBaseHours / tempDecay;

            // Rich Dough Check
            const isRich = (params.fatRatio > 3 || params.milkRatio > 5);

            // Calculated Tolerance (Peak-Based for Rich/Weak)
            if (isRich && wVal <= 220) {
                // Peak Time based tolerance
                toleranceHours = (predictedMin / 60) * 1.4;
            }

            // Re-calculate yeastPct for returning stats
            const yeastPct = this.getEffectiveYeastPercent(params.yeastAmount, params.yeastType, params.totalFlour);

            // Re-calculate Hydration for Text Engine
            const effWater = params.effectiveWaterAmount !== undefined ? params.effectiveWaterAmount : params.waterAmount;
            const hydrationPct = (effWater / params.totalFlour) * 100;

            return {
                timeToPeak: Math.round(predictedMin), // Minutes
                toleranceWindow: parseFloat(toleranceHours.toFixed(1)), // Hours
                isRich: isRich, // Output for UI
                factors: {
                    speed: parseFloat(totalSpeed.toFixed(2))
                },
                // Call Text Engine
                description: this.describeDough(
                    {
                        effectiveHydration: hydrationPct,
                        totalFlour: params.totalFlour,
                        waterAmount: params.waterAmount,
                        fatRatio: params.fatRatio,
                        milkRatio: params.milkRatio,
                        yeastAmount: params.yeastAmount, // Fixed: Passing yeast info
                        roomTemp: params.roomTemp // Fixed: Passing temp info
                    },
                    { speed: totalSpeed }
                ),
                analysis: this.getAdvisoryAnalysis(predictedMin, wVal, yeastPct, params)
            };
        },

        // --- 4. ADVISOR (The Chef's Voice) ---

        getAdvisoryAnalysis(minutes, wVal, yeastPct, params) {
            let messages = [];

            // Very Rich Dough Note
            if (params && (params.milkRatio > 20 || params.fatRatio > 8)) {
                messages.push({
                    type: 'info',
                    text: "Bu reçete çok zengin hamur sınıfındadır (Brioche/Burger). Fermantasyon doğal olarak yavaşlar, pik süresi uzar."
                });
            }

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
