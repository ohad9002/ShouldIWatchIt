// controllers/moviesController.js

const { scrapeMovieDetails } = require('../utils/scrapers/scrapeMovieDetails');

async function getMovieDetails(req, res) {
  const title = req.query.title;
  if (!title) {
    return res.status(400).json({ error: 'Missing required ?title= query parameter' });
  }

  try {
    console.log(`📦 [moviesController] Fetching details for "${title}"`);
    // scrape movie details (IMDb, RT, Oscars)
    const movieData = await scrapeMovieDetails(title);

    // return 200 + JSON
    return res.json(movieData);
  } catch (err) {
    console.error('❌ [moviesController] Error in getMovieDetails:', err);
    return res.status(500).json({ error: 'Failed to fetch movie details' });
  }
}

module.exports = {
  getMovieDetails,
};
