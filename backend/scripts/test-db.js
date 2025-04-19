console.log("🚀 Running test-db.js...");
require('dotenv').config();
console.log("🛠️ ENV Loaded:", process.env.MONGO_URI ? "✅ Found" : "❌ Not Found");

const mongoose = require('mongoose');
const { User, RatingPreference, Genre, GenrePreference, Oscar, OscarPreference } = require('../models');

const mongoURI = process.env.MONGO_URI;

async function testDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected!');

        // Cleanup existing test user (optional)
        await User.deleteOne({ username: 'testuser' });

        // Create a test user
        const user = new User({
            name: 'Test User',
            username: 'testuser',
            password: 'password123'
        });
        await user.save();
        console.log('🆕 Created User:', user);

        // Create randomized Rating Preferences
        const ratingPreference = new RatingPreference({
            user: user._id,
            rtCritic: Math.floor(Math.random() * 10) + 1, // Random 1-10
            rtPopular: Math.floor(Math.random() * 10) + 1, // Random 1-10
            imdb: Math.floor(Math.random() * 10) + 1 // Random 1-10
        });
        await ratingPreference.save();
        console.log('🆕 Created Rating Preference:', ratingPreference);

        // Fetch all genres from the database
        const genres = await Genre.find();
        for (const genre of genres) {
            const genrePreference = new GenrePreference({
                user: user._id,
                genre: genre._id,
                preference: Math.floor(Math.random() * 10) + 1 // Random 1-10
            });
            await genrePreference.save();
            console.log(`🆕 Created Genre Preference for ${genre.name}:`, genrePreference.preference);
        }

        // Fetch all Oscar categories from the database
        const oscarCategories = await Oscar.find();
        for (const oscarCategory of oscarCategories) {
            const oscarPreference = new OscarPreference({
                user: user._id,
                category: oscarCategory._id,
                preference: Math.floor(Math.random() * 10) + 1 // Random 1-10
            });
            await oscarPreference.save();
            console.log(`🆕 Created Oscar Preference for ${oscarCategory.name}:`, oscarPreference.preference);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 MongoDB connection closed.');
    }
}

testDatabase();
