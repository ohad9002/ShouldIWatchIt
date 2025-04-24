function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function calculateSimilarity(a, b) {
    const distance = (a, b) => {
        const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
            Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
        );

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    };

    const normA = normalizeText(a);
    const normB = normalizeText(b);
    const maxLength = Math.max(normA.length, normB.length);
    return maxLength === 0 ? 1 : 1 - distance(normA, normB) / maxLength;
}

module.exports = { normalizeText, calculateSimilarity };
