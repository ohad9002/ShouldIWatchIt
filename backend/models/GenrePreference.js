const mongoose = require('mongoose');

const genrePreferenceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    genre: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre', required: true },
    preference: { type: Number, min: 1, max: 10, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GenrePreference', genrePreferenceSchema);
