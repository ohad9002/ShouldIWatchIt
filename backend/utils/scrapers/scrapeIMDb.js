//backend/utils/scrapers/scrapeIMDb.js




const { retry } = require('../retry');
const { calculateSimilarity, normalizeText } = require('../similarity');

const scrapeIMDb = async (page, movieTitle) => {
    console.log(`🔍 [IMDb] Starting scrape for: "${movieTitle}"`);
    console.log(`📌 [IMDb] Navigating to https://www.imdb.com...`);

    console.log(
  '🛠️ [DEBUG] scrapeIMDb is requiring similarity from:',
  require.resolve('../similarity')
);

    return await retry(async () => {
        try {
            await page.goto('https://www.imdb.com/', { waitUntil: 'domcontentloaded' });

            const searchInput = page.locator('input#suggestion-search');
            console.log(`🔎 [IMDb] Ensuring search input is visible and active...`);

            try {
                await page.click('label[for="navbar-search-category-select"]').catch(() => {});
                await searchInput.waitFor({ state: 'visible', timeout: 10000 });
            } catch (e) {
                console.error(`❌ [IMDb] Could not find visible search input.`);
                throw new Error('[IMDb] Search input not found or not visible in time.');
            }

            console.log(`⌨️ [IMDb] Typing and submitting search: "${movieTitle}"`);
            await searchInput.fill(movieTitle);
            await searchInput.press('Enter');

            console.log(`🚀 [IMDb] Waiting for search results page...`);
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });

            console.log(`📄 [IMDb] Searching Titles list...`);
            const searchResults = await page.$$eval('.find-title-result', nodes =>
                nodes.map(row => {
                    const anchor = row.querySelector('a');
                    const title = anchor?.textContent?.trim() || '';
                    const url = anchor?.href || '';
                    return { title, url };
                })
            );

            console.log(`📊 [IMDb] Found ${searchResults.length} movie results. Comparing with: "${movieTitle}"`);

            if (!searchResults.length) {
                console.warn(`⚠️ [IMDb] No movie search results found.`);
                return null;
            }

            const queryNormalized = normalizeText(movieTitle);
            let bestMatch = { similarity: -1 };

            for (const result of searchResults) {
                // CHANGE: Use raw titles for similarity
                const simScore = calculateSimilarity(result.title || '', movieTitle);

                console.log(`🔍 [IMDb] Evaluating: "${result.title}"`);
                console.log(`   🔹 Similarity score: ${simScore}`);

                if (simScore > bestMatch.similarity) {
                    bestMatch = { ...result, similarity: simScore };
                    console.log(`   ✅ New best match: "${result.title}"`);
                }
            }

            if (!bestMatch.url) {
                console.warn(`⚠️ [IMDb] No matching URL found after evaluation.`);
                return null;
            }

            console.log(`🚀 [IMDb] Navigating to best match: ${bestMatch.url}`);
            await page.goto(bestMatch.url, { waitUntil: 'domcontentloaded' });

            console.log(`⏳ [IMDb] Waiting for rating and title...`);
            await page.waitForSelector('h1', { timeout: 10000 });
            await page.waitForSelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span', { timeout: 10000 });

            const data = await page.evaluate(() => {
                const title = document.querySelector('h1')?.textContent?.trim() || 'N/A';
                const rating = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span')?.textContent?.trim() || 'N/A';
                const image = document.querySelector('.ipc-image')?.src || 'N/A';
                return {
                    title,
                    rating,
                    image,
                    url: window.location.href
                };
            });

            console.log(`🎯 [IMDb] Final data extracted:`);
            console.log(JSON.stringify(data, null, 2));
            return data;
        } catch (err) {
            console.error(`❌ [IMDb] Scrape failed:\n${err.stack || err}`);
            throw err;
        }
    });
};

module.exports = { scrapeIMDb };
