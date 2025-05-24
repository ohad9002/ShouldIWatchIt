// utils/scrapeMovieDetails.js
const { chromium } = require('playwright');
const { scrapeRT }     = require('./scrapers/scrapeRT');
const { scrapeIMDb }   = require('./scrapers/scrapeIMDb');
const { scrapeOscars } = require('./scrapers/scrapeOscars');
const { normalizeGenre } = require('./normalization');

async function scrapeMovieDetails(title) {
  console.log(`🔍 scrapeMovieDetails("${title}")`);
  const data = { imdb: null, rottenTomatoes: null, oscars: [], genres: [] };
  const browser = await chromium.launch({ headless: true, args:['--no-sandbox'] });
  const page    = await browser.newPage();
  try {
    // —— Rotten Tomatoes
    data.rottenTomatoes = await scrapeRT(page, title);

    // —— IMDb
    data.imdb = await scrapeIMDb(page, title);

    // —— Oscars
    if (data.imdb?.title) {
      try {
        console.log("📌 scrapeOscars…");
        data.oscars = await scrapeOscars(page, data.imdb.title);
      } catch (e) {
        console.error("❌ scrapeOscars failed:", e);
      }
    }

    // —— Merge genres
    const allGenres = [
      ...(data.imdb?.genres||[]),
      ...(data.rottenTomatoes?.genres||[])
    ];
    data.genres = Array.from(new Set(
      allGenres.flatMap(g => normalizeGenre(g).split(',')).map(s=>s.trim()).filter(Boolean)
    ));

  } finally {
    await browser.close();
  }
  console.log("✅ Done:", {
    rt: data.rottenTomatoes?.title,
    imdb: data.imdb?.title,
    oscars: data.oscars.length,
    genres: data.genres
  });
  return data;
}

module.exports = { scrapeMovieDetails };
