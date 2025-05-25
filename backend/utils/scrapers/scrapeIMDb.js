console.log('🆕 [IMDb Scraper] Loaded NEW scrapeIMDb.js');
// utils/scrapers/scrapeIMDb.js

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

  // 1️⃣ Use IMDb’s suggestion API to get the top feature-film match
  const q      = encodeURIComponent(movieTitle.trim());
  const cat    = movieTitle[0].toLowerCase();
  const sugUrl = `https://v2.sg.media-imdb.com/suggestion/${cat}/${q}.json`;

  let suggestions;
  try {
    const resp = await fetch(sugUrl);
    const json = await resp.json();
    suggestions = Array.isArray(json.d) ? json.d.filter(item => item.id && item.q === 'feature') : [];
  } catch (e) {
    console.error(`❌ [IMDb] Suggestion API error`, e);
    return null;
  }

  if (!suggestions.length) {
    console.error('❌ [IMDb] No suggestion-API candidates → aborting');
    return null;
  }

  const best = suggestions[0]; // top hit
  const detailUrl = `https://www.imdb.com/title/${best.id}/`;
  console.log(`🚀 [IMDb] Best match → ${detailUrl}`);

  // 2️⃣ Navigate to the title page
  await safeGoto(page, detailUrl, { waitUntil: 'networkidle', timeout: 90000 });

  // 3️⃣ Grab the JSON-LD block and parse out title, rating, image
  const data = await page.evaluate(() => {
    const script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: window.location.href };
    }
    try {
      const j = JSON.parse(script.textContent);
      return {
        title:  j.name             || 'N/A',
        rating: j.aggregateRating?.ratingValue || 'N/A',
        image:  Array.isArray(j.image) ? j.image[0] : j.image || 'N/A',
        url:    window.location.href
      };
    } catch (e) {
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: window.location.href };
    }
  });

  console.log(`🎯 [IMDb] Data:`, data);
  return data;
}

module.exports = { scrapeIMDb };
