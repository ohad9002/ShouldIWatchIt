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

  // Block images/fonts/ads but allow JSON-LD
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
    console.time('[IMDb] Total');
    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;

    console.time('[IMDb] goto-find');
    // networkidle to let the client app load
    await safeGoto(page, findU, { waitUntil: 'networkidle', timeout: 120000 });
    console.timeEnd('[IMDb] goto-find');

    // give React a moment to hydrate
    await page.waitForTimeout(500);

    // collect both styles of result rows
    const results = await page.evaluate(() => {
      const out = [];

      // new `.findResult` rows
      for (const r of document.querySelectorAll('.findResult')) {
        const a = r.querySelector('td.result_text a');
        if (a?.href) out.push({ title: a.textContent.trim(), url: a.href });
      }

      // fallback legacy `td.result_text`
      if (out.length === 0) {
        for (const td of document.querySelectorAll('td.result_text')) {
          const a = td.querySelector('a');
          if (a?.href) out.push({ title: a.textContent.trim(), url: a.href });
        }
      }

      return out;
    });

    console.log(`📊 [IMDb] Found ${results.length} candidates`);
    if (!results.length) return null;

    // pick best by similarity
    let best = { similarity: -1 };
    for (const r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [IMDb] "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }

    console.log(`🚀 [IMDb] Best → ${best.url}`);
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 120000 });
    console.timeEnd('[IMDb] goto-detail');

    // wait a bit for rating UI / JSON-LD to appear
    await page.waitForTimeout(500);

    const data = await page.evaluate(() => {
      const txt = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  txt('h1'),
          rating: txt('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

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
        } catch (e) {
          console.error('❌ [IMDb] JSON-LD parse error', e);
        }
      }

      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total');
    return data;

  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
