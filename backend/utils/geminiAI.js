require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateMovieDecision(movieData, userPrefs, finalScore) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const shouldWatch = finalScore >= 37 ? "Yes" : "No";

    const movieTitle = movieData.rottenTomatoes?.title || movieData.imdb?.title || "Unknown";

    const prompt = `
    The user has the following preferences:
    - IMDb importance: ${userPrefs.imdbPref || "N/A"}/10
    - RT critic importance: ${userPrefs.rtCriticPref || "N/A"}/10
    - RT audience importance: ${userPrefs.rtAudiencePref || "N/A"}/10
    - Preferred genres: ${userPrefs.genrePrefs?.map(g => g.name).join(", ") || "None"}
    - Oscar preferences: ${userPrefs.oscarPrefs?.map(o => o.category).join(", ") || "None"}
    
    The movie "${movieTitle}" has:
    - IMDb Rating: ${movieData.imdb?.rating || "N/A"}
    - RT Critic Score: ${movieData.rottenTomatoes?.criticScore || "N/A"}
    - RT Audience Score: ${movieData.rottenTomatoes?.audienceScore || "N/A"}
    - Genres: ${movieData.genres?.join(", ") || "None"}
    - Oscar Recognition: The movie has received significant recognition at the Oscars, including wins and nominations across multiple categories.

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
