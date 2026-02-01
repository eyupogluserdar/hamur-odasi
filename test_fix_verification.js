
// Mocking the environment
global.window = {
    App: {
        Engine: null,
        Storage: { getAllItems: async () => [] }
    }
};

const fs = require('fs');

// Load Engine
const engineCode = fs.readFileSync('./engine.js', 'utf8');
eval(engineCode);

console.log("--- TEST BAŞLIYOR: Dinamik Solver Kontrolü (Scientific Model) ---");

// Helper to run sim
function testHour(h, customParams = {}) {
    const targetFDT = window.App.Engine.calculateTargetDoughTemp(h);

    // Context for Solver
    const context = {
        roomTemp: 22,
        doughTemp: targetFDT,
        totalFlour: 1000,
        waterAmount: 600, // 60%
        saltAmount: 20,
        wValue: 200,
        milkRatio: 0, fatRatio: 0,
        effectiveWaterAmount: 600,
        ...customParams // Override
    };

    const idealPct = window.App.Engine.getIdealYeastPercent(h, context);

    // Simulate
    const params = {
        ...context,
        yeastAmount: (idealPct * 1000 / 100) * 3, // Fresh eq
        yeastType: 'fresh',
    };

    // Check if calculaterequiredyeast logic aligns with simulate logic
    const speed = window.App.Engine.calculateFermentationSpeed(params);
    const predictedMin = 180 / speed; // Use 180 as baseline (Sim uses 3h)

    const predictedHours = predictedMin / 60;

    let label = `[${h} Saat]`;
    if (customParams.wValue) label += ` W${customParams.wValue}`;
    if (customParams.roomTemp) label += ` ${customParams.roomTemp}C`;

    console.log(`${label} Hedef FDT: ${targetFDT}°C, Maya(Kuru): %${idealPct} -> Sonuç: ${predictedHours.toFixed(2)} Saat`);

    return predictedHours;
}

// 1. Standard Tests
console.log("\n--- Standart Durum ---");
testHour(1);
testHour(2);
testHour(4);

// 2. Scenario Tests
console.log("\n--- Senaryo Testleri (Kurallar) ---");

console.log(">> Güçlü Un (W300) vs Standart (W200) - Beklenti: Daha Az Maya");
testHour(2, { wValue: 200 });
testHour(2, { wValue: 300 });

console.log("\n>> Sıcak Ortam (30C) vs 22C - Beklenti: Daha Az Maya");
testHour(2, { roomTemp: 30, doughTemp: 30 }); // High Temp

console.log("\n>> Zengin Hamur (Süt/Yağ) - Beklenti: Daha Fazla Maya (Baskılandığı için)");
testHour(2, { milkRatio: 20, fatRatio: 10 });

// 3. Long Fermentation Test (8h - 24h)
console.log("\n--- Uzun Süreli Fermantasyon Testi (8h - 24h) ---");
prevResult = 0;
for (let h of [8, 9, 10, 12, 18, 24]) {
    const idealPct = window.App.Engine.getIdealYeastPercent(h);
    const targetFDT = window.App.Engine.calculateTargetDoughTemp(h);

    // Simulate to check result
    const context = {
        roomTemp: 22,
        doughTemp: targetFDT,
        totalFlour: 1000,
        waterAmount: 620,
        saltAmount: 20,
        wValue: 200,
        milkRatio: 0, fatRatio: 0
    };

    const res = testHour(h);

    if (res === prevResult && h !== 8) {
        console.log(`   ⚠️ UYARI: ${h} Saat sonucu değişmedi! (${res} Saat)`);
    }
    prevResult = res;
}
