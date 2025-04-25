// __tests__/normalization.test.js

const { normalizeGenre, normalizeOscarCategory } = require('../utils/normalization');

describe('normalizeGenre', () => {
    test('removes Epic and Psychological', () => {
        expect(normalizeGenre('Psychological Thriller')).toBe('Thriller');
        expect(normalizeGenre('Epic Drama')).toBe('Drama');
    });

    test('splits genres with &', () => {
        expect(normalizeGenre('Mystery & Thriller')).toBe('Mystery , Thriller');
    });
});

describe('normalizeOscarCategory', () => {
    test('normalizes known categories', () => {
        expect(normalizeOscarCategory('ACTOR')).toBe('Best Actor');
        expect(normalizeOscarCategory('SOUND MIXING')).toBe('Best Sound');
        expect(normalizeOscarCategory('ART DIRECTION')).toBe('Best Production Design');
    });

    test('returns unknown category as-is', () => {
        expect(normalizeOscarCategory('BEST STUNTS')).toBe('BEST STUNTS');
    });
});
