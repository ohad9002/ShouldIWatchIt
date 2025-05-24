const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

// Retry‐wrapped goto
async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 1000, factor: 2, jitter: true }
  );
}

async function scrapeRT(page, movieTitle) {
  console.log(`🔍 [RT] Starting scrape for "${movieTitle}"`);
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /doubleverify|adobedtm|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });

  const q = encodeURIComponent(movieTitle.trim());
  const searchUrl = `https://www.rottentomatoes.com/search?search=${q}`;

  // 1) hit search
  await safeGoto(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('search-page-media-row', { timeout: 5000 });

  // 2) pick best match
  const list = await page.$$eval('search-page-media-row', nodes =>
    nodes.map(n => ({
      title:  n.querySelector('a[slot="title"]')?.textContent.trim() || '',
      url:    n.querySelector('a[slot="title"]')?.href || ''
    }))
  );
  let best = { similarity: -1 };
  for (const r of list) {
    const s = calculateSimilarity(r.title, movieTitle);
    if (s > best.similarity) best = { ...r, similarity: s };
  }
  if (!best.url) throw new Error('No RT match');

  console.log(`🚀 [RT] Best match → ${best.url}`);
  await safeGoto(page, best.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 3) wait only for JSON-LD
  await page.waitForSelector('script[type="application/ld+json"]', { timeout: 5000 });

  // 4) parse JSON-LD
  const data = await page.evaluate(() => {
    const ld = document.querySelector('script[type="application/ld+json"]');
    const j  = JSON.parse(ld.textContent);
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
      image:        Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
      url:          window.location.href
    };
  });

  console.log(`🎯 [RT] Data:`, data);
  return data;
}

module.exports = { scrapeRT };
