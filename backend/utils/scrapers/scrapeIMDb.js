// utils/scrapers/scrapeIMDb.js

const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

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

  // Block images/fonts/ads but allow JSON-LD scripts
  await page.route('**/*', route => {
    const u = route.request().url();
    if (
      u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
      /amazon\.com\/images|adobedtm|googletagmanager|analytics|unagi/.test(u)
    ) return route.abort();
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
    // IMDb now renders results in a <table class="findList"> with <tr class="findResult">
    await page.waitForSelector('.findList tr.findResult', { timeout: 45000 });
    console.timeEnd('[IMDb] wait-find');

    // Extract title & url from each row
    const results = await page.$$eval('.findList tr.findResult', rows =>
      rows.map(r => {
        const link = r.querySelector('td.result_text a');
        return {
          title: link?.textContent.trim() || '',
          url:   link?.href || ''
        };
      })
    );
    console.log(`📊 [IMDb] Found ${results.length} results vs "${movieTitle}"`);
    if (!results.length) {
      console.warn('⚠️ [IMDb] No search results');
      return null;
    }

    // Pick best fuzzy match
    let best = { similarity: -1 };
    for (const r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [IMDb] Score "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    if (!best.url) return null;

    console.log(`🚀 [IMDb] Best match → ${best.url}`);
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-detail');

    // Wait for either the UI widget or the JSON-LD script tag (attached)
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 10000 }),
      page.waitForSelector('script[type="application/ld+json"]',                { timeout: 10000, state: 'attached' })
    ]).catch(() => { /* ignore if both miss */ });

    // Scrape from UI widget if present, else JSON-LD
    const data = await page.evaluate(() => {
      const txt = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      // 1) UI-based
      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  txt('h1'),
          rating: txt('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

      // 2) JSON-LD fallback
      const el = document.querySelector('script[type="application/ld+json"]');
      console.log('ℹ️ [IMDb] JSON-LD raw:', el?.textContent?.slice(0,200));
      if (el) {
        try {
          const j = JSON.parse(el.textContent);
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

      // 3) ultimate fallback
      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total time');
    return data;

  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
