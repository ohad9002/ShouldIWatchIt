// backend/utils/scrapers/scrapeMovieDetails.js

const { chromium }        = require('playwright');
const { scrapeRT }        = require('./scrapeRT');
const { scrapeIMDb }      = require('./scrapeIMDb');
const { scrapeOscars }    = require('./scrapeOscars');
const { normalizeGenre }  = require('../normalization');

/**
 * Scrape RT + IMDb in parallel (await both),
 * then fire‐and‐forget Oscars (do NOT await),
 * normalize genres, and return { imdb, rottenTomatoes } immediately.
 * Oscars will log/save when it finishes.
 */
async function scrapeMovieDetails(movieTitle) {
  console.log(`🔍 Starting scrape for: "${movieTitle}"`);
  let browser, context;

  try {
    browser = await chromium.launch({
      headless: true,
      slowMo:   50,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
    });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)…',
      locale:    'en-US',
      extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' }
    });

    // create two pages for RT + IMDb
    const [rtPage, imdbPage] = await Promise.all([
      context.newPage(), context.newPage()
    ]);

    console.log("📌 Scraping Rotten Tomatoes and IMDb…");
    const [rtData, imdbData] = await Promise.all([
      scrapeRT(rtPage,   movieTitle),
      scrapeIMDb(imdbPage, movieTitle)
    ]);

    // Fire‐and‐forget Oscars (won't block)
    if (imdbData?.title) {
      context.newPage().then( oscarsPage => {
        console.log("📌 (bg) Scraping Oscars for:", imdbData.title);
        return scrapeOscars(oscarsPage, imdbData.title)
          .then(results => {
            console.log("🎬 [Oscars] done:", results.length, "entries");
            // TODO: persist to your DB here
            oscarsPage.close();
          })
          .catch(err => {
            console.error("❌ [Oscars] error:", err);
            oscarsPage.close();
          });
      });
    }

    // merge & normalize genres from both sources
    const rawGenres = [
      ...(imdbData?.genres   || []),
      ...(rtData?.genres     || [])
    ];
    const genres = Array.from(new Set(
      rawGenres
        .flatMap(g => normalizeGenre(g).split(','))
        .map(s => s.trim())
        .filter(Boolean)
    ));

    return {
      imdb:          imdbData,
      rottenTomatoes: rtData,
      genres
    };

  } catch (err) {
    console.error('❌ scrapeMovieDetails error:', err);
    throw err;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

module.exports = { scrapeMovieDetails };
