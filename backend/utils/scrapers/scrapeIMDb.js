// utils/scrapers/scrapeIMDb.js

const fetch = require('node-fetch');       // ← add at top!
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

  // set up routing to block heavy assets…
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /doubleverify|adobedtm|googletagmanager|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });
  page.on('requestfailed', req => {
    console.error(`❌ [IMDb] Request failed: ${req.url()}`);
  });

  return await retry(async () => {
    console.time('[IMDb] Total');

    // 1) Try the /find page first
    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;
    console.time('[IMDb] goto-find');
    await safeGoto(page, findU, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-find');

    // 2) Extract any <a href^="/title/tt"> links
    console.time('[IMDb] eval-find-links');
    let candidates = await page.$$eval(
      'a[href^="/title/tt"]',
      (links) => {
        const seen = new Set();
        return links.map(a => {
          const href = a.getAttribute('href') || '';
          const m = href.match(/^\/title\/(tt\d+)/);
          if (!m) return null;
          const id = m[1];
          const title = a.textContent.trim();
          const key = `${id}|${title}`;
          if (!title || seen.has(key)) return null;
          seen.add(key);
          return { title, url: `https://www.imdb.com/title/${id}/` };
        })
        .filter(Boolean)
        .slice(0, 20);
      }
    );
    console.timeEnd('[IMDb] eval-find-links');

    // 3) If none found, fall back to the suggestion API
    if (candidates.length === 0) {
      console.warn('⚠️ [IMDb] No find-page links, using suggestion API');
      // pick the first letter as category
      const cat = movieTitle.trim()[0].toLowerCase();
      const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;

      console.time('[IMDb] fetch-suggestions');
      const resp = await fetch(sugUrl);
      const j    = await resp.json().catch(() => null);
      console.timeEnd('[IMDb] fetch-suggestions');

      if (j && Array.isArray(j.d)) {
        const seen = new Set();
        candidates = j.d
          .filter(item => item.id && item.q === 'feature')     // only feature films
          .slice(0, 10)                                        // top 10
          .map(item => ({
            title: item.l,
            url:   `https://www.imdb.com/title/${item.id}/`
          }))
          .filter(c => {
            const key = `${c.url}|${c.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      }
    }

    console.log(`📊 [IMDb] Candidates: ${candidates.length}`);
    if (!candidates.length) {
      console.error('❌ [IMDb] Still no candidates → aborting IMDb scrape');
      console.timeEnd('[IMDb] Total');
      return null;
    }

    // 4) Pick best by title-similarity
    let best = { similarity: -1 };
    for (const c of candidates) {
      const sim = calculateSimilarity(c.title, movieTitle);
      console.log(`🔍 [IMDb] "${c.title}" → ${sim.toFixed(3)}`);
      if (sim > best.similarity) best = { ...c, similarity: sim };
    }

    console.log(`🚀 [IMDb] Best match → ${best.url}`);

    // 5) Visit detail page
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-detail');

    // 6) Wait for rating or JSON-LD
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 8000 }),
      page.waitForSelector('script[type="application/ld+json"]',                { timeout: 8000 })
    ]).catch(() => {});

    // 7) Scrape either the visual rating or JSON-LD fallback
    const data = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      // official 2024+ UI
      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  getText('h1'),
          rating: getText('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

      // JSON-LD
      const script = document.querySelector('script[type="application/ld+json"]');
      if (script) {
        try {
          const j = JSON.parse(script.textContent);
          return {
            title:  j.name || 'N/A',
            rating: j.aggregateRating?.ratingValue || 'N/A',
            image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
            url:    window.location.href
          };
        } catch {}
      }

      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total');
    return data;

  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
