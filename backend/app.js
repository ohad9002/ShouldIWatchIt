// 🌟 Import Dependencies
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');

// 🌟 Load Environment Variables
dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY;
const PORT = process.env.PORT || 5000;

// 🌟 Initialize Express App
const app = express();

// 🌟 Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected successfully!"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// 🌟 Middleware
app.use(express.static("public")); // Serve static files
app.use(cookieParser()); // Parse cookies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(express.json()); // Parse JSON data
app.use(
    cors({
        origin: 'http://localhost:5173', // Allow frontend requests
        credentials: true, // Allow cookies and auth headers if needed
    })
);

// 🔐 JWT Authentication Middleware
const authenticate = (req, res, next) => {
    console.log(`🔒 Received request for protected route: ${req.method} ${req.url}`);

    // Check token in Authorization header, body, or cookies
    const token =
        req.headers.authorization?.split(" ")[1] ||
        req.body.auth_token ||
        req.cookies.auth_token;

    if (!token) {
        return res.status(401).send('No token, access denied');
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send('Invalid or expired token');
        }
        req.user = decoded; // Attach user info
        next();
    });
};

// 🌟 Import Routes
const authRoutes = require('./routes/auth'); // Authentication routes
const movieRoutes = require('./routes/movies'); // Movie-related routes
const preferencesRoutes = require('./routes/preferences'); // Preferences routes

// 🌟 Use Routes
app.use('/api/auth', (req, res, next) => {
    console.log(`➡️ Received request on /api/auth: ${req.method} ${req.url}`);
    next();
}, authRoutes); // Register auth routes

app.use('/api/preferences', (req, res, next) => {
    console.log(`➡️ Received request on /api/preferences: ${req.method} ${req.url}`);
    next();
}, preferencesRoutes); // Register preferences routes

app.use('/api/movies', (req, res, next) => {
    console.log(`➡️ Received request on /api/movies: ${req.method} ${req.url}`);
    next();
}, movieRoutes); // Register movie routes

// 🌟 Start the Server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
