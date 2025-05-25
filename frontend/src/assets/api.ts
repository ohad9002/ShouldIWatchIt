// src/lib/api.ts

import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface Oscar {
  originalCategory: string;
  fullCategory: string;
  isWin: boolean;
}

export interface MovieData {
  imdb: {
    title: string;
    rating: string;
    image: string;
    url: string;
  };
  rottenTomatoes: {
    title: string;
    criticScore: string;
    audienceScore: string;
    genres: string[];
    releaseDate: string;
    image: string;
    url: string;
  };
  oscars: Oscar[];
  genres: string[];
}

export const fetchMovies = async (
  title: string,
  token?: string,
): Promise<MovieData> => {
  const finalToken = token ?? localStorage.getItem("authToken") ?? undefined;

  console.log(`📤 Sending request to /api/movies with title: ${title}`);
  console.log(`🌐 API_BASE_URL: ${API_BASE_URL}`);
  console.log(`🔑 Using token: ${finalToken ?? "none"}`);

  const headers: Record<string, string> = {};
  if (finalToken) {
    headers.Authorization = `Bearer ${finalToken}`;
  }

  try {
    const response = await axios.get<MovieData>(`${API_BASE_URL}/api/movies`, {
      params: { title },
      headers,
    });

    console.log("🎥 Movie data fetched:", response.data);

    // Ensure fullCategory is preserved (though the shape should already match)
    const cleaned = {
      ...response.data,
      oscars: response.data.oscars.map((o) => ({
        originalCategory: o.originalCategory,
        fullCategory: o.fullCategory,
        isWin: o.isWin,
      })),
    };

    return cleaned;
  } catch (error) {
    console.error("❌ Error fetching movies:", error);
    throw new Error("Failed to fetch movie data.");
  }
};

export interface DecisionResponse {
  movieData: MovieData;
  decision: string;
  explanation: string;
}

export const fetchMovieDecision = async (
  title: string,
  token?: string,
): Promise<DecisionResponse> => {
  const finalToken = token ?? localStorage.getItem("authToken") ?? undefined;

  console.log(
    `📤 Sending request to /api/movies/decision with title: ${title}`,
  );
  console.log(`🔑 Using token: ${finalToken ?? "none"}`);

  try {
    const response = await axios.get<{
      movieData: MovieData;
      decision: { decision: string; explanation?: string };
    }>(`${API_BASE_URL}/api/movies/decision`, {
      params: { movie: title },
      headers: { Authorization: `Bearer ${finalToken}` },
    });

    console.log(
      "📥 Received response from /api/movies/decision:",
      response.data,
    );

    const { movieData, decision } = response.data;
    const cleanedOscars = movieData.oscars.map((o) => ({
      originalCategory: o.originalCategory,
      fullCategory: o.fullCategory,
      isWin: o.isWin,
    }));

    return {
      movieData: { ...movieData, oscars: cleanedOscars },
      decision: decision.decision,
      explanation: decision.explanation ?? "No explanation provided.",
    };
  } catch (error) {
    console.error("❌ Error fetching AI decision:", error);
    throw new Error("Failed to fetch AI decision.");
  }
};
