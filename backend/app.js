// 🌟 Import Dependencies
const express       = require('express');
const jwt           = require('jsonwebtoken');
const cookieParser  = require('cookie-parser');
const dotenv        = require('dotenv');
const mongoose      = require('mongoose');
const cors          = require('cors');

// 🌟 Load Environment Variables
dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY;
const PORT       = process.env.PORT || 5000;  // ← bind to Render’s PORT

// 🌟 Initialize Express App
console.log('🟢 [app.js] starting up…');
const app = express();

// 🌟 Health-check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// 🌟 Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully!"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// 🌟 Middleware
app.use(express.static("public"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));

// 🔐 JWT Authentication Middleware
const authenticate = (req, res, next) => {
  console.log(`🔒 Received request for protected route: ${req.method} ${req.url}`);
  const token =
    req.headers.authorization?.split(" ")[1] ||
    req.body.auth_token ||
    req.cookies.auth_token;

  if (!token) return res.status(401).send('No token, access denied');
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).send('Invalid or expired token');
    req.user = decoded;
    next();
  });
};

// 🌟 Import Routes
const authRoutes        = require('./routes/auth');
const movieRoutes       = require('./routes/movies');
const preferencesRoutes = require('./routes/preferences');

// 🌟 Use Routes
app.use('/api/auth', (req, res, next) => {
  console.log(`➡️ Received request on /api/auth: ${req.method} ${req.url}`);
  next();
}, authRoutes);

app.use('/api/preferences', (req, res, next) => {
  console.log(`➡️ Received request on /api/preferences: ${req.method} ${req.url}`);
  next();
}, preferencesRoutes);

app.use('/api/movies', authenticate, (req, res, next) => {
  console.log(`➡️ Received request on /api/movies: ${req.method} ${req.url}`);
  next();
}, movieRoutes);

// 🌟 Start the Server (bind to 0.0.0.0 so Docker/Render can reach it)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${PORT}`);
});

module.exports = app;
