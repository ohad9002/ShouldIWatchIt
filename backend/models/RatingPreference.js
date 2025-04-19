const mongoose = require('mongoose');

const ratingPreferenceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rtCritic: { type: Number, min: 1, max: 10, required: true },
    rtPopular: { type: Number, min: 1, max: 10, required: true },
    imdb: { type: Number, min: 1, max: 10, required: true }
}, { timestamps: true });

module.exports = mongoose.model('RatingPreference', ratingPreferenceSchema);
