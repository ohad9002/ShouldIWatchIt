const RatingPreference = require("../models/RatingPreference");
const GenrePreference = require("../models/GenrePreference");
const OscarPreference = require("../models/OscarPreference");
const { generateMovieDecision } = require("../utils/geminiAI");

async function getMovieDecision(userId, movieData) {
    console.log("📌 Movie data before AI decision:", JSON.stringify(movieData, null, 2));
    try {
        // Fetch Rating Preferences
        const ratingPrefs = await RatingPreference.findOne({ user: userId });
        const imdbPref = ratingPrefs?.imdb || 5;
        const rtCriticPref = ratingPrefs?.rtCritic || 5;
        const rtAudiencePref = ratingPrefs?.rtPopular || 5;
        const avgRatingPref = (imdbPref + rtCriticPref + rtAudiencePref) / 3;

        console.log("🎯 User Rating Preferences:", { imdbPref, rtCriticPref, rtAudiencePref });

        // Fetch Genre Preferences
        const genrePrefs = await GenrePreference.find({ user: userId }).populate("genre") || [];
        const genreWeights = {};
        genrePrefs.forEach(pref => {
            if (pref.genre?.name) {
                genreWeights[pref.genre.name] = pref.preference || 5;
            }
        });

        console.log("🎬 User Genre Preferences:", genreWeights);

        // Compute Genre Score
        let genreSum = 0;
        let genreCount = 0;
        if (Array.isArray(movieData.genres)) {
            movieData.genres.forEach(genre => {
                if (genreWeights[genre] !== undefined) {
                    genreSum += genreWeights[genre];
                    genreCount++;
                }
            });
        }
        const avgGenrePref = genreCount > 0 ? genreSum / genreCount : 5; // Default 5 if no match

        // Fetch Oscar Preferences
        const oscarPrefs = await OscarPreference.find({ user: userId }).populate("category") || [];
        const oscarPrefMap = {};
        oscarPrefs.forEach(pref => {
            if (pref.category?.name) {
                oscarPrefMap[pref.category.name] = pref.preference || 5;
            }
        });

        console.log("🎭 User Oscar Preferences Map:", oscarPrefMap);

        // Compute Average Oscar Preference
        let oscarSum = 0;
        oscarPrefs.forEach(pref => {
            oscarSum += pref.preference || 5; // Default to 5 if no value
        });
        const avgOscarPref = oscarPrefs.length > 0 ? oscarSum / oscarPrefs.length : 5;

        // Normalize Weights (Stage 1)
        const totalWeight = avgRatingPref + avgGenrePref + avgOscarPref;
        const ratingWeight = (avgRatingPref / totalWeight) * 100;
        const genreWeight = (avgGenrePref / totalWeight) * 100;
        const oscarWeight = (avgOscarPref / totalWeight) * 100;

        console.log(`📊 Stage 1 Weights - Ratings: ${ratingWeight}%, Genres: ${genreWeight}%, Oscars: ${oscarWeight}%`);

        // Parse IMDb rating properly
        const imdbRating = parseFloat(movieData.imdb?.rating) || 0;

        // Convert Rotten Tomatoes scores from percentages
        const criticScore = parseFloat(movieData.rottenTomatoes?.criticScore?.replace("%", "")) || 0;
        const audienceScore = parseFloat(movieData.rottenTomatoes?.audienceScore?.replace("%", "")) || 0;

        // Normalize scores: IMDb (0-10) => (0-100), RT Critic & Audience (0-100)
        const normIMDb = (imdbRating / 10) * 100;
        const imdbWeighted = (imdbPref / 10) * normIMDb;
        const criticWeighted = (rtCriticPref / 10) * criticScore;
        const audienceWeighted = (rtAudiencePref / 10) * audienceScore;

        // Split rating slice into 3 equal parts
        const ratingSlicePerSource = ratingWeight / 3;
        const weightedIMDb = (imdbWeighted * ratingSlicePerSource) / 100;
        const weightedCritic = (criticWeighted * ratingSlicePerSource) / 100;
        const weightedAudience = (audienceWeighted * ratingSlicePerSource) / 100;
        const weightedRatingScore = weightedIMDb + weightedCritic + weightedAudience;

        // Compute Weighted Genre Score (Stage 2)
        let weightedGenreScore = 0;
        if (genreCount > 0) {
            const genreSlicePerGenre = genreWeight / genreCount; // Split genre weight among all movie genres
            movieData.genres.forEach(genre => {
                if (genreWeights[genre] !== undefined) {
                    const genrePref = genreWeights[genre];
                    const genreContribution = (genrePref / 10) * 100; // Convert preference to percentage
                    weightedGenreScore += (genreContribution * genreSlicePerGenre) / 100; // Apply weight
                }
            });
        }

        // Normalize Oscar categories to match the database
        const normalizeOscarCategory = (category) => {
            const categoryMap = {
                "ACTOR": "Best Actor",
                "ACTOR IN A SUPPORTING ROLE": "Best Supporting Actor",
                "ACTRESS IN A LEADING ROLE": "Best Actress",
                "ACTRESS IN A SUPPORTING ROLE": "Best Supporting Actress",
                "COSTUME DESIGN": "Best Costume Design",
                "DIRECTING": "Best Director",
                "FILM EDITING": "Best Film Editing",
                "MUSIC (ORIGINAL DRAMATIC SCORE)": "Best Original Score",
                "MUSIC (ORIGINAL SONG)": "Best Original Song",
                "BEST PICTURE": "Best Picture",
                "SOUND": "Best Sound",
                "SOUND EDITING": "Best Sound", // Aggregate under Best Sound
                "SOUND MIXING": "Best Sound", // Aggregate under Best Sound
                "VISUAL EFFECTS": "Best Visual Effects",
                "ART DIRECTION": "Best Production Design",
                "PRODUCTION DESIGN": "Best Production Design",
                "CINEMATOGRAPHY": "Best Cinematography",
                "FOREIGN LANGUAGE FILM": "Best International Feature", // Add this mapping
                "WRITING (SCREENPLAY--BASED ON MATERIAL FROM ANOTHER MEDIUM)": "Best Adapted Screenplay",
                "WRITING (ORIGINAL SCREENPLAY)": "Best Original Screenplay"
            };

            const normalizedCategory = categoryMap[category.toUpperCase()] || category;
            console.log(`🔍 Normalizing category: "${category}" -> "${normalizedCategory}"`);
            return normalizedCategory;
        };

        // Normalize Oscars and handle Writing awards
        const normalizedOscars = movieData.oscars.map((award) => {
            const normalizedCategory = normalizeOscarCategory(award.originalCategory);
            const preference = oscarPrefMap[normalizedCategory] || 5; // Default preference is 5
            console.log(`🎭 Normalized Oscar: ${award.originalCategory} -> ${normalizedCategory}, Preference: ${preference}`);
            return {
                ...award,
                normalizedCategory, // Add normalized category for backend processing
                preference
            };
        });

        // Aggregate contributions for similar categories
        const aggregatedContributions = {};
        normalizedOscars.forEach((award) => {
            const key = award.normalizedCategory;
            const awardWeight = award.isWin ? 1 : 0.7; // 100% for win, 70% for nomination
            const contribution = award.preference * awardWeight;

            if (!aggregatedContributions[key]) {
                aggregatedContributions[key] = 0;
            }
            aggregatedContributions[key] += contribution;
        });

        // Compute Weighted Oscar Score
        let oscarScore = 0;
        let totalOscarWeight = 0;

        Object.entries(aggregatedContributions).forEach(([category, contribution]) => {
            const preference = oscarPrefMap[category] || 5; // Default preference is 5
            console.log(`🎭 Oscar Category: ${category}, Contribution: ${contribution}`);
            oscarScore += contribution;
            totalOscarWeight += preference;
        });

        const normalizedOscarScore = totalOscarWeight > 0 ? (oscarScore / totalOscarWeight) * 100 : 0;
        const weightedOscarScore = (normalizedOscarScore * oscarWeight) / 100;

        console.log(`📊 Oscar Score: ${normalizedOscarScore}, Weighted Oscar Score: ${weightedOscarScore}`);

        // Compute Final Score (Now properly capped at 100)
        let finalScore = weightedRatingScore + weightedGenreScore + weightedOscarScore;
        finalScore = Math.min(finalScore, 100); // Cap at 100

        console.log(`📊 Final Score Breakdown: Ratings: ${weightedRatingScore}, Genres: ${weightedGenreScore}, Oscars: ${weightedOscarScore}`);
        console.log(`📊 Final Score (Capped at 100): ${finalScore}`);

        // Format preferences for AI
        const formattedPrefs = {
            imdbPref,
            rtCriticPref,
            rtAudiencePref,
            genrePrefs: genrePrefs.map(pref => ({ name: pref.genre?.name, preference: pref.preference })),
            oscarPrefs: oscarPrefs.map(pref => ({ category: pref.category?.name, preference: pref.preference }))
        };

        return await generateMovieDecision(movieData, formattedPrefs, finalScore);
    } catch (error) {
        console.error("❌ Error fetching user preferences:", error);
        throw new Error("Failed to get movie decision.");
    }
}

module.exports = { getMovieDecision };
