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
    await safeGoto(page, findU, { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.timeEnd('[IMDb] goto-find');

    // First wait for body, then whichever search-list selector appears
    await page.waitForSelector('body', { timeout: 10000 });

    const which = await Promise.race([
      page.waitForSelector('.findList .findResult', { timeout: 10000 }).then(() => 'new'),
      page.waitForSelector('td.result_text',       { timeout: 10000 }).then(() => 'legacy'),
      Promise.resolve('none')
    ]);

    let results = [];
    if (which === 'new') {
      results = await page.$$eval('.findList .findResult', rows =>
        rows.map(r => {
          const a = r.querySelector('td.result_text a') || r.querySelector('a');
          return { title: a?.textContent.trim()||'', url: a?.href||'' };
        })
      );
      console.log(`📊 [IMDb] Found ${results.length} (new)`);
    } else if (which === 'legacy') {
      results = await page.$$eval('td.result_text', cells =>
        cells.map(c => {
          const a = c.querySelector('a');
          return { title: a?.textContent.trim()||'', url: a?.href||'' };
        })
      );
      console.log(`📊 [IMDb] Found ${results.length} (legacy)`);
    } else {
      console.warn('⚠️ [IMDb] No search results found via find-list selectors, falling back to JSON-LD');
    }

    if (!results.length) return null;

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

    // wait for either the visible rating or the JSON-LD script
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 10000 }),
      page.waitForSelector('script[type="application/ld+json"]',                { timeout: 10000 })
    ]).catch(() => {});

    const data = await page.evaluate(() => {
      const txt = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      // new UI block
      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  txt('h1'),
          rating: txt('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

      // fallback JSON-LD
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
        } catch(e) {
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
