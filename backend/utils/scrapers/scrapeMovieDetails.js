const { chromium }       = require('playwright');
const { scrapeRT }       = require('./scrapeRT');
const { fetchOMDb }      = require('./fetchOMDb');
const { scrapeOscars }   = require('./scrapeOscars');
const { normalizeGenre } = require('../normalization');

//console.log(`📍 [scrapeMovieDetails] loading IMDb scraper from: ${require.resolve('./scrapers/scrapeIMDb')}`);

async function scrapeMovieDetails(title) {
  console.log(`🔍 scrapeMovieDetails("${title}")`);
  const data = { imdb: null, rottenTomatoes: null, oscars: [], genres: [] };
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page    = await browser.newPage();
  try {
    // —— Rotten Tomatoes
    data.rottenTomatoes = await scrapeRT(page, title);

    // —— OMDb (instead of IMDb)
    data.imdb = await fetchOMDb(title);

    // —— Oscars (only if we got an IMDb title back)
    if (data.imdb?.title && data.imdb.title !== 'N/A') {
      try {
        console.log("📌 scrapeOscars…");
        data.oscars = await scrapeOscars(page, data.imdb.title);
      } catch (e) {
        console.error("❌ scrapeOscars failed:", e);
      }
    }

    // —— Merge & normalize genres
    const allGenres = [
      ...(data.imdb?.genres || []),
      ...(data.rottenTomatoes?.genres || [])
    ];
    data.genres = Array.from(new Set(
      allGenres
        .flatMap(g => normalizeGenre(g).split(','))
        .map(s => s.trim())
        .filter(Boolean)
    ));
  } finally {
    await browser.close();
  }
  console.log("✅ Done:", {
    rt:     data.rottenTomatoes?.title,
    imdb:   data.imdb?.title,
    oscars: data.oscars.length,
    genres: data.genres
  });
  return data;
}

module.exports = { scrapeMovieDetails };
