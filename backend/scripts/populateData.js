require('dotenv').config();
const mongoose = require('mongoose');
const Oscar = require('../models/Oscar');
const Genre = require('../models/Genre'); // Assuming this is your Genre model

const MONGO_URI = process.env.MONGO_URI;

const oscarCategories = [
    "Best Picture", "Best Director", "Best Actor", "Best Actress",
    "Best Supporting Actor", "Best Supporting Actress",
    "Best Original Screenplay", "Best Adapted Screenplay",
    "Best Cinematography", "Best Film Editing", "Best Production Design",
    "Best Costume Design", "Best Makeup and Hairstyling",
    "Best Visual Effects", "Best Sound", "Best Original Score",
    "Best Original Song", "Best Animated Feature", "Best International Feature",
    "Best Documentary Feature", "Best Documentary Short",
    "Best Animated Short", "Best Live Action Short"
];

const genres = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
    "Drama", "Family", "Fantasy", "History", "Horror", "Music",
    "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western"
];

async function populateData() {
    if (!MONGO_URI) {
        console.error('Error: MONGO_URI is not defined in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);

        // Populate Oscars
        await Oscar.deleteMany({});
        console.log('Cleared existing Oscar categories.');
        await Oscar.insertMany(oscarCategories.map(name => ({ name })));
        console.log('Inserted Oscar categories.');

        // Populate Genres
        await Genre.deleteMany({});
        console.log('Cleared existing genres.');
        await Genre.insertMany(genres.map(name => ({ name })));
        console.log('Inserted genres.');

        mongoose.connection.close();
    } catch (error) {
        console.error('Error populating data:', error);
        mongoose.connection.close();
    }
}

populateData();
