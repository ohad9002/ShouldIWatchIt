// utils/scrapers/scrapeIMDb.js
console.log('🆕 [IMDb Scraper] Loaded FULL scrapeIMDb.js');

const fetch = require('node-fetch');
const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

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

  // block analytics/ads
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/doubleverify|adobedtm|googletagmanager|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });

  return await retry(async () => {
    console.time('[IMDb] Total');
    const q = encodeURIComponent(movieTitle.trim());
    const findUrl = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;
    console.time('[IMDb] goto-find');
    await safeGoto(page, findUrl, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-find');

    // 1️⃣ Try visible links
    console.time('[IMDb] eval-find-links');
    let candidates = await page.$$eval(
      '.findSection .findList tr .result_text a[href^="/title/tt"]',
      els => els.map(a => {
        const m = a.getAttribute('href').match(/\/title\/(tt\d+)/);
        return m ? { title: a.textContent.trim(), url: `https://www.imdb.com/title/${m[1]}/` } : null;
      }).filter(Boolean)
    );
    console.timeEnd('[IMDb] eval-find-links');
    if (candidates.length) {
      console.log(`✅ [IMDb] Found ${candidates.length} link(s) on /find`);
    } else {
      // 2️⃣ JSON-LD fallback on find page
      console.warn('⚠️ [IMDb] No links on find → JSON-LD fallback');
      const ld = await page.$('script[type="application/ld+json"]');
      if (ld) {
        const json = JSON.parse(await ld.evaluate(n => n.textContent));
        if (json?.itemListElement) {
          candidates = json.itemListElement
            .filter(e => e.url && e.url.includes('/title/'))
            .map(e => ({
              title: e.name,
              url:   `https://www.imdb.com${new URL(e.url, 'https://www.imdb.com').pathname}`
            })).slice(0,5);
          console.log(`✅ [IMDb] JSON-LD fallback gave ${candidates.length}`);
        }
      }
    }

    // 3️⃣ Suggestion API
    if (!candidates.length) {
      console.warn('⚠️ [IMDb] Still no candidates → Suggestion API');
      const cat = movieTitle[0].toLowerCase();
      const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;
      console.time('[IMDb] fetch-suggestions');
      const resp = await fetch(sugUrl);
      const j = await resp.json().catch(()=>null);
      console.timeEnd('[IMDb] fetch-suggestions');
      candidates = (j?.d||[])
        .filter(it => it.id && it.q === 'feature')
        .map(it => ({ title: it.l, url: `https://www.imdb.com/title/${it.id}/` }))
        .slice(0,5);
      console.log(`✅ [IMDb] Suggestion API gave ${candidates.length}`);
    }

    if (!candidates.length) {
      console.error('❌ [IMDb] No candidates at all → aborting');
      console.timeEnd('[IMDb] Total');
      return { title:'N/A', rating:'N/A', image:'N/A', url:'N/A' };
    }

    // pick best by similarity
    let best = candidates.reduce((a,b) =>
      calculateSimilarity(b.title, movieTitle) > calculateSimilarity(a.title, movieTitle) ? b : a
    );
    console.log(`🚀 [IMDb] Best match → ${best.url}`);

    // scrape detail page
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-detail');

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
        } catch {}
      }
      // fallback minimal
      return {
        title: document.querySelector('h1')?.textContent.trim() || 'N/A',
        rating: document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span')?.textContent || 'N/A',
        image: document.querySelector('.ipc-image')?.src || 'N/A',
        url: window.location.href
      };
    });

    console.log(`🎯 [IMDb] Data:`, data);
    console.timeEnd('[IMDb] Total');
    return data;
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
