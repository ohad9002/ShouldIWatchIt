// utils/scrapers/scrapeOscars.js

const { calculateSimilarity } = require('../similarity');

async function scrapeOscars(page, imdbDetailUrl) {
  const awardsUrl = imdbDetailUrl.replace(/\/?$/, '/') + 'awards/';
  console.log(`🎬 Scraping Oscars from IMDb awards page: ${awardsUrl}`);

  // block heavy assets
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /doubleverify|adobedtm|googletagmanager|analytics/.test(u)) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto(awardsUrl, {
    waitUntil: 'networkidle',
    timeout:    60000
  });

  // guard missing table
  try {
    await page.waitForSelector('table.awards', { timeout: 10000 });
  } catch (e) {
    console.warn('⚠️ No awards table found, skipping Oscars scrape.');
    return [];
  }

  const nominations = await page.$$eval('table.awards tr', rows => {
    return rows.map(r => {
      const catTd = r.querySelector('td.awards-category');
      const nomTd = r.querySelector('td.awards-outcome');
      if (!catTd || !nomTd) return null;
      const category = catTd.textContent.trim();
      const text = nomTd.textContent.trim().replace(/\s+/g, ' ');
      const isWin = text.toLowerCase().startsWith('winner');
      const statement = text.replace(/^(Winner:|Nominee:)\s*/i, '');
      return {
        originalCategory: category,
        fullCategory:     `${category}${statement ? ' – ' + statement : ''}`,
        isWin
      };
    }).filter(Boolean);
  });

  console.log(`✅ Extracted ${nominations.length} Oscar nominations/wins.`);
  return nominations;
}

module.exports = { scrapeOscars };
