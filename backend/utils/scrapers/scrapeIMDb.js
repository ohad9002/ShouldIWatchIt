// utils/scrapers/scrapeIMDb.js

const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 3000, factor: 2, jitter: true }
  );
}

async function scrapeIMDb(page, movieTitle) {
  console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [IMDb] Direct‐searching via URL…`);

  // Block heavy assets but let HTML & scripts run
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i)) return route.abort();
    return route.continue();
  });

  return await retry(async () => {
    console.time('[IMDb] Total');
    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;

    console.time('[IMDb] goto-find');
    await safeGoto(page, findU, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-find');

    // Directly pull every link to a title page
    console.time('[IMDb] eval-results');
    const results = await page.evaluate(() => {
      const seen = new Set();
      return Array.from(document.querySelectorAll('a'))
        .filter(a => /\/title\/tt\d+/.test(a.getAttribute('href') || ''))
        .map(a => {
          const url = new URL(a.href, window.location.origin).href;
          const title = a.textContent.trim();
          if (!title || seen.has(url)) return null;
          seen.add(url);
          return { title, url };
        })
        .filter(Boolean)
        .slice(0, 20);
    });
    console.timeEnd('[IMDb] eval-results');

    if (!results.length) {
      console.warn('⚠️ [IMDb] No links found on search page, aborting IMDb scrape');
      return null;
    }
    console.log(`📊 [IMDb] Found ${results.length} candidates`);

    // pick best match
    let best = { similarity: -1 };
    for (const r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [IMDb] "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    if (!best.url) return null;

    console.log(`🚀 [IMDb] Best → ${best.url}`);
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 120000 });
    console.timeEnd('[IMDb] goto-detail');

    // extract rating & image
    console.time('[IMDb] extract-detail');
    const data = await page.evaluate(() => {
      const txt = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      const uiRating = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span');
      if (uiRating) {
        return {
          title:  txt('h1'),
          rating: uiRating.textContent.trim(),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

      const ld = document.querySelector('script[type="application/ld+json"]');
      if (ld) {
        try {
          const j = JSON.parse(ld.textContent);
          return {
            title:  j.name || 'N/A',
            rating: j.aggregateRating?.ratingValue || 'N/A',
            image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
            url:    window.location.href
          };
        } catch(e) {
          console.error('❌ [IMDb] JSON-LD parse error', e);
        }
      }

      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });
    console.timeEnd('[IMDb] extract-detail');

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total');
    return data;

  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
