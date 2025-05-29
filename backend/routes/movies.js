// routes/movies.js

const express   = require('express');
const jwt       = require('jsonwebtoken');
const router    = express.Router();

const { scrapeMovieDetails } = require('../utils/scrapeMovieDetails');
const { getMovieDecision  } = require('../services/movieService');

const SECRET_KEY = process.env.SECRET_KEY;
const movieCache = {};  // in-memory cache

// ─── GET /api/movies?title=… ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const title = req.query.title;
    console.log(`🔍 Incoming request to /api/movies with title: ${title}`);
    if (!title) {
      console.warn("⚠️ No movie title provided in query.");
      return res.status(400).json({ message: "Movie title is required" });
    }

    let movieData = movieCache[title];
    if (!movieData) {
      console.log("📦 Scraping movie data…");
      movieData = await scrapeMovieDetails(title);

      if (!movieData || (!movieData.imdb && !movieData.rottenTomatoes && !movieData.oscars)) {
        console.warn("⚠️ Movie data not found.");
        return res.status(404).json({ message: "Movie data not found" });
      }

      movieCache[title] = movieData;
    } else {
      console.log("📦 Using cached movie data");
    }

    console.log("✅ Movie data fetched successfully:", movieData);
   res.json(movieData);

  } catch (err) {
    console.error("❌ Error in /api/movies route:", err);
    res.status(500).json({ message: "Error fetching movie details" });
  }
});

// ─── GET /api/movies/decision?movie=… ─────────────────────────────────
router.get('/decision', async (req, res) => {
  try {
    const movieKey = req.query.movie;
    console.log(`🔍 Incoming request to /api/movies/decision with movie: ${movieKey}`);
    if (!movieKey) {
      console.warn("⚠️ No movie name provided in query.");
      return res.status(400).json({ message: "Movie name is required" });
    }

    const movieData = movieCache[movieKey];
    if (!movieData) {
      console.warn("⚠️ Movie data not found in cache. Fetch details first.");
      return res.status(400).json({
        message: "Movie data not found in cache. Please fetch movie details first."
      });
    }

    // Extract userId from Bearer token (if present)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      console.log("🔑 Extracted token:", token.slice(0,10), "…");
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.userId;
        console.log("✅ Decoded JWT userId:", userId);
      } catch (e) {
        console.warn("⚠️ Invalid JWT token:", e.message);
      }
    }

    if (!userId) {
      console.log("ℹ️ No valid user JWT present. Returning movie data only.");
      return res.json({ message: "No user logged in", movieData });
    }

    console.log(`🤖 Generating AI decision for user ${userId}…`);
    const decision = await getMovieDecision(userId, movieData);
    console.log("📊 AI decision:", decision);

    res.json({ movieData, decision });

  } catch (err) {
    console.error("❌ Error in /api/movies/decision route:", err);
    res.status(500).json({ message: "Error processing movie decision" });
  }
});

module.exports = router;
