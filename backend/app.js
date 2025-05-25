// app.js

// 🌟 Import Dependencies
const express      = require('express');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv       = require('dotenv');
const mongoose     = require('mongoose');
const cors         = require('cors');

// 🌟 Load Environment Variables
dotenv.config();
const SECRET_KEY    = process.env.SECRET_KEY;
const PORT          = process.env.PORT      || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
                      || 'https://shouldiwatchit.onrender.com';

console.log('🟢 [app.js] starting up…');

// 🌟 Initialize Express App
const app = express();

// ── GLOBAL CORS & PRE-FLIGHT ───────────────────────────────────────────────────
// allow your front end origin, expose headers, and answer OPTIONS requests
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}));
app.options('*', cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}));

// make sure the preflight can include our headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers',
             'Origin, X-Requested-With, Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods',
             'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// ── BODY PARSERS, STATIC, COOKIES ─────────────────────────────────────────────
app.use(express.static('public'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🌟 Health-check endpoint (public)
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// 🌟 Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 🔐 JWT Authentication Middleware
const authenticate = (req, res, next) => {
  console.log(`🔒 Received request for protected route: ${req.method} ${req.url}`);
  const token = req.headers.authorization?.split(' ')[1]
               || req.body.auth_token
               || req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ message: 'No token, access denied' });
  }
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    console.log('✅ User authenticated:', decoded);
    next();
  });
};

// 🌟 Import Routes
const authRoutes        = require('./routes/auth');
const movieRoutes       = require('./routes/movies');
const preferencesRoutes = require('./routes/preferences');

// ── ROUTING ────────────────────────────────────────────────────────────────────
// Public auth endpoints
app.use('/api/auth', (req, res, next) => {
  console.log(`➡️ /api/auth ${req.method} ${req.url}`);
  next();
}, authRoutes);

// Protected preferences
app.use('/api/preferences', authenticate, (req, res, next) => {
  console.log(`➡️ /api/preferences ${req.method} ${req.url}`);
  next();
}, preferencesRoutes);

// Movies: search is public, decision is protected inside the router
app.use('/api/movies', (req, res, next) => {
  console.log(`➡️ /api/movies ${req.method} ${req.url}`);
  next();
}, movieRoutes);

// 🌟 Start the Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${PORT}`);
});

module.exports = app;
