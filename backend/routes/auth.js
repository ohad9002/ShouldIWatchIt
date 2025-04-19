const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const RatingPreference = require('../models/RatingPreference');
const GenrePreference = require('../models/GenrePreference');
const OscarPreference = require('../models/OscarPreference');
const Genre = require('../models/Genre'); // Added Genre model
const Oscar = require('../models/Oscar'); // Added Oscar model
const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Include user._id in the JWT payload
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({ token, username: user.username });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Registration route
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Create the new user
        const newUser = new User({ username, password });
        await newUser.save();

        console.log(`✅ New user created: ${newUser._id}`);

        // Fetch all genres and Oscar categories
        const genres = await Genre.find();
        const oscars = await Oscar.find();

        console.log(`🎬 Found ${genres.length} genres`);
        console.log(`🏆 Found ${oscars.length} Oscar categories`);

        // Ensure the correct number of genres and Oscars
        if (genres.length !== 38) {
            console.warn(`⚠️ Expected 38 genres but found ${genres.length}`);
        }
        if (oscars.length !== 23) {
            console.warn(`⚠️ Expected 23 Oscars but found ${oscars.length}`);
        }

        // Create default genre preferences for the user
        const genrePreferences = genres.map((genre) => ({
            user: newUser._id,
            genre: genre._id,
            preference: 5, // Default preference
        }));
        await GenrePreference.insertMany(genrePreferences);
        console.log(`✅ Created ${genrePreferences.length} genre preferences for user: ${newUser._id}`);

        // Create default Oscar preferences for the user
        const oscarPreferences = oscars.map((oscar) => ({
            user: newUser._id,
            category: oscar._id,
            preference: 5, // Default preference
        }));
        await OscarPreference.insertMany(oscarPreferences);
        console.log(`✅ Created ${oscarPreferences.length} Oscar preferences for user: ${newUser._id}`);

        // Include user._id in the JWT payload
        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username },
            process.env.SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({ token, username: newUser.username });
    } catch (error) {
        console.error('❌ Error during registration:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user route
router.post('/delete', async (req, res) => {
    const { username, password } = req.body;

    console.log(`🗑️ Delete request received for username: ${username}`); // Log the request

    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.warn(`⚠️ User not found: ${username}`);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`🔑 Verifying password for username: ${username}`);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`⚠️ Invalid password for username: ${username}`);
            return res.status(401).json({ message: 'Invalid password' });
        }

        console.log(`✅ Deleting user and associated data for username: ${username}`);
        await RatingPreference.deleteMany({ user: user._id });
        await GenrePreference.deleteMany({ user: user._id });
        await OscarPreference.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });

        console.log(`🗑️ Successfully deleted user: ${username}`);
        res.status(200).json({ message: 'User and associated data deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;