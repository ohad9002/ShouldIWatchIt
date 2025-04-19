
require('dotenv').config();
const mongoose = require('mongoose');
const Genre = require('../models/Genre'); // Import the Genre model
const MONGO_URI = process.env.MONGO_URI;
const genres = [
    "Action", "Adventure", "Animation", "Anime", "Biography", "Comedy", "Crime", "Documentary",
    "Drama", "Entertainment", "Faith & Spirituality", "Fantasy", "Game Show", "LGBTQ+",
    "Health & Wellness", "History", "Holiday", "Horror", "House & Garden", "Kids & Family",
    "Music", "Musical", "Mystery & Thriller", "Nature", "News", "Reality", "Romance", "Sci-Fi",
    "Short", "Soap", "Special Interest", "Sports", "Stand-Up", "Talk Show", "Travel", "Variety",
    "War", "Western"
];

const populateGenres = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing genres
        await Genre.deleteMany({});
        console.log('✅ Cleared existing genres');

        // Insert new genres
        const genreDocs = genres.map((name) => ({ name }));
        await Genre.insertMany(genreDocs);
        console.log(`✅ Inserted ${genres.length} genres into the database`);

        // Close the connection
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    } catch (error) {
        console.error('❌ Error populating genres:', error);
        process.exit(1);
    }
};

populateGenres();