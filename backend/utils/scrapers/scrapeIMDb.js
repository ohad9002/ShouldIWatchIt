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

  // ─── 0) Spoof a real browser ───────────────────────────────────────────
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/115.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  return await retry(async () => {
    console.time('[IMDb] Total');

    // 1️⃣ Try the “find” page first
    const q = encodeURIComponent(movieTitle.trim());
    const findUrl = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;

    console.time('[IMDb] goto-find');
    const findResp = await safeGoto(page, findUrl, { waitUntil: 'networkidle', timeout: 90000 });
    if (findResp && findResp.status() >= 400) {
      console.error(`❌ [IMDb] /find returned ${findResp.status()} → aborting`);
      console.timeEnd('[IMDb] Total');
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A' };
    }
    console.timeEnd('[IMDb] goto-find');

    // 2️⃣ Look for JSON-LD or links on the find page
    // (Your existing find → JSON-LD logic goes here, falling back to suggestion API
    //  if needed; I'm assuming you already have that implemented.)

    // For brevity, here’s a suggestion-API fallback example:
    let best = null;
    // … your find‐page scraping to set `best` …
    // if still no candidate:
    if (!best) {
      const cat = movieTitle[0].toLowerCase();
      const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;
      console.log(`⚠️ [IMDb] No find candidates → using suggestion API`);
      try {
        const resp = await fetch(sugUrl);
        const json = await resp.json();
        const candidates = Array.isArray(json.d)
          ? json.d.filter(item => item.id && item.q === 'feature')
          : [];
        if (candidates.length) best = { id: candidates[0].id, url: `https://www.imdb.com/title/${candidates[0].id}/` };
      } catch (e) {
        console.error(`❌ [IMDb] Suggestion API error`, e);
      }
      if (!best) {
        console.error('❌ [IMDb] No candidate found at all → aborting');
        console.timeEnd('[IMDb] Total');
        return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A' };
      }
    }

    // 3️⃣ Navigate to the detail page
    console.log(`🚀 [IMDb] Best match → ${best.url}`);
    console.time('[IMDb] goto-detail');
    const detailResp = await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    if (detailResp && detailResp.status() >= 400) {
      console.error(`❌ [IMDb] detail page returned ${detailResp.status()} → parsing aborted`);
      console.timeEnd('[IMDb] Total');
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: best.url };
    }
    console.timeEnd('[IMDb] goto-detail');

    // 4️⃣ Extract JSON-LD
    const data = await page.evaluate(() => {
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
  }, {
    retries: 3,
    delayMs: 2000,
    factor: 2,
    jitter: true
  });
}

module.exports = { scrapeIMDb };
