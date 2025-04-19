import axios from "axios";

const API_BASE_URL = 'http://localhost:5000';

export const fetchMovies = async (title: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/movies`, {
      params: { title },
    });
    console.log("🎥 Movie data fetched:", response.data);

    // Ensure `fullCategory` is preserved in the Oscars data
    const movieData = response.data.movieData;
    if (movieData.oscars && Array.isArray(movieData.oscars)) {
      movieData.oscars = movieData.oscars.map(
        (oscar: { originalCategory: string; fullCategory: string; isWin: boolean }) => ({
          originalCategory: oscar.originalCategory,
          fullCategory: oscar.fullCategory, // Include fullCategory
          isWin: oscar.isWin,
        })
      );
    }

    return movieData;
  } catch (error) {
    console.error("Error fetching movies:", error);
    throw new Error("Failed to fetch movie data."); // Throw an error to handle it in the calling function
  }
};

export const fetchMovieDecision = async (title: string, token: string) => {
  try {
    console.log(`📤 Sending request to /api/movies/decision with title: ${title}`);
    const response = await axios.get(`${API_BASE_URL}/api/movies/decision`, {
      params: { movie: title }, // Pass the movie title as a query parameter
      headers: {
        Authorization: `Bearer ${token}`, // Include the token in the Authorization header
      },
    });
    console.log("📥 Received response from /api/movies/decision:", response.data);

    // Ensure `fullCategory` is preserved in the Oscars data
    const movieData = response.data.movieData;
    if (movieData.oscars && Array.isArray(movieData.oscars)) {
      movieData.oscars = movieData.oscars.map(
        (oscar: { originalCategory: string; fullCategory: string; isWin: boolean }) => ({
          originalCategory: oscar.originalCategory,
          fullCategory: oscar.fullCategory, // Include fullCategory
          isWin: oscar.isWin,
        })
      );
    }

    // Destructure decision and explanation from response.data.decision
    const { decision, explanation } = response.data.decision;

    return {
      movieData,
      decision,
      explanation: explanation || "No explanation provided.", // Add explanation fallback
    };
  } catch (error) {
    console.error("❌ Error fetching AI decision:", error);
    throw new Error("Failed to fetch AI decision."); // Throw an error to handle it in the calling function
  }
};
