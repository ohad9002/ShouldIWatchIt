import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore.ts";
import ButtonRating from "../components/ButtonRating.tsx";

type Genre = {
  _id: string;
  name: string;
};

type Oscar = {
  _id: string;
  name: string;
};

const Preferences = () => {
  const { user } = useAuthStore();
  const [ratings, setRatings] = useState<{ rtCritic: number; rtPopular: number; imdb: number }>({
    rtCritic: 5,
    rtPopular: 5,
    imdb: 5,
  });
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genrePreferences, setGenrePreferences] = useState<Record<string, number>>({});
  const [oscars, setOscars] = useState<Oscar[]>([]);
  const [oscarPreferences, setOscarPreferences] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const userId = user?.userId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.token) {
          throw new Error("No token available");
        }

        const optionsResponse = await axios.get("http://localhost:5000/api/preferences/options", {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        setGenres(optionsResponse.data.genres);
        setOscars(optionsResponse.data.oscars);

        const preferencesResponse = await axios.get(`http://localhost:5000/api/preferences/${userId}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        const { ratings, genres, oscars } = preferencesResponse.data;

        setRatings(ratings);
        setGenrePreferences(genres);
        setOscarPreferences(oscars);
      } catch (error) {
        console.error("Error fetching preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userId]);

  const handleRatingChange = (key: keyof typeof ratings, value: number) => {
    setRatings({ ...ratings, [key]: value });
  };

  const handleGenreChange = (id: string, value: number) => {
    setGenrePreferences({ ...genrePreferences, [id]: value });
  };

  const handleOscarChange = (id: string, value: number) => {
    setOscarPreferences({ ...oscarPreferences, [id]: value });
  };

  const handleSubmit = async () => {
    try {
      if (!user?.token) {
        throw new Error("No token available");
      }

      await axios.post(
        "http://localhost:5000/api/preferences/rating",
        { ...ratings },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      await axios.post(
        "http://localhost:5000/api/preferences/genre",
        { genres: genrePreferences },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      await axios.post(
        "http://localhost:5000/api/preferences/oscar",
        { categories: oscarPreferences },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      alert("Preferences saved successfully!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences. Please try again.");
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{
        backgroundColor: "var(--bg-color)", // Use dark mode background
        color: "var(--text-color)", // Use dark mode text color
      }}
    >
      <h1
        className="text-3xl font-bold mb-6"
        style={{ color: "var(--primary-color)" }}
      >
        Preferences
      </h1>
      <p>
        Please rate from 1 - lowest to 10 - highest, how important it is for you
        that any movie in general will have the following:
      </p>

      {/* Ratings Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Ratings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Rotten Tomatoes (Critic):</label>
            <ButtonRating
              value={ratings.rtCritic}
              onChange={(value: number) => handleRatingChange("rtCritic", value)}
            />
          </div>
          <div>
            <label>Rotten Tomatoes (Popular):</label>
            <ButtonRating
              value={ratings.rtPopular}
              onChange={(value: number) => handleRatingChange("rtPopular", value)}
            />
          </div>
          <div>
            <label>IMDB:</label>
            <ButtonRating
              value={ratings.imdb}
              onChange={(value: number) => handleRatingChange("imdb", value)}
            />
          </div>
        </div>
      </section>

      {/* Genres Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Genres</h2>
        <div className="grid grid-cols-2 gap-4">
          {genres.map((genre) => (
            <div key={genre._id}>
              <label>{genre.name}:</label>
              <ButtonRating
                value={genrePreferences[genre._id] || 5}
                onChange={(value: number) => handleGenreChange(genre._id, value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Oscars Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Oscars</h2>
        <div className="grid grid-cols-2 gap-4">
          {oscars.map((oscar) => (
            <div key={oscar._id}>
              <label>{oscar.name}:</label>
              <ButtonRating
                value={oscarPreferences[oscar._id] || 5}
                onChange={(value: number) => handleOscarChange(oscar._id, value)}
              />
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={handleSubmit}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 transition"
      >
        Save Preferences
      </button>
    </div>
  );
};

export default Preferences;