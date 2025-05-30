require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateMovieDecision(movieData, userPrefs, finalScore) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const shouldWatch = finalScore >= 53 ? "Yes" : "No";

    const movieTitle = movieData.rottenTomatoes?.title || movieData.imdb?.title || "Unknown";

    // Use genres from movieData.genres if present, otherwise fallback to RT genres
    const genres =
        (movieData.genres && movieData.genres.length)
            ? movieData.genres
            : (movieData.rottenTomatoes?.genres && movieData.rottenTomatoes.genres.length)
                ? movieData.rottenTomatoes.genres
                : (movieData.imdb?.genres && movieData.imdb.genres.length)
                    ? movieData.imdb.genres
                    : [];

    // Oscar line logic
    let oscarLine = "- Oscar Recognition: ";
    if (Array.isArray(movieData.oscars) && movieData.oscars.length > 0) {
        const wins = movieData.oscars.filter(o => o.isWin).length;
        const noms = movieData.oscars.length;
        oscarLine += `The movie received ${noms} Oscar nomination${noms > 1 ? "s" : ""}${wins ? `, including ${wins} win${wins > 1 ? "s" : ""}` : ""}.`;
    } else {
        oscarLine += "The movie did not receive any Oscar nominations.";
    }

    const prompt = `
    The user has the following preferences:
    - IMDb importance: ${userPrefs.imdbPref || "N/A"}/10
    - RT critic importance: ${userPrefs.rtCriticPref || "N/A"}/10
    - RT audience importance: ${userPrefs.rtAudiencePref || "N/A"}/10
    - Preferred genres (with your preference 1-10): ${
  userPrefs.genrePrefs && userPrefs.genrePrefs.length
    ? userPrefs.genrePrefs.map(g => `${g.name} (${g.preference})`).join(", ")
    : "None"
}
    - Oscar preferences (for this movie's nominations, 1-10): ${
  userPrefs.oscarPrefs && userPrefs.oscarPrefs.length
    ? userPrefs.oscarPrefs.map(o => `${o.category} (${o.preference})`).join(", ")
    : "None"
}
    
    The movie "${movieTitle}" has:
    - IMDb Rating: ${movieData.imdb?.rating || "N/A"}
    - RT Critic Score: ${movieData.rottenTomatoes?.criticScore || "N/A"}
    - RT Audience Score: ${movieData.rottenTomatoes?.audienceScore || "N/A"}
    - Genres: ${genres.join(", ") || "None"}
    ${oscarLine}

    The AI determined: ${shouldWatch}
    Provide a short explanation why the user should or should not watch this movie, considering their preferences and the movie's attributes.
    Speak to the user in second person.
    Don't go against the shouldIWatch decision.
    `;

    console.log("📌 Prompt sent to AI:", prompt);

    const result = await model.generateContent(prompt);
    console.log("📥 AI Response:", result.response.text());

    return {
        decision: shouldWatch,
        explanation: result.response.text().trim(),
    };
}

module.exports = { generateMovieDecision };
