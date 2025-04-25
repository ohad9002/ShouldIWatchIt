const { normalizeOscarCategory } = require("./normalization");

function calculateOscarScore(movieOscars, oscarPrefMap, oscarWeightPercent) {
    if (!Array.isArray(movieOscars) || movieOscars.length === 0) return 0;

    const contributions = {};

    movieOscars.forEach(({ originalCategory, isWin }) => {
        const normalized = normalizeOscarCategory(originalCategory);
        const pref = oscarPrefMap[normalized] || 5;
        const weight = isWin ? 1 : 0.7;
        contributions[normalized] = (contributions[normalized] || 0) + (pref * weight);
    });

    let score = 0, totalPref = 0;

    for (const [category, contribution] of Object.entries(contributions)) {
        const basePref = oscarPrefMap[category] || 5;
        score += contribution;
        totalPref += basePref;
    }

    const normalized = totalPref > 0 ? (score / totalPref) * 100 : 0;
    return (normalized * oscarWeightPercent) / 100;
}

module.exports = { calculateOscarScore };
