const RatingPreference = require("../models/RatingPreference");
const GenrePreference = require("../models/GenrePreference");
const OscarPreference = require("../models/OscarPreference");
const { generateMovieDecision } = require("../utils/geminiAI");
const { calculateGenreScore } = require("../utils/genreScoring");
const { calculateOscarScore } = require("../utils/oscarScoring");

async function getMovieDecision(userId, movieData) {
    console.log("📌 Movie data before AI decision:", JSON.stringify(movieData, null, 2));

    try {
        // === Rating Preferences ===
        const ratingPrefs = await RatingPreference.findOne({ user: userId });
        const imdbPref = ratingPrefs?.imdb || 5;
        const rtCriticPref = ratingPrefs?.rtCritic || 5;
        const rtAudiencePref = ratingPrefs?.rtPopular || 5;
        const avgRatingPref = (imdbPref + rtCriticPref + rtAudiencePref) / 3;

        // === Genre Preferences ===
        const genrePrefs = await GenrePreference.find({ user: userId }).populate("genre") || [];
        const genreWeights = {};
        genrePrefs.forEach(pref => {
            if (pref.genre?.name) genreWeights[pref.genre.name] = pref.preference || 5;
        });

        const matchedGenrePrefs = movieData.genres?.map(g => genreWeights[g]).filter(Boolean) || [];
        const avgGenrePref = matchedGenrePrefs.length > 0
            ? matchedGenrePrefs.reduce((sum, val) => sum + val, 0) / matchedGenrePrefs.length
            : 5;

        // === Oscar Preferences ===
        const oscarPrefs = await OscarPreference.find({ user: userId }).populate("category") || [];
        const oscarPrefMap = {};
        oscarPrefs.forEach(pref => {
            if (pref.category?.name) oscarPrefMap[pref.category.name] = pref.preference || 5;
        });

        const avgOscarPref = oscarPrefs.length > 0
            ? oscarPrefs.reduce((sum, pref) => sum + (pref.preference || 5), 0) / oscarPrefs.length
            : 5;

        // === Stage 1: Weight Distribution ===
        const totalWeight = avgRatingPref + avgGenrePref + avgOscarPref;
        const ratingWeight = (avgRatingPref / totalWeight) * 100;
        const genreWeight = (avgGenrePref / totalWeight) * 100;
        const oscarWeight = (avgOscarPref / totalWeight) * 100;

        console.log(`📊 Stage 1 Weights - Ratings: ${ratingWeight.toFixed(2)}%, Genres: ${genreWeight.toFixed(2)}%, Oscars: ${oscarWeight.toFixed(2)}%`);

        // === Rating Zone ===
        const imdbRating = parseFloat(movieData.imdb?.rating) || 0;
        const criticScore = parseFloat(movieData.rottenTomatoes?.criticScore?.replace("%", "")) || 0;
        const audienceScore = parseFloat(movieData.rottenTomatoes?.audienceScore?.replace("%", "")) || 0;

        const normIMDb = (imdbRating / 10) * 100;
        const imdbWeighted = (imdbPref / 10) * normIMDb;
        const criticWeighted = (rtCriticPref / 10) * criticScore;
        const audienceWeighted = (rtAudiencePref / 10) * audienceScore;

        const ratingSlicePerSource = ratingWeight / 3;
        const weightedRatingScore =
            (imdbWeighted * ratingSlicePerSource) / 100 +
            (criticWeighted * ratingSlicePerSource) / 100 +
            (audienceWeighted * ratingSlicePerSource) / 100;

        // === Genre Zone ===
        const weightedGenreScore = calculateGenreScore(movieData.genres, genreWeights, genreWeight);

        // === Oscar Zone ===
        const weightedOscarScore = calculateOscarScore(movieData.oscars, oscarPrefMap, oscarWeight);

        // === Final Score ===
        let finalScore = weightedRatingScore + weightedGenreScore + weightedOscarScore;
        finalScore = Math.min(finalScore, 100);

        console.log(`📊 Final Score Breakdown: Ratings: ${weightedRatingScore.toFixed(2)}, Genres: ${weightedGenreScore.toFixed(2)}, Oscars: ${weightedOscarScore.toFixed(2)}`);
        console.log(`✅ Final Score (Capped at 100): ${finalScore.toFixed(2)}`);

        const formattedPrefs = {
            imdbPref,
            rtCriticPref,
            rtAudiencePref,
            genrePrefs: genrePrefs.map(pref => ({
                name: pref.genre?.name,
                preference: pref.preference
            })),
            oscarPrefs: oscarPrefs.map(pref => ({
                category: pref.category?.name,
                preference: pref.preference
            }))
        };

        return await generateMovieDecision(movieData, formattedPrefs, finalScore);

    } catch (error) {
        console.error("❌ Error in getMovieDecision:", error);
        throw new Error("Failed to get movie decision.");
    }
}

module.exports = { getMovieDecision };
