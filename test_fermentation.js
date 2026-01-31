const engine = {
    getEffectiveYeastPercent(amount, type, totalFlour) {
        if (totalFlour <= 0) return 0;
        let equivalentDry = 0;
        if (type === 'fresh') {
            equivalentDry = amount / 3.0;
        } else if (type === 'active_dry') {
            equivalentDry = amount / 1.1;
        } else {
            equivalentDry = amount;
        }
        return (equivalentDry / totalFlour) * 100;
    },
    getTempFactor(celsius) {
        if (celsius < 4) return 0.1;
        if (celsius > 40) return 3.0;
        return Math.pow(2, (celsius - 24) / 10);
    },
    getHydrationFactor(hydrationPercent) {
        const diff = hydrationPercent - 60;
        const factor = 1.0 + (diff * 0.015);
        return Math.max(0.5, factor);
    },
    getSaltFactor(saltPercent) {
        const diff = saltPercent - 2.0;
        return 1.0 - (diff * 0.1);
    },
    simulate(params) {
        const BASELINE_TIME_MIN = 180; // Recalibrated: 3 Hours for 1% Fresh Yeast
        const REF_YEAST_PCT = 0.333; // 1% Fresh Yeast (~0.33% Dry)

        const yeastPct = this.getEffectiveYeastPercent(params.yeastAmount, params.yeastType, params.totalFlour);
        const hydrationPct = (params.waterAmount / params.totalFlour) * 100;
        const saltPct = (params.saltAmount / params.totalFlour) * 100;

        let yeastFactor = (yeastPct > 0) ? (yeastPct / REF_YEAST_PCT) : 0;
        if (yeastPct > 3.0) yeastFactor *= 0.8;

        const tempFactor = this.getTempFactor(params.roomTemp);
        const hydroFactor = this.getHydrationFactor(hydrationPct);
        const saltFactor = this.getSaltFactor(saltPct);

        const totalSpeed = yeastFactor * tempFactor * hydroFactor * saltFactor;
        const predictedMin = (totalSpeed > 0) ? (BASELINE_TIME_MIN / totalSpeed) : 9999;

        return {
            timeToPeak: Math.round(predictedMin),
            factors: { yeast: yeastFactor, temp: tempFactor, hydro: hydroFactor, salt: saltFactor },
            inputs: { yeastPct: yeastPct.toFixed(3) + '% (Dry Eq)' }
        };
    }
};

// Test Cases
const totalFlour = 1000;
const scenarios = [
    { yeastFresh: 1, label: '0.1% Fresh (Napoli)' },
    { yeastFresh: 2, label: '0.2% Fresh' },
    { yeastFresh: 5, label: '0.5% Fresh' },
    { yeastFresh: 10, label: '1.0% Fresh' },
    { yeastFresh: 20, label: '2.0% Fresh (Bread)' },
    { yeastFresh: 30, label: '3.0% Fresh' },
    { yeastFresh: 50, label: '5.0% Fresh (Sweet)' }
];

console.log('--- FERMENTATION SIMULATION (Current Logic) ---');
console.log('Base: 1000g Flour, 600ml Water (60%), 20g Salt (2%), 24°C');
console.log('| Label | Fresh Yeast (g) | Calc Time (Hours) | Calc Time (Mins) |');
console.log('|---|---|---|---|');

scenarios.forEach(s => {
    const res = engine.simulate({
        totalFlour: totalFlour,
        wValue: 250,
        yeastAmount: s.yeastFresh,
        yeastType: 'fresh',
        saltAmount: 20,
        waterAmount: 600,
        roomTemp: 24,
    });
    const hours = (res.timeToPeak / 60).toFixed(1);
    console.log(`| ${s.label} | ${s.yeastFresh}g | ${hours}h | ${res.timeToPeak}m |`);
});
