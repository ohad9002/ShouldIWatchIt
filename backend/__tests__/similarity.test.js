// __tests__/similarity.test.js

const { normalizeText, calculateSimilarity } = require('../utils/similarity');

describe('normalizeText', () => {
    test('lowercases and removes punctuation', () => {
        expect(normalizeText('The Godfather!')).toBe('the godfather');
        expect(normalizeText('  Lord of the Rings: Return! ')).toBe('lord of the rings return');
    });
});

describe('calculateSimilarity', () => {
    test('returns 1 for identical strings', () => {
        expect(calculateSimilarity('avatar', 'avatar')).toBe(1);
    });

    test('returns value less than 1 for similar strings', () => {
        const sim = calculateSimilarity('inception', 'incpetion'); // small typo
        expect(sim).toBeLessThan(1);
        expect(sim).toBeGreaterThan(0.7);
    });

    test('returns 0 for completely different strings', () => {
        expect(calculateSimilarity('jaws', 'up')).toBeLessThan(0.1);
    });
});
