const playwright = require('playwright');

const scrapeMovieDetails = async (movieName, options = { debug: false }) => {
    console.log(`🔍 Starting scrape for movie: ${movieName}`);
    let browser;
    let movieData = { rottenTomatoes: null, imdb: null, oscars: null };

    try {
        // Launch Playwright browser
        browser = await playwright.chromium.launch({
            headless: !options.debug,
            executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH || undefined, // Use the correct browser path
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/114.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();

        /** ========================== Rotten Tomatoes ========================== **/
        try {
            console.log('📌 Navigating to Rotten Tomatoes...');
            await page.goto(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(movieName)}`, {
                timeout: 15000,
                waitUntil: 'domcontentloaded'
            });

            console.log('🔎 Waiting for Rotten Tomatoes search results...');
            await page.waitForSelector('search-page-result[type="movie"] ul[slot="list"] search-page-media-row[data-qa="data-row"]', { timeout: 10000 }).catch(() => {
                console.log('⚠️ No search results found on Rotten Tomatoes.');
            });

            console.log('🔎 Searching for Rotten Tomatoes results...');
            const results = await page.$$('search-page-result[type="movie"] ul[slot="list"] search-page-media-row[data-qa="data-row"]'); // Select only movie results

            if (results.length > 0) {
                console.log(`✅ Found ${results.length} Rotten Tomatoes results. Evaluating...`);

                // Extract search results
                const resultsData = await Promise.all(
                    results.map(async (result, index) => {
                        try {
                            const title = await result.$eval('a[data-qa="info-name"]', (el) => el.innerText.trim()).catch(() => null);
                            const url = await result.$eval('a[data-qa="info-name"]', (el) => el.href).catch(() => null);
                            const releaseYear = await result.getAttribute('releaseyear'); // Extract release year directly from the attribute

                            if (!title || !url) {
                                console.log(`⚠️ Failed to extract title or URL for result at index ${index}.`);
                            }

                            return { title, url, releaseYear };
                        } catch (error) {
                            console.log(`❌ Error extracting result at index ${index}:`, error);
                            return null;
                        }
                    })
                );

                // Filter out invalid results
                const validResults = resultsData.filter((result) => result && result.title && result.url);

                if (validResults.length === 0) {
                    console.log('⚠️ No valid results found on Rotten Tomatoes.');
                } else {
                    console.log(`✅ Found ${validResults.length} valid Rotten Tomatoes results.`);
                }

                // Normalize text for comparison
                const normalizeText = (text) => {
                    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                };

                // Calculate similarity score using Levenshtein distance
                const calculateSimilarity = (a, b) => {
                    const distance = (a, b) => {
                        const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
                            Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
                        );

                        for (let i = 1; i <= a.length; i++) {
                            for (let j = 1; j <= b.length; j++) {
                                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                                matrix[i][j] = Math.min(
                                    matrix[i - 1][j] + 1, // Deletion
                                    matrix[i][j - 1] + 1, // Insertion
                                    matrix[i - 1][j - 1] + cost // Substitution
                                );
                            }
                        }

                        return matrix[a.length][b.length];
                    };

                    const maxLength = Math.max(a.length, b.length);
                    return maxLength === 0 ? 1 : 1 - distance(a, b) / maxLength;
                };

                // Evaluate and select the closest match
                console.log(`🔍 Evaluating results for query: "${movieName}"`);

                const closestMatch = validResults.reduce((bestMatch, result, index) => {
                    const normalizedTitle = normalizeText(result.title);
                    const normalizedQuery = normalizeText(movieName);
                    console.log(`🔍 Evaluating result: "${result.title}" (Normalized: "${normalizedTitle}")`);

                    // Calculate similarity score
                    const similarity = calculateSimilarity(normalizedQuery, normalizedTitle);
                    console.log(`   🔹 Similarity score for "${result.title}": ${similarity}`);

                    // Prefer results with matching release years if available
                    const yearMatch = result.releaseYear && movieName.includes(result.releaseYear) ? 0.1 : 0;
                    console.log(`   🔹 Year match bonus for "${result.title}": ${yearMatch}`);

                    const totalScore = similarity + yearMatch;
                    console.log(`   🔹 Total score for "${result.title}": ${totalScore}`);

                    if (totalScore > bestMatch.similarity) {
                        console.log(`   ✅ New best match: "${result.title}"`);
                        return { ...result, similarity: totalScore };
                    }

                    return bestMatch;
                }, { title: null, url: null, similarity: 0 });

                // Handle the closest match
                if (closestMatch.url) {
                    console.log(`✅ Closest match found: "${closestMatch.title}" (${closestMatch.url})`);
                    await page.goto(closestMatch.url, { waitUntil: 'domcontentloaded' });

                    // Extract Rotten Tomatoes data
                    movieData.rottenTomatoes = await page.evaluate(() => {
                        const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'N/A';

                        // Extract the title
                        let title = document.querySelector('rt-text[slot="title"]')?.innerText.trim() || 'N/A';

                        // Extract the genres
                        let genres = [];
                        const dtElements = document.querySelectorAll('dt.key'); // Select all <dt> elements with the class "key"
                        dtElements.forEach((dt) => {
                            if (dt.innerText.trim() === 'Genre') {
                                const genreElements = dt.nextElementSibling?.querySelectorAll('rt-link[data-qa="item-value"]');
                                genres = genreElements ? Array.from(genreElements).map((el) => el.innerText.trim()) : [];
                            }
                        });

                        // Extract the release date
                        let releaseDate = 'N/A';
                        const categoryWraps = document.querySelectorAll('.category-wrap');
                        categoryWraps.forEach((wrap) => {
                            const label = wrap.querySelector('dt.key')?.innerText.trim();
                            if (label === 'Release Date (Theaters)') {
                                releaseDate = wrap.querySelector('dd[data-qa="item-value-group"] rt-text[data-qa="item-value"]')?.innerText.trim() || 'N/A';
                            }
                        });

                        // Extract the image
                        let image = 'N/A';
                        const imageElement = document.querySelector('img.posterImage') || document.querySelector('rt-img[slot="posterImage"]');
                        if (imageElement) {
                            image = imageElement.src || imageElement.getAttribute('src') || 'N/A';
                        }

                        // Debugging: Log the extracted elements and their attributes
                        console.log('🔍 Debugging Rotten Tomatoes Extraction:');
                        console.log('   - Title:', title);
                        console.log('   - Genres:', genres);
                        console.log('   - Release Date:', releaseDate);
                        console.log('   - Image Element:', imageElement ? imageElement.outerHTML : 'Not Found');
                        console.log('   - Image URL:', image);

                        return {
                            title,
                            criticScore: getText('rt-text[slot="criticsScore"]'),
                            audienceScore: getText('rt-text[slot="audienceScore"]'),
                            genres,
                            releaseDate,
                            image,
                            url: window.location.href
                        };
                    });

                    // Fallback for title extraction from URL
                    if (!movieData.rottenTomatoes.title || movieData.rottenTomatoes.title === 'N/A') {
                        const urlParts = movieData.rottenTomatoes.url.split('/m/');
                        if (urlParts.length > 1) {
                            movieData.rottenTomatoes.title = urlParts[1].replace(/_/g, ' ').trim();
                        }
                    }

                    // Normalize genres
                    const normalizeGenre = (genre) => {
                        return genre
                            .replace('&', ',') // Split "Mystery & Thriller" into separate genres
                            .trim();
                    };

                    movieData.rottenTomatoes.genres = movieData.rottenTomatoes.genres
                        .flatMap((g) => normalizeGenre(g).split(',').map((g) => g.trim()))
                        .filter((g, index, self) => g && self.indexOf(g) === index); // Remove duplicates

                    console.log('✅ Rotten Tomatoes data extracted:', movieData.rottenTomatoes);
                } else {
                    console.log('⚠️ No close match found on Rotten Tomatoes. Falling back to the first result.');

                    // Fallback to the first result
                    const fallbackResult = validResults[0];
                    if (fallbackResult && fallbackResult.url) {
                        console.log(`⚠️ Using fallback result: "${fallbackResult.title}" (${fallbackResult.url})`);
                        await page.goto(fallbackResult.url, { waitUntil: 'domcontentloaded' });

                        // Extract Rotten Tomatoes data
                        movieData.rottenTomatoes = await page.evaluate(() => {
                            const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'N/A';

                            const genreElements = document.querySelectorAll('dd[data-qa="item-value-group"] rt-link[data-qa="item-value"]');
                            const genres = Array.from(genreElements).map((el) => el.innerText.trim());

                            let releaseDate = 'N/A';
                            const categoryWraps = document.querySelectorAll('.category-wrap');
                            categoryWraps.forEach((wrap) => {
                                const label = wrap.querySelector('dt .key')?.innerText.trim();
                                if (label === 'Release Date (Theaters)') {
                                    releaseDate = wrap.querySelector('dd[data-qa="item-value-group"] rt-text[data-qa="item-value"]')?.innerText.trim() || 'N/A';
                                }
                            });

                            return {
                                title: getText('h1'),
                                criticScore: getText('rt-text[slot="criticsScore"]'),
                                audienceScore: getText('rt-text[slot="audienceScore"]'),
                                genres,
                                releaseDate,
                                url: window.location.href
                            };
                        });

                        console.log('✅ Rotten Tomatoes data extracted (fallback):', movieData.rottenTomatoes);
                    } else {
                        console.log('⚠️ No valid fallback result available on Rotten Tomatoes.');
                    }
                }
            } else {
                console.log('⚠️ Rotten Tomatoes: No results found.');
            }
        } catch (error) {
            console.error('❌ Error scraping Rotten Tomatoes:', error);
        }


    /** ========================== IMDb ========================== **/
    try {
        console.log('📌 Navigating to IMDb...');
        await page.goto(`https://www.imdb.com/find?q=${encodeURIComponent(movieName)}&s=tt`, {
            timeout: 20000,
            waitUntil: 'domcontentloaded'
        });

        console.log('⏳ Waiting for IMDb search results...');
        const searchResults = await page.waitForSelector('.ipc-metadata-list-summary-item__t', { timeout: 10000 }).catch(() => null);

        if (searchResults) {
            console.log('✅ Found IMDb results. Clicking first one...');
            await searchResults.click({ force: true });

            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });

            console.log('📌 Extracting IMDb movie details...');
            await page.waitForTimeout(2000);

            movieData.imdb = await page.evaluate(() => {
                const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'N/A';
                const genres = [...document.querySelectorAll('.ipc-chip-list__scroller a.ipc-chip')].map(el => el.innerText.trim());

                return {
                    title: getText('h1'),
                    rating: getText('[data-testid="hero-rating-bar__aggregate-rating__score"] span') || 'N/A',
                    genres: genres.length > 0 ? genres : ['Unknown'],
                    url: window.location.href
                };
            });

            console.log(`🎯 IMDb Rating Extracted: ${movieData.imdb.rating}`);
        } else {
            console.log('⚠️ IMDb: No results found.');
        }
    } catch (error) {
        console.error('❌ Error scraping IMDb:', error);
    }

 /** ========================== Oscars Database ========================== **/
 try {
    console.log('📌 Navigating to Oscars Database...');
    await page.goto(`https://awardsdatabase.oscars.org/`, { timeout: 15000, waitUntil: 'domcontentloaded' });

    console.log('🔎 Searching for Oscars data...');
    const searchBox = await page.waitForSelector('#BasicSearchView_FilmTitle', { timeout: 10000 }).catch(() => null);

    if (searchBox) {
        // Use the IMDb title for the search, fallback to Rotten Tomatoes title or the original movie name
        const movieTitle = movieData.imdb?.title || movieData.rottentomatoes?.title || movieName;
        console.log(`🔍 Using movie title for Oscars search: "${movieTitle}"`);
        await searchBox.fill(movieTitle);
        await page.click('button[type="submit"]');

        await page.waitForTimeout(5000);

        console.log('🔎 Checking for Oscars search results...');
        const resultsContainer = await page.$('#resultscontainer');

        if (resultsContainer) {
            const movieSections = await resultsContainer.$$('.result-group-title a.nominations-link');
            let matchedSection = null;

            const normalizeText = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

            const calculateSimilarity = (a, b) => {
                const distance = (a, b) => {
                    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
                        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
                    );

                    for (let i = 1; i <= a.length; i++) {
                        for (let j = 1; j <= b.length; j++) {
                            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                            matrix[i][j] = Math.min(
                                matrix[i - 1][j] + 1,
                                matrix[i][j - 1] + 1,
                                matrix[i - 1][j - 1] + cost
                            );
                        }
                    }

                    return matrix[a.length][b.length];
                };

                const maxLength = Math.max(a.length, b.length);
                return maxLength === 0 ? 1 : 1 - distance(a, b) / maxLength;
            };

            const normalizedQuery = normalizeText(movieTitle);
            console.log(`🔍 Evaluating results for query: "${movieTitle}"`);

            matchedSection = await movieSections.reduce(async (bestMatchPromise, section) => {
                const bestMatch = await bestMatchPromise;

                const sectionTitle = await section.evaluate((el) => el.innerText.trim());
                const normalizedTitle = normalizeText(sectionTitle);

                const similarity = calculateSimilarity(normalizedQuery, normalizedTitle);
                console.log(`   🔹 Similarity score for "${sectionTitle}": ${similarity}`);

                if (similarity > bestMatch.similarity) {
                    return { section, similarity };
                }

                return bestMatch;
            }, Promise.resolve({ section: null, similarity: 0 }));

            if (matchedSection.section) {
                console.log(`✅ Found matching section for movie: "${movieTitle}"`);
                await matchedSection.section.click();
                await page.waitForTimeout(3000);

                const awards = await page.evaluate(() => {
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
                                fullCategory, // Preserve full description for frontend
                                isWin
                            });
                        }
                    });
                
                    return awardsData;
                });

                console.log('🏆 Oscars data extracted:', awards);
                movieData.oscars = awards;
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
}
} finally {
    if (browser) {
        await browser.close(); // Ensure the browser is always closed
    }
}

