const mongoose = require('mongoose');

const oscarSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Oscar', oscarSchema);

// Add these categories to the database if they don't already exist
const initializeOscars = async () => {
    const categories = [
        "Best Original Score",
        "Sound Editing",
        "Sound Mixing",
        "Art Direction"
    ];

    for (const category of categories) {
        const exists = await mongoose.model('Oscar').findOne({ name: category });
        if (!exists) {
            await mongoose.model('Oscar').create({ name: category });
            console.log(`✅ Added missing Oscar category: ${category}`);
        }
    }
};

initializeOscars();
