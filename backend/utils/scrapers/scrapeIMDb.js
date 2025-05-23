// backend/utils/scrapers/scrapeIMDb.js

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

  // Block images/fonts/ads/analytics
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /amazon\.com|adobedtm|googletagmanager|analytics|unagi/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });
  page.on('requestfailed', req => {
    console.error(`❌ [IMDb] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [IMDb] Page error:`, err);
  });

  return await retry(async () => {
    console.time('[IMDb] Total time');
    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;

    console.time('[IMDb] goto-find');
    await safeGoto(page, findU, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-find');

    console.time('[IMDb] wait-find');
    await page.waitForSelector('.find-title-result', { timeout: 30000 });
    console.timeEnd('[IMDb] wait-find');

    const results = await page.$$eval('.find-title-result', rows =>
      rows.map(r => {
        const a = r.querySelector('a');
        return { title: a?.textContent.trim()||'', url: a?.href||'' };
      })
    );
    console.log(`📊 [IMDb] Found ${results.length} results vs "${movieTitle}"`);
    if (!results.length) return null;

    let best = { similarity: -1 };
    for (const r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    if (!best.url) return null;

    console.log(`🚀 [IMDb] Best match → ${best.url}`);
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-detail');

    // race: either the rating bar or JSON-LD appears
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 10000 }),
      page.waitForSelector('script[type="application/ld+json"]', { timeout: 10000 })
    ]).catch(() => { /* swallow */ });

    const data = await page.evaluate(() => {
      const txt = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      // if we have the UI widget, use it
      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  txt('h1'),
          rating: txt('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }
      // else try JSON-LD
      const el = document.querySelector('script[type="application/ld+json"]');
      if (el) {
        try {
          const j = JSON.parse(el.textContent);
          return {
            title:  j.name || 'N/A',
            rating: j.aggregateRating?.ratingValue || 'N/A',
            image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
            url:    window.location.href
          };
        } catch { }
      }
      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total time');
    return data;
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
