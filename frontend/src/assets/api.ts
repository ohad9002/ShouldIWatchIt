import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const fetchMovies = async (title: string, token: string) => {
  console.log(`📤 Sending request to /api/movies with title: ${title}`);
  console.log(`🌐 API_BASE_URL: ${API_BASE_URL}`);
  console.log(`🔑 Using token: ${token}`);

  try {
    const response = await axios.get(`${API_BASE_URL}/api/movies`, {
      params: { title },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("🎥 Movie data fetched:", response.data);

    const movieData = response.data.movieData;
    if (movieData.oscars && Array.isArray(movieData.oscars)) {
      movieData.oscars = movieData.oscars.map(
        (oscar: {
          originalCategory: string;
          fullCategory: string;
          isWin: boolean;
        }) => ({
          originalCategory: oscar.originalCategory,
          fullCategory: oscar.fullCategory,
          isWin: oscar.isWin,
        })
      );
    }

    return movieData;
  } catch (error) {
    console.error("❌ Error fetching movies:", error);
    throw new Error("Failed to fetch movie data.");
  }
};

export const fetchMovieDecision = async (title: string, token: string) => {
  console.log(`📤 Sending request to /api/movies/decision with title: ${title}`);
  console.log(`🔑 Using token: ${token}`);

  try {
    const response = await axios.get(`${API_BASE_URL}/api/movies/decision`, {
      params: { movie: title },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("📥 Received response from /api/movies/decision:", response.data);

    const movieData = response.data.movieData;
    if (movieData.oscars && Array.isArray(movieData.oscars)) {
      movieData.oscars = movieData.oscars.map(
        (oscar: {
          originalCategory: string;
          fullCategory: string;
          isWin: boolean;
        }) => ({
          originalCategory: oscar.originalCategory,
          fullCategory: oscar.fullCategory,
          isWin: oscar.isWin,
        })
      );
    }

    const { decision, explanation } = response.data.decision;

    return {
      movieData,
      decision,
      explanation: explanation || "No explanation provided.",
    };
  } catch (error) {
    console.error("❌ Error fetching AI decision:", error);
    throw new Error("Failed to fetch AI decision.");
  }
};
