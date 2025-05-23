const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

const scrapeRT = async (page, movieTitle) => {
  console.log(`🔍 [RT] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [RT] Direct‐searching via URL…`);

  return await retry(async () => {
    // 1) Hit RT’s search page directly
    const query = encodeURIComponent(movieTitle.trim());
    await page.goto(
      `https://www.rottentomatoes.com/search?search=${query}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );
    console.log(`🔎 [RT] Loaded search page for "${movieTitle}"`);

    // 2) Wait for movie‐row cards
    console.log(`🕵️ [RT] Waiting for movie results…`);
    await page.waitForSelector('search-page-media-row', { timeout: 15000 });

    // 3) Extract all candidates
    const searchResults = await page.$$eval(
      'search-page-media-row',
      nodes => nodes.map(row => {
        const a = row.querySelector('a[slot="title"]');
        return {
          title: a?.textContent.trim() || '',
          url:   a?.href || ''
        };
      })
    );
    console.log(`📊 [RT] Found ${searchResults.length} results. Comparing with: "${movieTitle}"`);

    if (!searchResults.length) {
      console.warn(`⚠️ [RT] No movie search results found.`);
      return null;
    }

    // 4) Pick best match via similarity
    let bestMatch = { similarity: -1 };
    for (const r of searchResults) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [RT] Evaluating: "${r.title}" → ${s.toFixed(3)}`);
      if (s > bestMatch.similarity) {
        bestMatch = { ...r, similarity: s };
        console.log(`   ✅ New best match: "${r.title}"`);
      }
    }

    if (!bestMatch.url) {
      console.warn(`⚠️ [RT] No matching URL found after evaluation`);
      return null;
    }

    // 5) Navigate into the movie detail page
    console.log(`🚀 [RT] Navigating to best match: ${bestMatch.url}`);
    await page.goto(bestMatch.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 6) Scrape critic/audience scores & metadata
    console.log(`⏳ [RT] Waiting for media-scorecard or score-board...`);
    await page.waitForSelector('media-scorecard, score-board', { timeout: 7000 });

    const data = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      const getFromCategory = label => {
        for (let item of document.querySelectorAll('.category-wrap')) {
          if (item.querySelector('dt rt-text.key')?.innerText.trim() === label) {
            return Array.from(item.querySelectorAll('dd [data-qa="item-value"]'))
                        .map(el => el.textContent.trim());
          }
        }
        return [];
      };
      const getImg = () => {
        return document.querySelector('media-scorecard rt-img[slot="posterImage"]')?.src
            || document.querySelector('img.posterImage')?.src
            || 'N/A';
      };

      return {
        title:         getText('rt-text[slot="title"]') ||
                       getText('h1[data-qa="score-panel-movie-title"]') ||
                       document.querySelector('score-board')?.getAttribute('title') ||
                       'N/A',
        criticScore:   getText('media-scorecard rt-text[slot="criticsScore"]') ||
                       document.querySelector('score-board')?.getAttribute('tomatometerscore') ||
                       'N/A',
        audienceScore: getText('media-scorecard rt-text[slot="audienceScore"]') ||
                       document.querySelector('score-board')?.getAttribute('audiencescore') ||
                       'N/A',
        genres:        getFromCategory('Genre'),
        releaseDate:   Array.from(document.querySelectorAll('rt-text[slot="metadataProp"]'))
                            .map(el => el.textContent.trim())
                            .find(t => /released/i.test(t)) || 'N/A',
        image:         getImg()
      };
    });

    const result = { ...data, url: page.url() };
    console.log(`🎯 [RT] Final data extracted:`);
    console.log(JSON.stringify(result, null, 2));
    return result;

  }, {
    retries: 3,
    delayMs: 2000,
    factor:  2,
    jitter:  true
  });
};

module.exports = { scrapeRT };
