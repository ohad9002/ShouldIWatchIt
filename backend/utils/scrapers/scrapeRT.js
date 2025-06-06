const { retry } = require('../retry');
const { calculateSimilarity } = require('../similarity');
const { blockUnwantedResources } = require('../blockUnwantedResources');

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

  // Block images, fonts, ads, analytics for speed
  await blockUnwantedResources(page);
  page.on('requestfailed', req => {
    console.error(`❌ [RT] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [RT] Page error:`, err);
  });

  const q = encodeURIComponent(movieTitle.trim());
  const searchUrl = `https://www.rottentomatoes.com/search?search=${q}`;

  try {
    console.time('[RT] Total time');
    console.time('[RT] goto-search');
    await safeGoto(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }); // Shorter timeout
    console.timeEnd('[RT] goto-search');

    console.time('[RT] wait-search');
    await page.waitForSelector('search-page-media-row', { timeout: 5000 }); // Shorter timeout
    console.timeEnd('[RT] wait-search');

    // pull the list of results
    const list = await page.$$eval('search-page-media-row', nodes =>
      nodes.map(n => {
        const a = n.querySelector('a[slot="title"]');
        return { title: a?.textContent.trim() || '', url: a?.href || '' };
      })
    );
    console.log(`📊 [RT] Found ${list.length} results vs "${movieTitle}"`);
    if (!list.length) return null;

    // choose best fuzzy match
    let best = { similarity: -1 };
    for (const r of list) {
      const s = calculateSimilarity(r.title, movieTitle);
      console.log(`🔍 [RT] Score "${r.title}" → ${s.toFixed(3)}`);
      if (s > best.similarity) best = { ...r, similarity: s };
    }
    if (!best.url) return null;

    console.log(`🚀 [RT] Best match → ${best.url}`);
    console.time('[RT] goto-detail');
    await safeGoto(page, best.url, { waitUntil: 'domcontentloaded', timeout: 10000 }); // Shorter timeout
    console.timeEnd('[RT] goto-detail');

    // wait for any of the score widgets or JSON-LD
    await Promise.any([
      page.waitForSelector('media-scorecard', { timeout: 5000 }),
      page.waitForSelector('score-board',    { timeout: 5000 }),
      page.waitForSelector('script[type="application/ld+json"]', { timeout: 5000 })
    ]).catch(() => {});

    // extract the data
    const data = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent.trim() || 'N/A';
      const getCat  = label => {
        for (const el of document.querySelectorAll('.category-wrap')) {
          if (el.querySelector('dt rt-text.key')?.innerText.trim() === label) {
            return Array.from(el.querySelectorAll('dd [data-qa="item-value"]'))
                        .map(x => x.textContent.trim());
          }
        }
        return [];
      };

      // 1) DOM-based extraction
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
                             .map(e => e.textContent.trim())
                             .find(t => /released/i.test(t)) || 'N/A',
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

      // 3) ultimate fallback
      return {
        title: 'N/A',
        criticScore: 'N/A',
        audienceScore: 'N/A',
        genres: [],
        releaseDate: 'N/A',
        image: 'N/A'
      };
    });

    console.log(`🎯 [RT] Data:`, data);
    console.timeEnd('[RT] Total time');

    return { ...data, url: page.url() };
  } catch (err) {
    console.error(`❌ [RT] scrapeRT error:`, err.message);
    return null;
  }
}

module.exports = { scrapeRT };
