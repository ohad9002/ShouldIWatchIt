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

  // 0️⃣ Force a desktop User-Agent via extra HTTP headers
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                  'Chrome/114.0.0.0 Safari/537.36'
  });

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

    const q     = encodeURIComponent(movieTitle.trim());
    const findU = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;

    // 1️⃣ Navigate to the search page
    console.time('[IMDb] goto-find');
    await safeGoto(page, findU, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-find');

    // 2️⃣ Wait for the results container to appear
    console.time('[IMDb] wait-find-list');
    await page.waitForSelector('.findSection .findList', { timeout: 15000 });
    console.timeEnd('[IMDb] wait-find-list');

    // 3️⃣ Try to grab visible title links with a tighter selector
    console.time('[IMDb] eval-find-links');
    let candidates = await page.$$eval(
      '.findSection:nth-of-type(1) .findList tr.findResult td.result_text a[href^="/title/tt"]',
      els => els.map(a => {
        const match = a.getAttribute('href').match(/\/title\/(tt\d+)/);
        if (!match) return null;
        return {
          title: a.textContent.trim(),
          url:   `https://www.imdb.com/title/${match[1]}/`
        };
      }).filter(Boolean)
    );
    console.timeEnd('[IMDb] eval-find-links');

    // 4️⃣ If no candidates, fallback to JSON-LD on the find page
    if (!candidates.length) {
      console.warn('⚠️ [IMDb] No links – trying JSON-LD fallback on /find');
      const ldHandle = await page.$('script[type="application/ld+json"]');
      if (ldHandle) {
        const json = JSON.parse(await ldHandle.evaluate(n => n.textContent));
        if (json && Array.isArray(json.itemListElement)) {
          candidates = json.itemListElement
            .filter(e => typeof e.url === 'string' && e.url.includes('/title/'))
            .map(e => ({
              title: e.name,
              url:   `https://www.imdb.com${new URL(e.url, 'https://www.imdb.com').pathname}`
            }))
            .slice(0, 5);
        }
      }
    }

    // 5️⃣ If still none, use the suggestions API
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

    // 6️⃣ Pick best by similarity
    let best = candidates.reduce((a, b) =>
      calculateSimilarity(b.title, movieTitle) > calculateSimilarity(a.title, movieTitle)
        ? b
        : a
    , { title: '', url: '', similarity: -1 });

    // 7️⃣ Visit detail page
    console.time('[IMDb] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 90000 });
    console.timeEnd('[IMDb] goto-detail');

    // 8️⃣ Scrape rating & title & image
    await Promise.any([
      page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 8000 }),
      page.waitForSelector('script[type="application/ld+json"]', { timeout: 8000 })
    ]).catch(() => {});

    const data = await page.evaluate(() => {
      const text = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';

      // UI-based scrape
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
        } catch (e) {
          // ignore parse errors
        }
      }

      // Ultimate fallback
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: window.location.href };
    });

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
