const { calculateOscarScore } = require("../utils/oscarScoring");

describe("calculateOscarScore", () => {
  it("correctly weights wins as 100% and nominations as 70%", () => {
    const normalizedOscars = [
      { normalizedCategory: "Best Picture", isWin: true, preference: 8 },
      { normalizedCategory: "Best Director", isWin: false, preference: 7 },
    ];
    const oscarPrefMap = {
      "Best Picture": 8,
      "Best Director": 7,
    };
    const weight = 30;

    // Contributions: 8*1 = 8, 7*0.7 = 4.9 -> sum = 12.9
    // Total weights: 8 + 7 = 15
    // Normalized score: (12.9 / 15) * 100 = 86
    // Final score: 86 * 30% = 25.8
    const score = calculateOscarScore(normalizedOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(25.8);
  });

  it("returns 0 if there are no Oscars", () => {
    const normalizedOscars = [];
    const oscarPrefMap = {};
    const weight = 30;

    const score = calculateOscarScore(normalizedOscars, oscarPrefMap, weight);
    expect(score).toBe(0);
  });

  it("handles missing user preferences by defaulting to 5", () => {
    const normalizedOscars = [
      { normalizedCategory: "Best Visual Effects", isWin: false, preference: 5 },
    ];
    const oscarPrefMap = {}; // no mapping
    const weight = 30;

    // 5 * 0.7 = 3.5 / 5 * 100 = 70 -> 70% of 30 = 21
    const score = calculateOscarScore(normalizedOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(21);
  });

  it("handles multiple wins in same category", () => {
    const normalizedOscars = [
      { normalizedCategory: "Best Actor", isWin: true, preference: 9 },
      { normalizedCategory: "Best Actor", isWin: true, preference: 9 },
    ];
    const oscarPrefMap = { "Best Actor": 9 };
    const weight = 30;

    // 9 + 9 = 18, totalPref = 9
    // Score = (18/9)*100 = 200 -> capped at 100, so 100% of 30 = 30
    const score = calculateOscarScore(normalizedOscars, oscarPrefMap, weight);
    expect(score).toBeCloseTo(30); // after final cap
  });
});
