import { useState, useEffect } from "react";
import { fetchMovieDecision, fetchMovies } from "../assets/api";
import useAuthStore from "../store/authStore.ts";
import PopcornLoader from "../components/PopcornLoader.tsx"; // Import the PopcornLoader component

type Movie = {
  rottenTomatoes?: {
    title: string;
    image: string;
    criticScore: string;
    audienceScore: string;
    genres: string[];
    releaseDate: string;
  };
  imdb?: {
    title: string;
    rating: string;
    genres: string[];
    url: string;
  };
  oscars: { originalCategory: string; fullCategory: string; isWin: boolean }[]; // Add fullCategory
};

const Home = ({ resetTrigger }: { resetTrigger: boolean }) => {
  const { user } = useAuthStore();
  const [movieData, setMovieData] = useState<Movie | null>(null);
  const [query, setQuery] = useState("");
  const [aiDecision, setAiDecision] = useState<{ decision: string; explanation: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the Home page state when resetTrigger changes
  useEffect(() => {
    console.log("🔄 Resetting Home state due to resetTrigger change.");
    setMovieData(null);
    setQuery("");
    setAiDecision(null);
    setIsLoading(false);
    setError(null);
  }, [resetTrigger]);

  // Log `aiDecision` whenever it changes
  useEffect(() => {
    if (aiDecision) {
      console.log("🤖 AI Decision updated:", aiDecision);
    }
  }, [aiDecision]);

  const handleSearch = async () => {
    console.log("🔍 Starting search for movie:", query);
    setError(null);
    setIsLoading(true);
    try {
      if (!query) {
        console.warn("⚠️ No query provided. Prompting user to enter a movie title.");
        setError("Please enter a movie title.");
        return;
      }

      console.log("📤 Sending request to fetchMovies with query:", query);
      const movieResponse = await fetchMovies(query);
      console.log("📥 Movie data received from fetchMovies:", movieResponse);

      if (!movieResponse) {
        console.error("❌ No movie data received from fetchMovies.");
        throw new Error("Failed to fetch movie data.");
      }

      setMovieData(movieResponse);

      if (user?.token) {
        console.log("🔑 User is logged in. Fetching AI decision...");
        const decisionResponse = await fetchMovieDecision(query, user.token);
        console.log("📥 AI Decision received from fetchMovieDecision:", decisionResponse);

        setAiDecision({
          decision: decisionResponse.decision,
          explanation: decisionResponse.explanation,
        });
      } else {
        console.log("ℹ️ User is not logged in. Skipping AI decision fetch.");
      }
    } catch (error) {
      console.error("❌ Error during handleSearch:", error);
      if (error instanceof Error) {
        setError(error.message || "Failed to fetch movie or AI decision. Please try again.");
      } else {
        setError("Failed to fetch movie or AI decision. Please try again.");
      }
    } finally {
      console.log("✅ Search process completed.");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: "var(--bg-color)",
        color: "var(--text-color)",
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      ></div>
      {/* Content */}
      <div className="relative z-20 p-6">
        <h2
          className="text-3xl font-bold mb-4"
          style={{ color: "var(--primary-color)" }}
        >
          Welcome to ShouldIWatchIt
        </h2>
        {user && <p className="mb-4">Welcome, {user.username}!</p>}
        {/* Search Input and Button */}
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter movie title..."
            className="flex-1 p-2 rounded border focus:outline-none"
            style={{
              backgroundColor: "var(--secondary-color)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 rounded hover:opacity-80 transition"
            style={{
              backgroundColor: "var(--primary-color)",
              color: "var(--text-color)",
            }}
          >
            Search
          </button>
        </div>
        {isLoading && <PopcornLoader />}
        {error && <p style={{ color: "var(--primary-color)" }}>{error}</p>}
        {movieData && (
          <div className="mt-6">
            {aiDecision && (
              <div className="mb-6">
                <p
                  className="text-xl font-bold"
                  style={{ color: "var(--primary-color)" }}
                >
                  AI Decision: {aiDecision.decision}
                </p>
                <p>{aiDecision.explanation}</p>
              </div>
            )}
            <h3 className="text-2xl font-bold">{movieData.rottenTomatoes?.title || "Unknown"}</h3>
            {movieData.rottenTomatoes?.image ? (
              <img
                src={movieData.rottenTomatoes.image}
                alt={movieData.rottenTomatoes.title}
                className="w-48 my-4"
              />
            ) : (
              <p>No image available</p>
            )}
            <p>IMDb: {movieData.imdb?.rating || "N/A"}</p>
            <p>RT Critics: {movieData.rottenTomatoes?.criticScore || "N/A"}</p>
            <p>RT Audience: {movieData.rottenTomatoes?.audienceScore || "N/A"}</p>
            <p>
              <strong>Release Date:</strong> {movieData.rottenTomatoes?.releaseDate || "N/A"}
            </p>
            <p>
              <strong>Genres:</strong>{" "}
              {movieData.rottenTomatoes?.genres?.length
                ? movieData.rottenTomatoes.genres.join(", ")
                : "N/A"}
            </p>
            {movieData.oscars.length > 0 ? (
              <div>
                <h4 className="text-xl font-bold mt-4">Oscar Awards</h4>
                <ul>
                  {movieData.oscars.map((oscar, index) => (
                    <li key={index}>
                      <strong>{oscar.fullCategory}</strong>{" "}
                      {oscar.isWin ? "🏆 Winner" : "🎖️ Nominated"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No Oscar nominations or wins.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;