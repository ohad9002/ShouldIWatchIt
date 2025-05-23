const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');

const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');

async function scrapeRT(page, movieTitle) {
  console.log(`🔍 [RT] Starting scrape for: "${movieTitle}"`);
  console.log(`📌 [RT] Direct‐searching via URL…`);

  // Build the search URL once
  const query = encodeURIComponent(movieTitle.trim());
  const searchUrl = `https://www.rottentomatoes.com/search?search=${query}`;

  // 1) Hit the search page
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`🔎 [RT] Loaded search page for “${movieTitle}”`);

  // 2) Extract and rank results inside a retry
  const bestMatch = await retry(async () => {
    console.log(`🕵️ [RT] Waiting for movie results…`);
    await page.waitForSelector('search-page-media-row', { timeout: 15000 });

    const results = await page.$$eval(
      'search-page-media-row',
      nodes => nodes.map(row => {
        const a = row.querySelector('a[slot="title"]');
        return { title: a?.textContent.trim()||'', url: a?.href||'' };
      })
    );
    console.log(`📊 [RT] Found ${results.length} results. Comparing with: "${movieTitle}"`);
    if (!results.length) throw new Error('no search results');

    let best = { similarity: -1 };
    for (let r of results) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [RT] Evaluating: "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    return best.url
      ? best
      : (() => { throw new Error('no matching URL'); })();
  }, { retries: 3, delayMs: 2000, factor: 2, jitter: true });

  console.log(`🚀 [RT] Navigating to best match: ${bestMatch.url}`);
  await page.goto(bestMatch.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log(`⏳ [RT] Waiting for media‐scorecard or score‐board...`);
  await page.waitForSelector('media-scorecard, score-board', { timeout: 7000 });

  const data = await page.evaluate(() => {
    const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
    const getFromCategory = lab => {
      for (let i of document.querySelectorAll('.category-wrap')) {
        if (i.querySelector('dt rt-text.key')?.innerText.trim() === lab) {
          return Array.from(i.querySelectorAll('dd [data-qa="item-value"]'))
                      .map(x => x.textContent.trim());
        }
      }
      return [];
    };
    return {
      title: getText('rt-text[slot="title"]') ||
             getText('h1[data-qa="score-panel-movie-title"]') ||
             document.querySelector('score-board')?.getAttribute('title') ||
             'N/A',
      criticScore: getText('media-scorecard rt-text[slot="criticsScore"]') ||
                   document.querySelector('score-board')?.getAttribute('tomatometerscore') ||
                   'N/A',
      audienceScore: getText('media-scorecard rt-text[slot="audienceScore"]') ||
                     document.querySelector('score-board')?.getAttribute('audiencescore') ||
                     'N/A',
      genres: getFromCategory('Genre'),
      releaseDate: Array.from(document.querySelectorAll('rt-text[slot="metadataProp"]'))
                        .map(el=>el.textContent.trim())
                        .find(t=>t.toLowerCase().includes('released')) || 'N/A',
      image: (document.querySelector('media-scorecard rt-img[slot="posterImage"]')
              || document.querySelector('img.posterImage'))
              ?.getAttribute('src') || 'N/A'
    };
  });

  const result = { ...data, url: page.url() };
  console.log(`🎯 [RT] Final data extracted:`, JSON.stringify(result, null, 2));
  return result;
}

module.exports = { scrapeRT };
