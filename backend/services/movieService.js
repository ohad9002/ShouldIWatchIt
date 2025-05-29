const RatingPreference = require("../models/RatingPreference");
const GenrePreference = require("../models/GenrePreference");
const OscarPreference = require("../models/OscarPreference");
const Genre = require("../models/Genre");
const Oscar = require("../models/Oscar");
const { generateMovieDecision } = require("../utils/geminiAI");
const { calculateGenreScore } = require("../utils/genreScoring");
const { calculateOscarScore } = require("../utils/oscarScoring");

async function getMovieDecision(userId, movieData) {
    console.log("📌 Movie data before AI decision:", JSON.stringify(movieData, null, 2));

    try {
        // === Fetch All Preferences ===
        const ratingPrefs = await RatingPreference.findOne({ user: userId });
        const imdbPref = ratingPrefs?.imdb || 5;
        const rtCriticPref = ratingPrefs?.rtCritic || 5;
        const rtAudiencePref = ratingPrefs?.rtPopular || 5;

        // Fetch all genres and user genre prefs
        const allGenres = await Genre.find();
        const genrePrefs = await GenrePreference.find({ user: userId }).populate("genre") || [];
        const genrePrefMap = {};
        genrePrefs.forEach(pref => {
            if (pref.genre?.name) genrePrefMap[pref.genre.name] = pref.preference || 5;
        });
        // Fill in missing genres with neutral value
        allGenres.forEach(g => {
            if (!(g.name in genrePrefMap)) genrePrefMap[g.name] = 5;
        });

        // Fetch all oscars and user oscar prefs
        const allOscars = await Oscar.find();
        const oscarPrefs = await OscarPreference.find({ user: userId }).populate("category") || [];
        const oscarPrefMap = {};
        oscarPrefs.forEach(pref => {
            if (pref.category?.name) oscarPrefMap[pref.category.name] = pref.preference || 5;
        });
        // Fill in missing oscar categories with neutral value
        allOscars.forEach(o => {
            if (!(o.name in oscarPrefMap)) oscarPrefMap[o.name] = 5;
        });

        // === LOG: User Preferences ===
        console.log("🔎 User Preferences for Calculation:");
        console.log(`   - IMDb: ${imdbPref}`);
        console.log(`   - RT Critic: ${rtCriticPref}`);
        console.log(`   - RT Audience: ${rtAudiencePref}`);
        console.log(`   - Genre Prefs:`, genrePrefMap);
        console.log(`   - Oscar Prefs:`, oscarPrefMap);

       
        // === Stage 1: Calculate Section Weights (using ALL preferences in DB) ===
        const avgRatingPref = (imdbPref + rtCriticPref + rtAudiencePref) / 3;
        const avgGenrePref = Object.values(genrePrefMap).reduce((a, b) => a + b, 0) / Object.values(genrePrefMap).length;
        const oscarImportance = ratingPrefs?.oscarImportance ?? 5; // <-- fetch from user prefs
        const totalWeight = avgRatingPref + avgGenrePref + oscarImportance;

        const ratingWeight = avgRatingPref / totalWeight;
        const genreWeight = avgGenrePref / totalWeight;
        const oscarWeight = oscarImportance / totalWeight;

        console.log(`📊 Stage 1 Weights Calculation:`);
        console.log(`   - avgRatingPref: ${avgRatingPref.toFixed(2)}`);
        console.log(`   - avgGenrePref: ${avgGenrePref.toFixed(2)}`);
        console.log(`   - oscarImportance: ${oscarImportance.toFixed(2)}`);
        console.log(`   - totalWeight: ${totalWeight.toFixed(2)}`);
        console.log(`   - ratingWeight: ${(ratingWeight * 100).toFixed(2)}%`);
        console.log(`   - genreWeight: ${(genreWeight * 100).toFixed(2)}%`);
        console.log(`   - oscarWeight: ${(oscarWeight * 100).toFixed(2)}%`);

        // === Stage 2: Calculate Section Scores (using only relevant preferences + bonuses) ===

        // Ratings
        const imdbRating = parseFloat(movieData.imdb?.rating) || 0;
        const criticScore = parseFloat(movieData.rottenTomatoes?.criticScore?.replace("%", "")) || 0;
        const audienceScore = parseFloat(movieData.rottenTomatoes?.audienceScore?.replace("%", "")) || 0;

        console.log("🔎 Movie Ratings Data:");
        console.log(`   - IMDb rating: ${imdbRating}`);
        console.log(`   - RT Critic: ${criticScore}`);
        console.log(`   - RT Audience: ${audienceScore}`);

        const imdbNorm = imdbRating; // already 0-10
        const criticNorm = criticScore / 10; // 0-10
        const audienceNorm = audienceScore / 10; // 0-10

        const totalPref = imdbPref + rtCriticPref + rtAudiencePref;
        const weightedSum =
            imdbNorm * imdbPref +
            criticNorm * rtCriticPref +
            audienceNorm * rtAudiencePref;

        const rawRatingScore = weightedSum / totalPref; // 0-10

        console.log("🔎 Ratings Calculation Details:");
        console.log(`   - imdbNorm: ${imdbNorm.toFixed(2)}`);
        console.log(`   - criticNorm: ${criticNorm.toFixed(2)}`);
        console.log(`   - audienceNorm: ${audienceNorm.toFixed(2)}`);
        console.log(`   - totalPref: ${totalPref.toFixed(2)}`);
        console.log(`   - weightedSum: ${weightedSum.toFixed(2)}`);
        console.log(`   - rawRatingScore (0-10): ${rawRatingScore.toFixed(2)}`);

        // Genres
        const genreList =
          movieData.genres && movieData.genres.length
            ? movieData.genres
            : movieData.rottenTomatoes?.genres || [];
        console.log("🔎 Movie Genres:", genreList);
        const genreScore = calculateGenreScore(genreList, genrePrefMap, 10); // 0-1
        console.log(`   - genreScore (0-1): ${genreScore.toFixed(3)}`);

        // Oscars
        console.log("🔎 Movie Oscars:", movieData.oscars);
        const oscarScore = calculateOscarScore(movieData.oscars, oscarPrefMap, 10); // 0-1
        console.log(`   - oscarScore (0-1): ${oscarScore.toFixed(3)}`);

        // === Final Score Calculation ===
        // Ratings (0-10) * weight * 10 = 0-100 * weight
        const weightedRatingScore = rawRatingScore * ratingWeight * 10;
        // Genres (0-1) * weight * 100 = 0-100 * weight
        const weightedGenreScore = genreScore * genreWeight * 100;
        // Oscars (0-1) * weight * 100 = 0-100 * weight
        const weightedOscarScore = oscarScore * oscarWeight * 100;

        let finalScore = weightedRatingScore + weightedGenreScore + weightedOscarScore;
        finalScore = Math.min(finalScore, 100);

        console.log(`📊 Final Score Breakdown:`);
        console.log(`   - weightedRatingScore: ${weightedRatingScore.toFixed(2)}`);
        console.log(`   - weightedGenreScore: ${weightedGenreScore.toFixed(2)}`);
        console.log(`   - weightedOscarScore: ${weightedOscarScore.toFixed(2)}`);
        console.log(`✅ Final Score (Capped at 100): ${finalScore.toFixed(2)}`);

        // Only include user preferences for the movie's genres
        const relevantGenrePrefs = genreList
          .map(g => ({
            name: g,
            preference: genrePrefMap[g] ?? 5
          }))
          .filter(g => g.name); // filter out undefined/null

        const formattedPrefs = {
            imdbPref,
            rtCriticPref,
            rtAudiencePref,
            genrePrefs: relevantGenrePrefs,
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
