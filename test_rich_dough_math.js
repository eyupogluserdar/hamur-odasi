
// Mock Ingredients
const FLOUR_AMT = 1000;
const WATER_AMT = 300;
const MILK_AMT = 500; // 50%
const FAT_AMT = 40;   // 4%

const milkRatio = (MILK_AMT / FLOUR_AMT) * 100;
const fatRatio = (FAT_AMT / FLOUR_AMT) * 100;

console.log(`--- TEST SENARYOSU 1: Standart Zengin Hamur (Engine Logic) ---`);
console.log(`Süt: %${milkRatio}, Yağ: %${fatRatio}`);

// Engine Logic Replication
let speed = 1.0;

if (milkRatio > 5.0) speed *= 0.8;
if (fatRatio > 3.0) speed *= 0.85;

// Extra check
if (milkRatio > 20 || fatRatio > 8) speed *= 0.9;

console.log(`Sonuç Hızı 1: ${speed.toFixed(3)}`);
if (speed.toFixed(3) === (0.8 * 0.85 * 0.9).toFixed(3)) // 0.612
    console.log("✅ Hız Çarpanları Doğru (0.8 * 0.85 * 0.9)");
else
    console.log("❌ Hız Çarpanı Beklenmedik");


// SCENARIO 2: BRIOCHE (Extreme)
const FAT_AMT_BRIOCHE = 250; // 25% Fat
const MILK_AMT_BRIOCHE = 500; // 50% Milk
const fatRatioB = (FAT_AMT_BRIOCHE / FLOUR_AMT) * 100;

console.log(`\n--- TEST SENARYOSU 2: BRIOCHE (Extreme Rich) ---`);
console.log(`Süt: %${milkRatio}, Yağ: %${fatRatioB}`);

let speedB = 1.0;
if (milkRatio > 5.0) speedB *= 0.8;
if (fatRatioB > 3.0) speedB *= 0.85;
if (milkRatio > 20 || fatRatioB > 8) {
    console.log("-> Extreme Rich Detect Edildi (x0.9)");
    speedB *= 0.9;
}

console.log(`Sonuç Hızı 2: ${speedB.toFixed(3)}`);

const baseTime = 180;
const correctedTimeB = baseTime / speedB;
console.log(`Pik Süresi: ${Math.round(correctedTimeB)}dk`);

if (speedB < 0.62) console.log("✅ Brioche Freni Çalışıyor");
else console.log("❌ Brioche Freni Çalışmadı");
