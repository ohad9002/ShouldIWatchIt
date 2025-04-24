const { normalizeGenre, normalizeOscarCategory } = require('../utils/normalization');
const { calculateSimilarity } = require('../utils/similarity');
const playwright = require('playwright');

const scrapeMovieDetails = async (movieName, options = {}) => {
    const browser = await playwright.chromium.launch({ headless: !options.debug });
    const imdbContext = await browser.newContext();
    const rtContext = await browser.newContext();
    const imdbPage = await imdbContext.newPage();
    const rtPage = await rtContext.newPage();

    const movieData = {
        imdb: null,
        rottentomatoes: null,
        oscars: [],
    };

    /** ========================== IMDb Scraping ========================== **/
    try {
        console.log('🌐 Navigating to IMDb...');
        await imdbPage.goto(`https://www.imdb.com/find?q=${encodeURIComponent(movieName)}`, {
            timeout: 15000,
            waitUntil: 'domcontentloaded'
        });

        const firstResult = await imdbPage.$('.findResult .result_text a');
        if (firstResult) {
            const movieUrl = await firstResult.getAttribute('href');
            const fullUrl = `https://www.imdb.com${movieUrl}`;
            await imdbPage.goto(fullUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });

            const imdbTitle = await imdbPage.title();
            const ratingElement = await imdbPage.$('span[itemprop="ratingValue"]');
            const genreElements = await imdbPage.$$('div[data-testid="genres"] a');
            const posterElement = await imdbPage.$('.ipc-image');

            const rating = ratingElement ? parseFloat(await ratingElement.innerText()) : null;
            const genres = genreElements ? await Promise.all(genreElements.map(el => el.innerText())) : [];

            const posterUrl = posterElement ? await posterElement.getAttribute('src') : null;

            movieData.imdb = {
                title: imdbTitle,
                rating,
                genres,
                image: posterUrl
            };
        } else {
            console.log('⚠️ IMDb: No results found.');
        }
    } catch (error) {
        console.error('❌ Error scraping IMDb:', error);
    }

    /** ========================== Rotten Tomatoes Scraping ========================== **/
    try {
        console.log('🍅 Navigating to Rotten Tomatoes...');
        await rtPage.goto(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(movieName)}`, {
            timeout: 15000,
            waitUntil: 'domcontentloaded'
        });

        const movieLink = await rtPage.$('.search-page-media-row a');
        if (movieLink) {
            const href = await movieLink.getAttribute('href');
            const movieUrl = `https://www.rottentomatoes.com${href}`;
            await rtPage.goto(movieUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });

            const rtTitle = await rtPage.title();

            const criticScoreElement = await rtPage.$('score-board');
            const audienceScoreElement = await rtPage.$('score-board');

            const criticScore = criticScoreElement
                ? parseFloat(await criticScoreElement.getAttribute('tomatometerscore'))
                : null;
            const audienceScore = audienceScoreElement
                ? parseFloat(await audienceScoreElement.getAttribute('audiencescore'))
                : null;

            const genreSpans = await rtPage.$$('ul.content-meta.info li.meta-row span[data-qa="movie-info-item-value"]');
            const genres = genreSpans
                ? await Promise.all(genreSpans.map(el => el.innerText()))
                : [];

            const posterElement = await rtPage.$('img.posterImage');
            const posterUrl = posterElement ? await posterElement.getAttribute('src') : null;

            movieData.rottentomatoes = {
                title: rtTitle,
                criticScore,
                audienceScore,
                genres,
                image: posterUrl
            };
        } else {
            console.log('⚠️ Rotten Tomatoes: No results found.');
        }
    } catch (error) {
        console.error('❌ Error scraping Rotten Tomatoes:', error);
    }

    /** ========================== Oscars Database ========================== **/
    try {
        console.log('📌 Navigating to Oscars Database...');
        await rtPage.goto(`https://awardsdatabase.oscars.org/`, {
            timeout: 15000,
            waitUntil: 'domcontentloaded'
        });

        console.log('🔎 Searching for Oscars data...');
        const searchBox = await rtPage.waitForSelector('#BasicSearchView_FilmTitle', { timeout: 10000 }).catch(() => null);

        if (searchBox) {
            const movieTitle = movieData.imdb?.title || movieData.rottentomatoes?.title || movieName;
            console.log(`🔍 Using movie title for Oscars search: "${movieTitle}"`);
            await searchBox.fill(movieTitle);
            await rtPage.click('button[type="submit"]');
            await rtPage.waitForTimeout(5000);

            const resultsContainer = await rtPage.$('#resultscontainer');
            if (resultsContainer) {
                const movieSections = await resultsContainer.$$('.result-group-title a.nominations-link');
                const normalizeText = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                const normalizedQuery = normalizeText(movieTitle);

                const matchedSection = await movieSections.reduce(async (bestMatchPromise, section) => {
                    const bestMatch = await bestMatchPromise;
                    const sectionTitle = await section.evaluate((el) => el.innerText.trim());
                    const normalizedTitle = normalizeText(sectionTitle);
                    const similarity = calculateSimilarity(normalizedQuery, normalizedTitle);

                    if (similarity > bestMatch.similarity) {
                        return { section, similarity };
                    }
                    return bestMatch;
                }, Promise.resolve({ section: null, similarity: 0 }));

                if (matchedSection.section) {
                    await matchedSection.section.click();
                    await rtPage.waitForTimeout(3000);

                    const awards = await rtPage.evaluate(() => {
                        const awardsData = [];
                        const awardRows = document.querySelectorAll('.result-details');

                        awardRows.forEach((row) => {
                            const categoryElement = row.querySelector('.awards-result-awardcategory-exact a');
                            const nomineeElement = row.querySelector('.awards-result-nominationstatement a');
                            const songTitleElement = row.querySelector('.awards-result-songtitle');
                            const characterElement = row.querySelector('.awards-result-character-name');
                            const publicNoteElement = row.querySelector('.awards-result-publicnote');
                            const isWin = row.querySelector('.glyphicon-star') !== null;

                            const descriptionParts = [];
                            if (categoryElement) descriptionParts.push(categoryElement.innerText.trim());
                            if (songTitleElement) descriptionParts.push(`"${songTitleElement.innerText.trim()}"`);
                            if (nomineeElement) descriptionParts.push(`-- ${nomineeElement.innerText.trim()}`);
                            if (characterElement) descriptionParts.push(`{"${characterElement.innerText.trim()}"}`);
                            if (publicNoteElement) {
                                const note = publicNoteElement.innerText.trim().replace(/\[NOTE: \[NOTE: /g, "[NOTE: ");
                                descriptionParts.push(`[NOTE: ${note}]`);
                            }

                            const fullCategory = descriptionParts.join(' ');
                            if (categoryElement) {
                                awardsData.push({
                                    originalCategory: categoryElement.innerText.trim(),
                                    fullCategory,
                                    isWin
                                });
                            }
                        });

                        return awardsData;
                    });

                    movieData.oscars = awards.map((award) => ({
                        ...award,
                        normalizedCategory: normalizeOscarCategory(award.originalCategory)
                    }));
                    console.log('🏆 Oscars data extracted:', movieData.oscars);
                } else {
                    console.log(`⚠️ No matching section found for movie: "${movieTitle}"`);
                    movieData.oscars = [];
                }
            } else {
                console.log('⚠️ Oscars: No results found.');
                movieData.oscars = [];
            }
        }
    } catch (error) {
        console.error('❌ Error scraping Oscars:', error);
        movieData.oscars = [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    console.log('✅ Scraping completed. Movie data:', movieData);
    if (options.debug) {
        console.log('🔍 Debugging mode: Browser will remain open.');
    } else {
        await rtContext.close();
        await imdbContext.close();
    }

    /** ========================== Combined Normalized Genres ========================== **/
    movieData.genres = [
        ...(movieData.imdb?.genres || []),
        ...(movieData.rottentomatoes?.genres || [])
    ]
    .flatMap(g => normalizeGenre(g).split(',').map(g => g.trim()))
    .filter((g, index, self) => g && self.indexOf(g) === index); // Remove duplicates

    return movieData;
};

module.exports = { scrapeMovieDetails };
