require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Make sure the path is correct

const SECRET_KEY = process.env.SECRET_KEY;
const MONGO_URI = process.env.MONGO_URI;

const createTestUserAndToken = async () => {
    try {
        await mongoose.connect(MONGO_URI, {});

        // Check if a test user already exists
        let user = await User.findOne({ username: 'testuser' });

        if (!user) {
            console.log('🔹 Creating a new test user...');
            user = new User({
                username: 'testuser',
                password: 'Test123!' // Password won't be used since we're generating a JWT manually
            });
            await user.save();
        } else {
            console.log('✅ Test user already exists.');
        }

        // Generate JWT
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '1h' });

        console.log(`\n🎫 **Use these credentials for testing:**`);
        console.log(`User ID: ${user._id}`);
        console.log(`JWT Token: ${token}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createTestUserAndToken();
