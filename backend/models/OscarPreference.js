const mongoose = require('mongoose');

const oscarPreferenceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Oscar', required: true },
    preference: { type: Number, min: 1, max: 10, required: true }
}, { timestamps: true });

module.exports = mongoose.model('OscarPreference', oscarPreferenceSchema);
