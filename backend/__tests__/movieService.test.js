const { getMovieDecision } = require("../services/movieService");
const RatingPreference = require("../models/RatingPreference");
const GenrePreference = require("../models/GenrePreference");
const OscarPreference = require("../models/OscarPreference");
const { generateMovieDecision } = require("../utils/geminiAI");

jest.mock("../models/RatingPreference");
jest.mock("../models/GenrePreference");
jest.mock("../models/OscarPreference");
jest.mock("../utils/geminiAI");

describe("getMovieDecision", () => {
  const userId = "123";

  const mockMovieData = {
    imdb: { rating: "7.5" },
    rottenTomatoes: {
      criticScore: "85%",
      audienceScore: "90%"
    },
    genres: ["Drama", "Thriller"],
    oscars: [
      { originalCategory: "Best Picture", isWin: true }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    generateMovieDecision.mockResolvedValue({ decision: "Yes", reason: "High ratings and strong Oscar performance." });
  });

  it("should calculate final score and return AI decision", async () => {
    RatingPreference.findOne.mockResolvedValue({ imdb: 8, rtCritic: 7, rtPopular: 6 });
    GenrePreference.find.mockResolvedValue([
      { genre: { name: "Drama" }, preference: 9 },
      { genre: { name: "Thriller" }, preference: 7 }
    ]);
    OscarPreference.find.mockResolvedValue([
      { category: { name: "Best Picture" }, preference: 10 }
    ]);

    const result = await getMovieDecision(userId, mockMovieData);

    expect(result).toEqual({
      decision: "Yes",
      reason: "High ratings and strong Oscar performance."
    });

    expect(generateMovieDecision).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it("should use default rating values if none are found", async () => {
    RatingPreference.findOne.mockResolvedValue(null);
    GenrePreference.find.mockResolvedValue([]);
    OscarPreference.find.mockResolvedValue([]);

    const result = await getMovieDecision(userId, mockMovieData);

    expect(result).toBeDefined();
    expect(generateMovieDecision).toHaveBeenCalled();
  });

  it("should handle movies with no genres", async () => {
    RatingPreference.findOne.mockResolvedValue({ imdb: 7, rtCritic: 7, rtPopular: 7 });
    GenrePreference.find.mockResolvedValue([]);
    OscarPreference.find.mockResolvedValue([]);

    const movieWithoutGenres = { ...mockMovieData, genres: [] };
    const result = await getMovieDecision(userId, movieWithoutGenres);

    expect(result).toBeDefined();
    expect(generateMovieDecision).toHaveBeenCalled();
  });

  it("should handle missing Rotten Tomatoes or IMDb scores", async () => {
    RatingPreference.findOne.mockResolvedValue({ imdb: 7, rtCritic: 7, rtPopular: 7 });
    GenrePreference.find.mockResolvedValue([]);
    OscarPreference.find.mockResolvedValue([]);

    const incompleteRatingsMovie = {
      ...mockMovieData,
      imdb: {},
      rottenTomatoes: {}
    };

    const result = await getMovieDecision(userId, incompleteRatingsMovie);

    expect(result).toBeDefined();
    expect(generateMovieDecision).toHaveBeenCalled();
  });

  it("should throw an error if something fails", async () => {
    RatingPreference.findOne.mockRejectedValue(new Error("Database error"));

    await expect(getMovieDecision(userId, mockMovieData)).rejects.toThrow("Failed to get movie decision.");
  });
});
