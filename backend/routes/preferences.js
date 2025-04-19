const express = require('express');
const { RatingPreference, OscarPreference, GenrePreference } = require('../models');
const Genre = require('../models/Genre');
const Oscar = require('../models/Oscar');
const authenticate = require('../middleware/authMiddleware'); // Import the authentication middleware
const router = express.Router();

// Fetch all genres and Oscars
router.get('/options', authenticate, async (req, res) => {
    try {
        const genres = await Genre.find();
        const oscars = await Oscar.find();
        res.json({ genres, oscars });
    } catch (error) {
        console.error("Error fetching genres and Oscars:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch user preferences
router.get('/:userId', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId; // Use the user ID from the decoded token
        console.log(`🔍 Fetching preferences for user: ${userId}`);

        // Fetch ratings, genres, and Oscars preferences
        const ratingPreference = await RatingPreference.findOne({ user: userId });
        const genrePreference = await GenrePreference.find({ user: userId }); // Fetch all genre preferences
        const oscarPreference = await OscarPreference.find({ user: userId }); // Fetch all Oscar preferences

        console.log("🎯 Rating Preferences:", ratingPreference);
        console.log("🎬 Genre Preferences:", genrePreference);
        console.log("🎭 Oscar Preferences:", oscarPreference);

        if (!ratingPreference && !genrePreference.length && !oscarPreference.length) {
            console.warn("⚠️ No preferences found for user:", userId);
        }

        // Default genre and Oscar preferences to 5 if not set
        const genres = await Genre.find();
        const oscars = await Oscar.find();

        const genrePreferences = genres.reduce((acc, genre) => {
            const userGenrePref = genrePreference.find((pref) => pref.genre.toString() === genre._id.toString());
            acc[genre._id] = userGenrePref ? userGenrePref.preference : 5;
            return acc;
        }, {});

        const oscarPreferences = oscars.reduce((acc, oscar) => {
            const userOscarPref = oscarPreference.find((pref) => pref.category.toString() === oscar._id.toString());
            acc[oscar._id] = userOscarPref ? userOscarPref.preference : 5;
            return acc;
        }, {});

        res.json({
            ratings: ratingPreference || { rtCritic: 5, rtPopular: 5, imdb: 5 },
            genres: genrePreferences,
            oscars: oscarPreferences,
        });
    } catch (error) {
        console.error("❌ Error fetching user preferences:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Save Rating Preferences
router.post('/rating', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId; // Use the user ID from the decoded token
        const { rtCritic, rtPopular, imdb } = req.body;

        console.log(`🔄 Saving rating preferences for user: ${userId}`);

        await RatingPreference.findOneAndUpdate(
            { user: userId }, // Match by user ID
            { $set: { rtCritic, rtPopular, imdb, user: userId } }, // Explicitly set the user field
            { upsert: true, new: true }
        );
        res.json({ message: 'Rating preferences saved' });
    } catch (error) {
        console.error("Error saving rating preferences:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Save Genre Preferences
router.post('/genre', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId; // Use the user ID from the decoded token
        const { genres } = req.body; // `genres` is an object with genre IDs as keys and preferences as values

        console.log(`🔄 Saving genre preferences for user: ${userId}`);

        const bulkOps = Object.entries(genres).map(([genreId, preference]) => ({
            updateOne: {
                filter: { user: userId, genre: genreId },
                update: { $set: { preference } },
                upsert: true, // Create a new document if it doesn't exist
            },
        }));

        await GenrePreference.bulkWrite(bulkOps); // Perform bulk updates
        res.json({ message: 'Genre preferences saved' });
    } catch (error) {
        console.error("Error saving genre preferences:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Save Oscar Preferences
router.post('/oscar', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId; // Use the user ID from the decoded token
        const { categories } = req.body; // `categories` is an object with category IDs as keys and preferences as values

        console.log(`🔄 Saving Oscar preferences for user: ${userId}`);

        const bulkOps = Object.entries(categories).map(([categoryId, preference]) => ({
            updateOne: {
                filter: { user: userId, category: categoryId },
                update: { $set: { preference } },
                upsert: true, // Create a new document if it doesn't exist
            },
        }));

        await OscarPreference.bulkWrite(bulkOps); // Perform bulk updates
        res.json({ message: 'Oscar preferences saved' });
    } catch (error) {
        console.error("Error saving Oscar preferences:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
