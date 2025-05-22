// __tests__/calculateGenreScore.test.js

const { calculateGenreScore } = require('../utils/genreScoring'); // adjust the path if needed

describe('calculateGenreScore', () => {
  it('returns 0 if movieGenres is empty', () => {
    const score = calculateGenreScore([], { Action: 8 }, 20);
    expect(score).toBe(0);
  });

  it('uses default preference of 5 if genre not found in user prefs', () => {
    const score = calculateGenreScore(['Action', 'Comedy'], {}, 20);
    // default 5 for both => average 5, (5/10) = 0.5, 0.5 * 20 = 10
    expect(score).toBeCloseTo(10);
  });

  it('correctly averages known preferences', () => {
    const userPrefs = { Action: 8, Comedy: 6 };
    const score = calculateGenreScore(['Action', 'Comedy'], userPrefs, 20);
    // (8+6)/2 = 7 average, (7/10) = 0.7, 0.7 * 20 = 14
    expect(score).toBeCloseTo(14);
  });

  it('mixes known and unknown genres correctly', () => {
    const userPrefs = { Action: 9 };
    const score = calculateGenreScore(['Action', 'Drama'], userPrefs, 10);
    // Action 9, Drama defaults to 5
    // (9+5)/2 = 7, (7/10) = 0.7, 0.7 * 10 = 7
    expect(score).toBeCloseTo(7);
  });
  it('works with one genre', () => {
    const userPrefs = { Horror: 10 };
    const score = calculateGenreScore(['Horror'], userPrefs, 30);
    // (10/10) = 1.0, 1.0 * 30 = 30
    expect(score).toBeCloseTo(30);
  });
  it('applies a boost if two or more genres are strongly preferred (>7)', () => {
    const userPrefs = { Action: 9, SciFi: 8, Comedy: 4 };
    const score = calculateGenreScore(['Action', 'SciFi'], userPrefs, 20);
    // base avg = (9+8)/2 = 8.5 → boosted by 1.1 → 9.35 capped at 10
    // final = (9.35/10) * 20 = 18.7
    expect(score).toBeCloseTo(18.7, 1);
  });

  it('does not boost if only one genre is strongly preferred', () => {
    const userPrefs = { Action: 9, Comedy: 4 };
    const score = calculateGenreScore(['Action', 'Comedy'], userPrefs, 20);
    // (9+4)/2 = 6.5 → no boost → 13
    expect(score).toBeCloseTo(13);
  });

  it('caps boosted score at 10 before scaling', () => {
    const userPrefs = { Fantasy: 10, Adventure: 10 };
    const score = calculateGenreScore(['Fantasy', 'Adventure'], userPrefs, 20);
    // base avg = 10 → 10 * 1.1 = 11 → capped to 10 → (10/10) * 20 = 20
    expect(score).toBeCloseTo(20);
  });

});
