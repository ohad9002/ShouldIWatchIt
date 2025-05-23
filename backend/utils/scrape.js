// backend/utils/scrape.js

const { chromium }   = require('playwright');
const { scrapeRT }   = require('./scrapers/scrapeRT');
const { scrapeIMDb } = require('./scrapers/scrapeIMDb');
const { scrapeOscars } = require('./scrapers/scrapeOscars');
const { normalizeGenre } = require('./normalization');  // <-- verify this path + name!

async function scrapeMovieDetails(movieTitle) {
  console.log(`🔍 Starting scrape for: "${movieTitle}"`);
  const movieData = { imdb: null, rottenTomatoes: null, oscars: null, genres: [] };

  let browser, context;
  try {
    console.log("📌 Launching browser…");
   browser = await chromium.launch({
headless: true,
  slowMo: 50,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ]
});
    console.log("📌 Browser instance initialized");

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)…',
      locale: 'en-US',
      extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' }
    });

    console.log("📌 Creating pages for RT and IMDb…");
    const [ rtPage, imdbPage ] = await Promise.all([
      context.newPage(),
      context.newPage()
    ]);

    console.log("📌 Scraping Rotten Tomatoes and IMDb…");
    const [ rtData, imdbData ] = await Promise.all([
      scrapeRT(rtPage, movieTitle),
      scrapeIMDb(imdbPage, movieTitle)
    ]);

    movieData.rottenTomatoes = rtData;
    movieData.imdb = imdbData;

    if (imdbData?.title) {
      console.log("📌 Scraping Oscars with title:", imdbData.title);
      const oscarsPage = await context.newPage();
      movieData.oscars = await scrapeOscars(oscarsPage, imdbData.title);
      await oscarsPage.close();
    }

    console.log("📌 Normalizing & merging genres…");
    const rawGenres = [
      ...(imdbData?.genres || []),
      ...(rtData?.genres || [])
    ];
    movieData.genres = Array.from(new Set(
      rawGenres
        .flatMap(g => normalizeGenre(g).split(','))
        .map(s => s.trim())
        .filter(Boolean)
    ));

  } catch (err) {
    console.error('❌ Overall scraping failed:', err);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }

  console.log('✅ Scraping finished:', movieData);
  return movieData;
}

module.exports = { scrapeMovieDetails };
