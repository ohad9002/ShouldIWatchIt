// utils/scrapers/scrapeRT.js

const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

// Helper to retry navigations
async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 3000, factor: 2, jitter: true }
  );
}

async function scrapeRT(page, movieTitle) {
  console.log(`🔍 [RT] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [RT] Direct‐searching via URL…`);

  // Block images/fonts/ads but allow JSON-LD/score-board
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /doubleverify|adobedtm|amazon\.com\/assets|googletagmanager|analytics/.test(u)
    ) return route.abort();
    return route.continue();
  });
  page.on('requestfailed', req => {
    console.error(`❌ [RT] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [RT] Page error:`, err);
  });

  const q = encodeURIComponent(movieTitle.trim());
  const u = `https://www.rottentomatoes.com/search?search=${q}`;

  console.time('[RT] Total time');
  console.time('[RT] goto-search');
  await safeGoto(page, u, { waitUntil: 'networkidle', timeout: 120000 });
  console.timeEnd('[RT] goto-search');

  console.time('[RT] wait-search');
  await page.waitForSelector('search-page-media-row', { timeout: 30000 });
  console.timeEnd('[RT] wait-search');

  const list = await page.$$eval('search-page-media-row', nodes =>
    nodes.map(n => {
      const a = n.querySelector('a[slot="title"]');
      return { title: a?.textContent.trim()||'', url: a?.href||'' };
    })
  );
  console.log(`📊 [RT] Found ${list.length} results vs "${movieTitle}"`);
  if (!list.length) return null;

  let best = { similarity: -1 };
  for (const r of list) {
    const s = calculateSimilarity(r.title, movieTitle);
    console.log(`🔍 [RT] Score "${r.title}" → ${s.toFixed(3)}`);
    if (s > best.similarity) best = { ...r, similarity: s };
  }
  if (!best.url) return null;

  console.log(`🚀 [RT] Best match → ${best.url}`);
  console.time('[RT] goto-detail');
  await safeGoto(page, best.url, { waitUntil: 'networkidle', timeout: 120000 });
  console.timeEnd('[RT] goto-detail');

  // Race: scorecard, score-board or JSON-LD
  await Promise.any([
    page.waitForSelector('media-scorecard', { timeout: 10000 }),
    page.waitForSelector('score-board',    { timeout: 10000 }),
    page.waitForSelector('script[type="application/ld+json"]', { timeout: 10000 })
  ]).catch(() => {});

  const data = await page.evaluate(() => {
    const getText = s => document.querySelector(s)?.textContent.trim() || 'N/A';
    const getCat  = label => {
      for (const el of document.querySelectorAll('.category-wrap')) {
        if (el.querySelector('dt rt-text.key')?.innerText.trim() === label) {
          return Array.from(el.querySelectorAll('dd [data-qa="item-value"]'))
                      .map(x => x.textContent.trim());
        }
      }
      return [];
    };

    // 1) DOM-based
    if (document.querySelector('media-scorecard') || document.querySelector('score-board')) {
      return {
        title:         getText('rt-text[slot="title"]')
                         || getText('h1[data-qa="score-panel-movie-title"]')
                         || document.querySelector('score-board')?.getAttribute('title')
                         || 'N/A',
        criticScore:   getText('media-scorecard rt-text[slot="criticsScore"]')
                         || document.querySelector('score-board')?.getAttribute('tomatometerscore')
                         || 'N/A',
        audienceScore: getText('media-scorecard rt-text[slot="audienceScore"]')
                         || document.querySelector('score-board')?.getAttribute('audiencescore')
                         || 'N/A',
        genres:        getCat('Genre'),
        releaseDate:   Array.from(document.querySelectorAll('rt-text[slot="metadataProp"]'))
                           .map(e=>e.textContent.trim())
                           .find(t=>/released/i.test(t))||'N/A',
        image:         document.querySelector('media-scorecard rt-img[slot="posterImage"]')?.getAttribute('src')
                         || document.querySelector('img.posterImage')?.getAttribute('src')
                         || 'N/A'
      };
    }

    // 2) JSON-LD fallback
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const j = JSON.parse(ld.textContent);
        return {
          title:        j.name || 'N/A',
          criticScore:  j.aggregateRating?.ratingValue
                           ? `${j.aggregateRating.ratingValue}%`
                           : 'N/A',
          audienceScore:j.aggregateRating?.ratingCount
                           ? `${j.aggregateRating.ratingCount} votes`
                           : 'N/A',
          genres:       Array.isArray(j.genre) ? j.genre : [ j.genre ].filter(Boolean),
          releaseDate:  j.datePublished || 'N/A',
          image:        Array.isArray(j.image) ? j.image[0] : j.image || 'N/A'
        };
      } catch(e) {
        console.error('❌ [RT] JSON-LD parse error', e);
      }
    }

    // 3) fallback
    return {
      title:'N/A', criticScore:'N/A', audienceScore:'N/A',
      genres:[], releaseDate:'N/A', image:'N/A'
    };
  });

  console.log(`🎯 [RT] Data:`, data);
  console.timeEnd('[RT] Total time');
  return { ...data, url: page.url() };
}

module.exports = { scrapeRT };
