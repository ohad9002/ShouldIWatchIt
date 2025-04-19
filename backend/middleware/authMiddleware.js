// filepath: c:\Users\ohadm\Desktop\Code\Fullstack\Project5\ShouldIWatchIt\backend\middleware\authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header
    if (!token) {
        console.warn('⚠️ Unauthorized: No token provided');
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY); // Verify the token using the secret key
        req.user = { userId: decoded.userId }; // Attach the decoded userId to the request object
        console.log('✅ User authenticated:', req.user); // Log the decoded user information
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('❌ Authentication error:', error.message); // Log the error message
        res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
    }
};

module.exports = authenticate;