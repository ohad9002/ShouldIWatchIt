function calculateGenreScore(movieGenres, genreWeights, genreWeightPercent) {
    if (!Array.isArray(movieGenres) || movieGenres.length === 0) return 0;

    let totalScore = 0;
    const matchingGenres = movieGenres.filter(g => genreWeights[g] !== undefined);
    const slicePerGenre = genreWeightPercent / (matchingGenres.length || 1);

    matchingGenres.forEach(genre => {
        const pref = genreWeights[genre] || 5;
        const contribution = (pref / 10) * 100;
        totalScore += (contribution * slicePerGenre) / 100;
    });

    return totalScore;
}

module.exports = { calculateGenreScore };
