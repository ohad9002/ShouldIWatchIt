const { retry } = require('../retry');
const { calculateSimilarity, normalizeText } = require('../similarity');

// Helper to retry navigations
async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 3000, factor: 2, jitter: true }
  );
}

async function scrapeIMDb(page, movieTitle) {
  console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [IMDb] Direct‐searching via URL…`);

  // log failed requests
  page.on('requestfailed', req => {
    console.error(`❌ [IMDb] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [IMDb] Page error:`, err);
  });

  return await retry(async () => {
    console.time('[IMDb] Total time');
    const query = encodeURIComponent(movieTitle.trim());
    const findUrl = `https://www.imdb.com/find?q=${query}&s=tt&ttype=ft`;

    console.time('[IMDb] goto-find');
    await safeGoto(page, findUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-find');
    console.log(`🔎 [IMDb] Loaded find page for "${movieTitle}"`);

    console.time('[IMDb] wait-results');
    await page.waitForSelector('.find-title-result', { timeout: 30000 });
    console.timeEnd('[IMDb] wait-results');

    const searchResults = await page.$$eval('.find-title-result', nodes =>
      nodes.map(row => {
        const a = row.querySelector('a');
        return { title: a?.textContent.trim() || '', url: a?.href || '' };
      })
    );
    console.log(`📊 [IMDb] Found ${searchResults.length} results vs "${movieTitle}"`);
    if (!searchResults.length) return null;

    // pick best
    let bestMatch = { similarity: -1 };
    for (const r of searchResults) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [IMDb] Evaluating "${r.title}" → ${s.toFixed(3)}`);
      if (s > bestMatch.similarity) bestMatch = { ...r, similarity: s };
    }
    if (!bestMatch.url) return null;

    console.log(`🚀 [IMDb] Best match: ${bestMatch.title} → ${bestMatch.url}`);
    console.time('[IMDb] goto-detail');
    await safeGoto(page, bestMatch.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-detail');

    console.time('[IMDb] wait-detail');
    await page.waitForSelector('h1, [data-testid="hero-rating-bar__aggregate-rating__score"]', { timeout: 20000 });
    console.timeEnd('[IMDb] wait-detail');

    const data = await page.evaluate(() => {
      const text = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      return {
        title:  text('h1'),
        rating: text('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
        image:  document.querySelector('.ipc-image')?.src || 'N/A',
        url:    window.location.href
      };
    });
    console.log(`🎯 [IMDb] Data:`, JSON.stringify(data, null, 2));

    console.timeEnd('[IMDb] Total time');
    return data;
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
