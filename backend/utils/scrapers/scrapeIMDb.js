// utils/scrapers/scrapeIMDb.js
console.log('🆕 [IMDb Scraper] Loaded FULL scrapeIMDb.js');

const fetch = require('node-fetch');
const { retry } = require('../retry');

async function safeGoto(page, url, options) {
  return await retry(() => page.goto(url, options), {
    retries: 2,
    delayMs: 3000,
    factor: 2,
    jitter: true
  });
}

async function scrapeIMDb(page, movieTitle) {
  console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);

  // ─── 0) Spoof headers on the existing context ─────────────────────────
  await page.context().setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/115.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  });

  // Wrap the whole flow in a retry to handle intermittent blocks
  return await retry(async () => {
    console.time('[IMDb] Total');

    // 1) /find page
    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;
    console.time('[IMDb] goto-find');
    const findResp = await safeGoto(page, findUrl, { waitUntil: 'networkidle', timeout: 90000 });
    if (findResp && findResp.status() >= 400) {
      console.error(`❌ [IMDb] /find returned ${findResp.status()} → aborting`);
      console.timeEnd('[IMDb] Total');
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A' };
    }
    console.timeEnd('[IMDb] goto-find');

    // 2) extract title links
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

    // 3) fallback to suggestion API
    if (candidates.length === 0) {
      console.warn('⚠️ [IMDb] No find-page links, using suggestion API');
      const cat = movieTitle.trim()[0].toLowerCase();
      const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;
      try {
        const resp = await fetch(sugUrl);
        const json = await resp.json();
        const candidates = Array.isArray(json.d)
          ? json.d.filter(item => item.id && item.q === 'feature')
          : [];
        if (candidates.length) {
          bestUrl = `https://www.imdb.com/title/${candidates[0].id}/`;
        }
      } catch (e) {
        console.error(`❌ [IMDb] Suggestion API error`, e);
      }
      if (!bestUrl) {
        console.error('❌ [IMDb] No candidate found at all → aborting');
        console.timeEnd('[IMDb] Total');
        return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A' };
      }
    }

    // 4️⃣ Navigate to the detail page
    console.log(`🚀 [IMDb] Best match → ${bestUrl}`);
    console.time('[IMDb] goto-detail');
    const detailResp = await safeGoto(page, bestUrl, { waitUntil: 'networkidle', timeout: 90000 });
    if (detailResp && detailResp.status() >= 400) {
      console.error(`❌ [IMDb] detail page returned ${detailResp.status()} → parsing aborted`);
      console.timeEnd('[IMDb] Total');
      return null;
    }

    // 4) pick best by similarity
    let best = { similarity: -1 };
    for (const c of candidates) {
      const sim = calculateSimilarity(c.title, movieTitle);
      console.log(`🔍 [IMDb] "${c.title}" → ${sim.toFixed(3)}`);
      if (sim > best.similarity) best = { ...c, similarity: sim };
    }

    console.log(`🚀 [IMDb] Best match → ${best.url}`);

    // 5) visit detail page
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-detail');

    // 6) wait for rating or JSON-LD
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 8000 }),
      page.waitForSelector('script[type="application/ld+json"]',                { timeout: 8000 })
    ]).catch(() => {});

    // 7) scrape
    const data = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  getText('h1'),
          rating: getText('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }

      const script = document.querySelector('script[type="application/ld+json"]');
      if (script) {
        try {
          const j = JSON.parse(script.textContent);
          return {
            title:  j.name             || 'N/A',
            rating: j.aggregateRating?.ratingValue || 'N/A',
            image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
            url:    window.location.href
          };
        } catch (e) {
          console.warn('❌ [IMDb] JSON-LD parse error', e);
        }
      }
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: window.location.href };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total');
    return data;

  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
