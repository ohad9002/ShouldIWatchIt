const { calculateOscarScore } = require("../utils/oscarScoring");

describe("calculateOscarScore", () => {
  it("correctly weights wins as 100% and nominations as 70%", () => {
    const movieOscars = [
      { originalCategory: "Best Picture", isWin: true },
      { originalCategory: "Best Director", isWin: false },
    ];
    const oscarPrefMap = {
      "Best Picture": 8,
      "Best Director": 7,
    };
    const weight = 30;

    // Contributions: 8*1 = 8, 7*0.7 = 4.9 -> sum = 12.9
    // Total prefs: 8 + 7 = 15
    // Normalized score: (12.9 / 15) * 100 = 86
    // Final score: 86 * 30% = 25.8
    const score = calculateOscarScore(movieOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(25.8);
  });

  it("returns 0 if there are no Oscars", () => {
    const movieOscars = [];
    const oscarPrefMap = {};
    const weight = 30;

    const score = calculateOscarScore(movieOscars, oscarPrefMap, weight);
    expect(score).toBe(0);
  });

  it("handles missing user preferences by defaulting to 5", () => {
    const movieOscars = [
      { originalCategory: "Best Visual Effects", isWin: false },
    ];
    const oscarPrefMap = {}; // no mapping
    const weight = 30;

    // Default pref = 5, contribution = 5 * 0.7 = 3.5
    // Total pref = 5
    // (3.5 / 5) * 100 = 70, 70 * 30% = 21
    const score = calculateOscarScore(movieOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(21);
  });

  it("handles multiple wins in the same category", () => {
    const movieOscars = [
      { originalCategory: "Best Actor", isWin: true },
      { originalCategory: "Best Actor", isWin: true },
    ];
    const oscarPrefMap = { "Best Actor": 9 };
    const weight = 30;

    // Contribution: 9 + 9 = 18, totalPref = 9
    // Normalized score: (18/9)*100 = 200 → capped at 100 → 100 * 30% = 30
    const score = calculateOscarScore(movieOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(30);
  });
});
