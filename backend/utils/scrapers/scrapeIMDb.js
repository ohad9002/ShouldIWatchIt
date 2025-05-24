const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

// Retry‐wrapped goto
async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 1000, factor: 2, jitter: true }
  );
}

async function scrapeIMDb(page, movieTitle) {
  console.log(`🔍 [IMDb] Starting scrape for "${movieTitle}"`);
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /amazon\.com\/images|adobedtm|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });

  // 1) search page
  const q = encodeURIComponent(movieTitle.trim());
  const findUrl = `https://www.imdb.com/find?q=${q}&s=tt&ttype=ft`;
  await safeGoto(page, findUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.find-title-result', { timeout: 5000 });

  // 2) pick best
  const results = await page.$$eval('.find-title-result', rows =>
    rows.map(r => {
      const a = r.querySelector('a');
      return { title: a?.textContent.trim()||'', url: a?.href||'' };
    })
  );
  let best = { similarity: -1 };
  for (const r of results) {
    const s = calculateSimilarity(r.title, movieTitle);
    if (s > best.similarity) best = { ...r, similarity: s };
  }
  if (!best.url) throw new Error('No IMDb match');

  console.log(`🚀 [IMDb] Best match → ${best.url}`);
  await safeGoto(page, best.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 3) wait for JSON-LD
  await page.waitForSelector('script[type="application/ld+json"]', { timeout: 5000 });

  // 4) parse JSON-LD
  const data = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]');
    const j  = JSON.parse(el.textContent);
    return {
      title:  j.name || 'N/A',
      rating: j.aggregateRating?.ratingValue || 'N/A',
      image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
      url:    window.location.href
    };
  });

  console.log(`🎯 [IMDb] Data:`, data);
  return data;
}

module.exports = { scrapeIMDb };
