// backend/utils/scrapers/scrapeRT.js

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

  // Block heavy and ad/analytics requests
  await page.route('**/*', route => {
    const url = route.request().url();
    if (
      url.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/) ||
      /doubleverify|adobedtm|amazon\.com|googletagmanager|analytics/.test(url)
    ) {
      return route.abort();
    }
    return route.continue();
  });

  // Log failures
  page.on('requestfailed', req => {
    console.error(`❌ [RT] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [RT] Page error:`, err);
  });

  const query     = encodeURIComponent(movieTitle.trim());
  const searchUrl = `https://www.rottentomatoes.com/search?search=${query}`;

  console.time('[RT] Total time');
  console.time('[RT] goto-search');
  await safeGoto(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  console.timeEnd('[RT] goto-search');
  console.log(`🔎 [RT] Loaded search page for "${movieTitle}"`);

  const bestMatch = await retry(async () => {
    console.time('[RT] wait-results');
    await page.waitForSelector('search-page-media-row', { timeout: 30000 });
    console.timeEnd('[RT] wait-results');

    const results = await page.$$eval(
      'search-page-media-row',
      nodes => nodes.map(row => {
        const a = row.querySelector('a[slot="title"]');
        return { title: a?.textContent.trim() || '', url: a?.href || '' };
      })
    );
    console.log(`📊 [RT] Found ${results.length} results vs "${movieTitle}"`);
    if (!results.length) throw new Error('no search results');

    let best = { similarity: -1 };
    for (const r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [RT] Evaluating "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    if (!best.url) throw new Error('no matching URL');
    return best;
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });

  console.log(`🚀 [RT] Best match: ${bestMatch.title} → ${bestMatch.url}`);
  console.time('[RT] goto-detail');
  await safeGoto(page, bestMatch.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  console.timeEnd('[RT] goto-detail');

  console.time('[RT] wait-detail');
  await page.waitForSelector('media-scorecard, score-board', { timeout: 20000 });
  console.timeEnd('[RT] wait-detail');

  const data = await page.evaluate(() => {
    const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
    const getFromCategory = label => {
      for (const item of document.querySelectorAll('.category-wrap')) {
        if (item.querySelector('dt rt-text.key')?.innerText.trim() === label) {
          return Array.from(item.querySelectorAll('dd [data-qa="item-value"]'))
                      .map(v => v.textContent.trim());
        }
      }
      return [];
    };
    const getImg = () =>
      document.querySelector('media-scorecard rt-img[slot="posterImage"]')?.getAttribute('src')
      || document.querySelector('img.posterImage')?.getAttribute('src')
      || 'N/A';

    return {
      title:        getText('rt-text[slot="title"]')
                    || getText('h1[data-qa="score-panel-movie-title"]')
                    || document.querySelector('score-board')?.getAttribute('title')
                    || 'N/A',
      criticScore:  getText('media-scorecard rt-text[slot="criticsScore"]')
                    || document.querySelector('score-board')?.getAttribute('tomatometerscore')
                    || 'N/A',
      audienceScore:getText('media-scorecard rt-text[slot="audienceScore"]')
                    || document.querySelector('score-board')?.getAttribute('audiencescore')
                    || 'N/A',
      genres:       getFromCategory('Genre'),
      releaseDate:  Array.from(document.querySelectorAll('rt-text[slot="metadataProp"]'))
                    .map(el => el.textContent.trim())
                    .find(t => /released/i.test(t)) || 'N/A',
      image:        getImg()
    };
  });

  console.log(`🎯 [RT] Data:`, JSON.stringify(data, null, 2));
  console.timeEnd('[RT] Total time');
  return { ...data, url: page.url() };
}

module.exports = { scrapeRT };
