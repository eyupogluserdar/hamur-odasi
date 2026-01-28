/**
 * HAMUR ODASI - Utilities
 */
(function () {
    window.App = window.App || {};
    window.App.Utils = window.App.Utils || {};

    /**
     * Normalizes amount to base unit (grams or milliliters)
     * @param {number} amount - The amount to convert
     * @param {string} unit - The unit of the amount (kg, lt, gr)
     * @returns {number} - The amount in grams or milliliters
     */
    window.App.Utils.normalizeAmount = function (amount, unit) {
        const n = Number(amount) || 0;
        if (unit === 'kg') return n * 1000; // to grams
        if (unit === 'lt') return n * 1000; // to ml
        if (unit === 'gr') return n;        // grams (base)
        if (unit === 'ml') return n;        // ml (base)
        return n; // fallback
    };
})();
