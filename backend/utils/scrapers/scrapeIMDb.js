// backend/utils/scrapers/scrapeIMDb.js

const { retry } = require('../retry');
const { calculateSimilarity, normalizeText } = require('../similarity');

const scrapeIMDb = async (page, movieTitle) => {
  console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [IMDb] Direct‐searching via URL…`);

  return await retry(async () => {
    // 1) Hit IMDb’s “find” endpoint directly
    const query = encodeURIComponent(movieTitle.trim());
    await page.goto(
      `https://www.imdb.com/find?q=${query}&s=tt&ttype=ft`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );
    console.log(`🔎 [IMDb] Loaded find page for “${movieTitle}”`);

    // 2) Wait for the standard title‐result list
    await page.waitForSelector('.find-title-result', { timeout: 15000 });

    // 3) Extract all candidates
    const searchResults = await page.$$eval('.find-title-result', nodes =>
      nodes.map(row => {
        const anchor = row.querySelector('a');
        return {
          title: anchor?.textContent?.trim() || '',
          url:   anchor?.href || ''
        };
      })
    );
    console.log(`📊 [IMDb] Found ${searchResults.length} movie results. Comparing with: "${movieTitle}"`);

    if (!searchResults.length) {
      console.warn(`⚠️ [IMDb] No movie search results found.`);
      return null;
    }

    // 4) Pick best match via your similarity function
    let bestMatch = { similarity: -1 };
    for (const result of searchResults) {
      const simScore = calculateSimilarity(result.title || '', movieTitle);
      console.log(`🔍 [IMDb] Evaluating: "${result.title}"`);
      console.log(`   🔹 Similarity score: ${simScore}`);
      if (simScore > bestMatch.similarity) {
        bestMatch = { ...result, similarity: simScore };
        console.log(`   ✅ New best match: "${result.title}"`);
      }
    }

    if (!bestMatch.url) {
      console.warn(`⚠️ [IMDb] No matching URL found after evaluation.`);
      return null;
    }

    // 5) Navigate into the actual movie page
    console.log(`🚀 [IMDb] Navigating to best match: ${bestMatch.url}`);
    await page.goto(bestMatch.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 6) Scrape rating, title & poster
    console.log(`⏳ [IMDb] Waiting for rating and title...`);
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 10000 });

    const data = await page.evaluate(() => {
      const text = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      return {
        title: text('h1'),
        rating: text('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
        image: document.querySelector('.ipc-image')?.src || 'N/A',
        url: window.location.href
      };
    });

    console.log(`🎯 [IMDb] Final data extracted:`);
    console.log(JSON.stringify(data, null, 2));
    return data;

  }, {
    retries: 3,
    delayMs: 2000,
    factor: 2,
    jitter: true
  });
};

module.exports = { scrapeIMDb };
