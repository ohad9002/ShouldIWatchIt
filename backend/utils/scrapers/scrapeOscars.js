// utils/scrapers/scrapeOscars.js

/**
 * Now scrapes the IMDb awards page for a given title URL (must end in "/").
 */

const { calculateSimilarity } = require('../similarity');

async function scrapeOscars(page, imdbDetailUrl) {
  // imdbDetailUrl is like "https://www.imdb.com/title/tt1375666/"
  const awardsUrl = imdbDetailUrl.replace(/\/?$/, '/') + 'awards/';
  console.log(`🎬 Scraping Oscars from IMDb awards page: ${awardsUrl}`);

  await page.goto(awardsUrl, {
    waitUntil: 'networkidle',
    timeout:    60000
  });

  // wait for the awards table
  await page.waitForSelector('table.awards', { timeout: 15000 });

  // extract each row: category, nominee text, and whether it's a win
  const nominations = await page.$$eval('table.awards tr', rows => {
    return rows.map(r => {
      const catTd = r.querySelector('td.awards-category');
      const nomTd = r.querySelector('td.awards-outcome');
      if (!catTd || !nomTd) return null;
      const category = catTd.textContent.trim();
      // the nominee cell will have either "Winner:" or "Nominee:" text
      const text = nomTd.textContent.trim().replace(/\s+/g,' ');
      const isWin = text.toLowerCase().startsWith('winner');
      // strip "Winner: " or "Nominee: "
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
