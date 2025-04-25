const { calculateGenreScore } = require("../utils/genreScoring");

describe("calculateGenreScore", () => {
  it("returns correct weighted score for matching genres", () => {
    const movieGenres = ["Action", "Comedy"];
    const userGenrePrefs = { Action: 8, Comedy: 6 };
    const weight = 30;

    const score = calculateGenreScore(movieGenres, userGenrePrefs, weight);
    // ((8/10 * 100) + (6/10 * 100)) / 2 = 70 avg -> 70% of 30 = 21
    expect(score).toBeCloseTo(21);
  });

  it("handles unknown genres by ignoring them", () => {
    const movieGenres = ["Fantasy", "Sci-Fi"];
    const userGenrePrefs = { Fantasy: 7 }; // Sci-Fi is missing
    const weight = 30;

    const score = calculateGenreScore(movieGenres, userGenrePrefs, weight);
    // Only one genre contributes: 7/10 * 100 = 70 -> 70% of 30 = 21
    expect(score).toBeCloseTo(21);
  });

  it("returns 0 if no genres match user preferences", () => {
    const movieGenres = ["Romance"];
    const userGenrePrefs = { Action: 5, Horror: 7 };
    const weight = 30;

    const score = calculateGenreScore(movieGenres, userGenrePrefs, weight);
    expect(score).toBe(0);
  });

  it("defaults to 5 preference if genre has undefined value", () => {
    const movieGenres = ["Drama"];
    const userGenrePrefs = { Drama: undefined }; // Simulates missing pref
    const weight = 30;

    const score = calculateGenreScore(movieGenres, userGenrePrefs, weight);
    // 5/10 * 100 = 50 -> 50% of 30 = 15
    expect(score).toBeCloseTo(15);
  });
});
