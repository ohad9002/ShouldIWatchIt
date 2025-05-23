//backend/utils/scrapers/scrapeOscars.js


const { calculateSimilarity } = require("../similarity");

async function scrapeOscars(page, movieTitle) {
    console.log("🎬 Starting Oscars scraping...");

   
    await page.goto("https://awardsdatabase.oscars.org/", {
  waitUntil: 'networkidle',
  timeout: 60000       // give it up to 60s before failing
});
    await page.waitForSelector("input#BasicSearchView_FilmTitle");
    console.log("🔍 Typing movie title into Oscars search...");
    await page.fill("input#BasicSearchView_FilmTitle", movieTitle);
    await page.keyboard.press("Enter");

    console.log("⌛ Waiting for search results...");
    await page.waitForSelector("#resultscontainer", { timeout: 15000 });

    // Extract the section with films
    const matchingFilmData = await page.$$eval(
        ".row.awards-result-alpha.result-group.group-film-alpha",
        (films, movieTitle) => {
            const normalizeText = (text) =>
                text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

            return films.map((film) => {
                const title = film.querySelector(".result-group-title a").innerText.trim();
                const url = film.querySelector(".result-group-title a").href || null;
                return {
                    title,
                    normalizedTitle: normalizeText(title),
                    similarity: 0,
                    url,
                };
            });
        },
        movieTitle
    );

    if (!matchingFilmData.length) {
        console.warn("⚠️ No Oscar results found.");
        return [];
    }

    const normalizedMovieTitle = movieTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

    // Compute similarity for all results
    for (let entry of matchingFilmData) {
        entry.similarity = calculateSimilarity(entry.normalizedTitle, normalizedMovieTitle);
    }

    // Sort descending by similarity
    matchingFilmData.sort((a, b) => b.similarity - a.similarity);

    // Find the best match as before
    const bestMatch = matchingFilmData[0];
    console.log(`🏆 Best Oscars title match: "${bestMatch.title}" (similarity: ${bestMatch.similarity.toFixed(2)})`);

    if (bestMatch.similarity < 0.5) {
        console.warn("❌ Best match similarity too low. Ignoring Oscars results.");
        return [];
    }

    // Only extract nominations for the best match film
    const results = await page.$$eval(
        ".row.awards-result-alpha.result-group.group-film-alpha",
        (films, bestTitle) => {
            const normalizeText = (text) =>
                text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

            const bestNorm = normalizeText(bestTitle);
            let data = [];
            films.forEach((film) => {
                const filmTitle = film.querySelector(".result-group-title a")?.innerText.trim() || "";
                if (normalizeText(filmTitle) !== bestNorm) return; // Only process the best match

                const details = film.querySelectorAll(".result-details");
                details.forEach((detail) => {
                    const categoryEl = detail.querySelector(".awards-result-awardcategory-exact a");
                    const nomineeEl = detail.querySelector(".awards-result-nominationstatement a");
                    const characterEl = detail.querySelector(".awards-result-character-name");
                    const publicNoteEl = detail.querySelector(".awards-result-publicnote");
                    const isWin = !!detail.querySelector(".glyphicon-star[title='Winner']");

                    // Build the full category text
                    const parts = [];
                    if (categoryEl) parts.push(categoryEl.innerText.trim());
                    if (nomineeEl) parts.push(`-- ${nomineeEl.innerText.trim()}`);
                    if (characterEl) parts.push(`{"${characterEl.innerText.trim()}"}`);
                    if (publicNoteEl) parts.push(`[NOTE: ${publicNoteEl.innerText.trim()}]`);

                    // Add song title if present
                    const songTitleEl = detail.querySelector('.awards-result-songtitle');
                    if (songTitleEl) parts.push(`"${songTitleEl.innerText.trim()}"`);

                    // Add citation/description if present
                    const citationEl = detail.querySelector('.awards-result-citation a');
                    if (citationEl) parts.push(citationEl.innerText.trim());

                    const fullCategory = parts.join(" ");

                    if (categoryEl) {
                        data.push({
                            originalCategory: categoryEl.innerText.trim(),
                            fullCategory,
                            isWin,
                        });
                    }
                });
            });
            return data;
        },
        bestMatch.title
    );

    console.log(`✅ Extracted ${results.length} Oscar nominations.`);
    return results;
}

module.exports = { scrapeOscars };
