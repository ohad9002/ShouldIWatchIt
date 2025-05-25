const fetch = require('node-fetch');
const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

async function safeGoto(page, url, options) {
  return await retry(() => page.goto(url, options), {
    retries: 2, delayMs: 3000, factor: 2, jitter: true
  });
}

async function scrapeIMDb(page, movieTitle) {
  console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);

  // Block only analytics and ads (but allow JSON-LD and core HTML)
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/doubleverify|adobedtm|googletagmanager|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });

  return await retry(async () => {
    console.time('[IMDb] Total');

    const q      = encodeURIComponent(movieTitle.trim());
    const findU  = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;
    console.time('[IMDb] goto-find');
    await safeGoto(page, findU, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-find');

    // 1️⃣ Try to grab visible title links
    console.time('[IMDb] eval-find-links');
    let candidates = await page.$$eval(
      '.findSection .findList tr .result_text a[href^="/title/tt"]',
      els => els.map(a => {
        const id    = a.getAttribute('href').match(/\/title\/(tt\d+)/)?.[1];
        const title = a.textContent.trim();
        return id ? { title, url: `https://www.imdb.com/title/${id}/` } : null;
      }).filter(Boolean)
    );
    console.timeEnd('[IMDb] eval-find-links');

    // 2️⃣ If no candidates, fallback to JSON-LD on the find page
    if (!candidates.length) {
      console.warn('⚠️ [IMDb] No links – trying JSON-LD fallback on /find');
      const ld = await page.$('script[type="application/ld+json"]');
      if (ld) {
        const json = JSON.parse(await ld.evaluate(n => n.textContent));
        if (json && json.itemListElement) {
          candidates = json.itemListElement
            .filter(e => e.url && e.url.includes('/title/'))
            .map(e => ({
              title: e.name,
              url:   `https://www.imdb.com${new URL(e.url, 'https://www.imdb.com').pathname}`
            }))
            .slice(0, 5);
        }
      }
    }

    // 3️⃣ If still none, use the suggestions API
    if (!candidates.length) {
      console.warn('⚠️ [IMDb] Still no candidates – using suggestion API');
      const cat    = movieTitle[0].toLowerCase();
      const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;
      console.time('[IMDb] fetch-suggestions');
      const resp = await fetch(sugUrl);
      const j    = await resp.json().catch(() => null);
      console.timeEnd('[IMDb] fetch-suggestions');
      if (j?.d) {
        candidates = j.d
          .filter(item => item.id && item.q === 'feature')
          .map(item => ({
            title: item.l,
            url:   `https://www.imdb.com/title/${item.id}/`
          }))
          .slice(0, 5);
      }
    }

    if (!candidates.length) {
      console.error('❌ [IMDb] No candidates at all → aborting');
      console.timeEnd('[IMDb] Total');
      return null;
    }

    // 4️⃣ Pick best by similarity
    let best = candidates.reduce((a, b) =>
      calculateSimilarity(b.title, movieTitle) > calculateSimilarity(a.title, movieTitle) ? b : a
    , { title:'', url:'', similarity: -1 });

    // 5️⃣ Visit detail page
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-detail');

    // 6️⃣ Scrape rating & title & image
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 8000 }),
      page.waitForSelector('script[type="application/ld+json"]', { timeout: 8000 })
    ]).catch(()=>{});

    const data = await page.evaluate(() => {
      const text = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      // UI-based
      if (document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]')) {
        return {
          title:  text('h1'),
          rating: text('[data-testid="hero-rating-bar__aggregate-rating__score"] span'),
          image:  document.querySelector('.ipc-image')?.src || 'N/A',
          url:    window.location.href
        };
      }
      // JSON-LD fallback
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
        } catch(e) { /* ignore */ }
      }
      return { title:'N/A', rating:'N/A', image:'N/A', url:window.location.href };
    });

    console.timeEnd('[IMDb] Total');
    return data;
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });
}

module.exports = { scrapeIMDb };
