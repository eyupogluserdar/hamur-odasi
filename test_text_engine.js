
// --- MOCK ENGINE LOGIC FOR TESTING ---
// We replicate the logic here to verify independent correctness or we can try to load the file if modules allowed.
// For simplicity and speed, we will replicate the exact logic to validat TRUTH TABLES.

function describeDough(params, analysis) {
    const hyd = (params.effectiveHydration !== undefined) ? params.effectiveHydration :
        ((params.waterAmount / params.totalFlour) * 100);

    const fat = params.fatRatio || 0;
    const milk = params.milkRatio || 0;
    const speed = analysis.speed || 1.0;

    const isRich = (fat >= 3 || milk >= 5);
    const isVeryRich = (fat > 8 || milk > 20);

    // 1. CRUMB (İç Doku) - Hydration + Richness
    let crumb = "";
    if (hyd < 60) {
        crumb = "Sıkı / Kapalı";
    } else if (hyd < 68) {
        crumb = "Orta Gözenekli";
    } else {
        if (fat >= 4 || milk >= 8) {
            crumb = "Orta–Geniş Gözenekli (Dengeli)";
        } else {
            crumb = "Geniş Gözenekli (Havadar)";
        }
    }

    // 2. CRUST (Kabuk) - Fat + Hydration
    let crust = "";
    if (fat >= 4) {
        crust = "İnce Çıtır – Yumuşak Geçişli";
    } else if (hyd >= 70) {
        crust = "Çıtır / Elastik";
    } else {
        crust = "Gevrek / Sert";
    }
    // Very rich override
    if (isVeryRich) crust = "Yumuşak & İnce / Karamelize";

    // 3. FERMENTATION (Hız Bazlı - Temp Included)
    let ferment = "";
    // Speed is impacted by Temp, Ingredients, etc.
    if (speed < 0.7) {
        ferment = "Yavaş / Kontrollü (Aroma Odaklı)";
    } else if (speed < 1.1) {
        ferment = "Dengeli / Kontrollü";
    } else {
        ferment = "Hızlı / Aktif";
    }

    // 4. TYPE (Karakter) - Combined Check
    let type = "";
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

    return { crumb, crust, fermentation: ferment, type };
}

console.log("--- TEST METİN MOTORU ---");

// Case 1: Standard Artisan (75% Water, 0% Fat, 24C)
// Speed should be normal (1.0 * HydrationFactor > 1.0)
const case1 = describeDough(
    { effectiveHydration: 75, fatRatio: 0, milkRatio: 0 },
    { speed: 1.2 }
);
console.log("\n1. Artisan Ekmek (75% Su):");
console.log("Type:", case1.type);
console.log("Crumb:", case1.crumb);
console.log("Ferm:", case1.fermentation);

if (case1.type === "ARTİSAN / RUSTİK" && case1.fermentation === "Hızlı / Aktif") console.log("✅ Artisan Doğru");
else console.log("❌ Artisan Hatalı");


// Case 2: Brioche (50% Milk, 25% Fat, 24C)
// Speed is dampened heavily (~0.6)
const case2 = describeDough(
    { effectiveHydration: 60, fatRatio: 25, milkRatio: 50 },
    { speed: 0.6 }
);
console.log("\n2. Brioche (25% Yağ, 50% Süt):");
console.log("Type:", case2.type);
console.log("Crust:", case2.crust);
console.log("Ferm:", case2.fermentation);

if (case2.type === "BRIOCHE / ZENGİN HAMUR" && case2.fermentation.includes("Yavaş")) console.log("✅ Brioche Doğru");
else console.log("❌ Brioche Hatalı");

// Case 3: High Hydration BUT Oily (Focaccia-ish maybe?)
// 75% Water, 5% Oil. Should NOT be Rustic Artisan.
const case3 = describeDough(
    { effectiveHydration: 75, fatRatio: 5, milkRatio: 0 },
    { speed: 1.15 }
);
console.log("\n3. Yağlı Yüksek Su (%75 Su, %5 Yağ):");
console.log("Type:", case3.type);
console.log("Crumb:", case3.crumb); // Should be Balanced, not Airy/Havadar

if (case3.type !== "ARTİSAN / RUSTİK" && case3.crumb.includes("Dengeli")) console.log("✅ Yağlı Hamur Doğru (Artisan değil)");
else console.log("❌ Yağlı Hamur Hatalı (" + case3.type + ")");

