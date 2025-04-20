const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getMovieDecision } = require('../services/movieService');
const { scrapeMovieDetails } = require('../utils/scrape');

const SECRET_KEY = process.env.SECRET_KEY;
const movieCache = {}; // In-memory cache for scraped movie data

// Route to fetch movie details (scraping only, no AI decision)
router.get('/', async (req, res) => {
    try {
        const { title } = req.query;
        console.log(`🔍 Incoming request to /api/movies with title: ${title}`);
        if (!title) {
            console.warn("⚠️ No movie title provided in query.");
            return res.status(400).json({ message: "Movie title is required" });
        }

        let movieData = movieCache[title];
        if (!movieData) {
            console.log("Scraping movie data...");
            movieData = await scrapeMovieDetails(title);
            if (!movieData || (!movieData.rottenTomatoes && !movieData.imdb && !movieData.oscars)) {
                console.warn("⚠️ Movie data not found.");
                return res.status(404).json({ message: "Movie data not found" });
            }
            movieCache[title] = movieData; // Cache the scraped data
        } else {
            console.log("Using cached movie data...");
        }

        console.log("✅ Movie data fetched successfully:", movieData);
        res.json({ movieData });
    } catch (error) {
        console.error("❌ Error in /api/movies route:", error);
        res.status(500).json({ message: "Error fetching movie details" });
    }
});

// Route to fetch AI decision (only for logged-in users)
router.get('/decision', async (req, res) => {
    try {
        const { movie } = req.query;
        if (!movie) {
            console.log("⚠️ No movie name provided in query.");
            return res.status(400).json({ message: "Movie name is required" });
        }

        console.log(`🔍 Fetching movie details for AI decision: ${movie}`);
        let movieData = movieCache[movie]; // Reuse cached data
        if (!movieData) {
            console.log("⚠️ Movie data not found in cache. Please fetch movie details first.");
            return res.status(400).json({ message: "Movie data not found in cache. Please fetch movie details first." });
        }

        console.log("✅ Movie data found in cache:", movieData);

        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            console.log("🔑 Extracted token:", token);
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                userId = decoded.userId;
                console.log("✅ Decoded JWT User ID:", userId);
            } catch (err) {
                console.warn("⚠️ Invalid JWT token provided:", err.message);
            }
        }

        if (!userId) {
            console.log("ℹ️ No user logged in. Returning movie data only.");
            return res.json({ message: "No user logged in", movieData });
        }

        console.log(`🤖 Running AI decision logic for user: ${userId}`);
        const decision = await getMovieDecision(userId, movieData);
        console.log("📊 AI Decision Generated:", decision);

        res.json({ movieData, decision });
    } catch (error) {
        console.error("❌ Error in movie decision route:", error);
        res.status(500).json({ message: "Error processing movie decision" });
    }
});

module.exports = router;