/** ========================== Genre Normalization & Cleaning ========================== **/
const normalizeGenre = (genre) => {
    return genre
        .replace(/\b(Epic|Psychological)\b/gi, '') // Remove unnecessary descriptors
        .replace('&', ',') // Split "Mystery & Thriller" into separate genres
        .trim();
};

movieData.genres = [
    ...(movieData.imdb?.genres || []),
    ...(movieData.rottentomatoes?.genres || [])
].flatMap(g => normalizeGenre(g).split(',').map(g => g.trim()))
    .filter((g, index, self) => g && self.indexOf(g) === index); // Remove duplicates

return movieData;
};

const normalizeOscarCategory = (category) => {
    const categoryMap = {
        "ACTOR": "Best Actor",
        "ACTOR IN A SUPPORTING ROLE": "Best Supporting Actor",
        "ACTRESS IN A LEADING ROLE": "Best Actress",
        "ACTRESS IN A SUPPORTING ROLE": "Best Supporting Actress",
        "COSTUME DESIGN": "Best Costume Design",
        "DIRECTING": "Best Director",
        "FILM EDITING": "Best Film Editing",
        "MUSIC (ORIGINAL DRAMATIC SCORE)": "Best Original Score",
        "MUSIC (ORIGINAL SONG)": "Best Original Song",
        "BEST PICTURE": "Best Picture",
        "SOUND": "Best Sound",
        "SOUND EDITING": "Best Sound", // Aggregate under Best Sound
        "SOUND MIXING": "Best Sound", // Aggregate under Best Sound
        "VISUAL EFFECTS": "Best Visual Effects",
        "ART DIRECTION": "Best Production Design",
        "PRODUCTION DESIGN": "Best Production Design",
        "CINEMATOGRAPHY": "Best Cinematography",
        "FOREIGN LANGUAGE FILM": "Best International Feature", // Correct mapping
        "WRITING (SCREENPLAY--BASED ON MATERIAL FROM ANOTHER MEDIUM)": "Best Adapted Screenplay",
        "WRITING (ORIGINAL SCREENPLAY)": "Best Original Screenplay"
    };

    const normalizedCategory = categoryMap[category.toUpperCase()] || category;
    console.log(`🔍 Normalizing category: "${category}" -> "${normalizedCategory}"`);
    return normalizedCategory;
};
// ✅ Export the function correctly
module.exports = { scrapeMovieDetails };