//backend/utils/scrapers/scrapeRT.js

const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const scrapeRT = async (page, movieTitle) => {
  console.log(`🔍 [RT] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [RT] Navigating to https://www.rottentomatoes.com...`);

  try {
    return await retry(async () => {
          await page.goto('https://www.rottentomatoes.com/', {
  waitUntil: 'networkidle',
  timeout: 60000       // give it up to 60s before failing
});

      console.log(`🔎 [RT] Waiting for search input...`);
      await page.waitForSelector('input[data-qa="search-input"]', { timeout: 10000 });

      console.log(`⌨️ [RT] Typing and submitting search: "${movieTitle}"`);
      await page.click('input[data-qa="search-input"]');
      await page.fill('input[data-qa="search-input"]', movieTitle);
      await page.keyboard.press('Enter');

      console.log(`⏳ [RT] Waiting for search results page...`);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });

      console.log(`🕵️ [RT] Waiting for movie results in "Movies" section...`);
      await page.waitForSelector('search-page-result[type="movie"] search-page-media-row', { timeout: 7000 });

      const searchResults = await page.$$eval(
        'search-page-result[type="movie"] search-page-media-row',
        nodes => nodes.map(row => {
          const anchor = row.querySelector('a[slot="title"]');
          return {
            title: anchor?.textContent?.trim() || '',
            url: anchor?.href || ''
          };
        })
      );

      console.log(`📊 [RT] Found ${searchResults.length} movie results. Comparing with: "${movieTitle}"`);

      if (!searchResults.length) {
        console.warn(`⚠️ [RT] No movie search results found in Movies section.`);
        return null;
      }

      const queryNormalized = normalize(movieTitle);
      let bestMatch = { similarity: -1 };

      for (const result of searchResults) {
        // CHANGE: Use raw titles for similarity
        const simScore = calculateSimilarity(result.title || '', movieTitle);

        console.log(`🔍 [RT] Evaluating: "${result.title}"`);
        console.log(`   🔹 Similarity score: ${simScore}`);

        if (simScore > bestMatch.similarity) {
          bestMatch = { ...result, similarity: simScore };
          console.log(`   ✅ New best match: "${result.title}"`);
        }
      }

      if (!bestMatch.url) {
        console.warn(`⚠️ [RT] No matching URL found after evaluation`);
        return null;
      }

      console.log(`🚀 [RT] Navigating to best match: ${bestMatch.url}`);
          await page.goto(bestMatch.url, {
  waitUntil: 'networkidle',
  timeout: 60000       // give it up to 60s before failing
});
      

      console.log(`⏳ [RT] Waiting for media-scorecard or score-board...`);
      await page.waitForSelector('media-scorecard, score-board', { timeout: 7000 });

      const data = await page.evaluate(() => {
        const getTextFromCategory = (label) => {
          const items = Array.from(document.querySelectorAll('.category-wrap'));
          for (const item of items) {
            const key = item.querySelector('dt rt-text.key')?.innerText?.trim();
            if (key === label) {
              const values = item.querySelectorAll('dd [data-qa="item-value"]');
              return Array.from(values).map(v => v.textContent.trim());
            }
          }
          return [];
        };

        const getPosterImage = () => {
          const img = document.querySelector('media-scorecard rt-img[slot="posterImage"]') ||
                      document.querySelector('img.posterImage');
          return img?.getAttribute('src') || 'N/A';
        };

        const getTextContent = (selector) => {
          const el = document.querySelector(selector);
          return el?.textContent?.trim() || 'N/A';
        };

        const criticScore = getTextContent('media-scorecard rt-text[slot="criticsScore"]') ||
                            document.querySelector('score-board')?.getAttribute('tomatometerscore') ||
                            'N/A';

        const audienceScore = getTextContent('media-scorecard rt-text[slot="audienceScore"]') ||
                              document.querySelector('score-board')?.getAttribute('audiencescore') ||
                              'N/A';

        const rawTitle = document.querySelector('rt-text[slot="title"]')?.textContent?.trim()
                       || document.querySelector('h1[data-qa="score-panel-movie-title"]')?.textContent?.trim()
                       || document.querySelector('score-board')?.getAttribute('title')
                       || 'N/A';

        const releaseDate = Array.from(document.querySelectorAll('rt-text[slot="metadataProp"]'))
          .map(el => el.textContent.trim())
          .find(text => text.toLowerCase().includes('released')) || 'N/A';

        return {
          title: rawTitle,
          criticScore,
          audienceScore,
          genres: getTextFromCategory('Genre'),
          releaseDate,
          image: getPosterImage()
        };
      });

      const result = { ...data, url: page.url() };

      console.log(`🎯 [RT] Final data extracted:`);
      console.log(JSON.stringify(result, null, 2));

      return result;
    }, {
      retries: 3,
      delayMs: 2000,
      factor: 2,
      jitter: true
    });
  } catch (err) {
    console.error(`🛑 [RT] All attempts failed for "${movieTitle}":\n${err.stack || err}`);
    return null;
  }
};

module.exports = { scrapeRT };
