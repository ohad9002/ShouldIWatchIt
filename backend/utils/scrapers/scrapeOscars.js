// utils/scrapers/scrapeOscars.js

const { calculateSimilarity } = require("../similarity");

async function scrapeOscars(page, movieTitle) {
  console.log("🎬 Starting Oscars scraping…");
  await page.goto("https://awardsdatabase.oscars.org/", {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForSelector("input#BasicSearchView_FilmTitle");
  console.log("🔍 Typing movie title into Oscars search…");
  await page.fill("input#BasicSearchView_FilmTitle", movieTitle);
  await page.keyboard.press("Enter");

  console.log("⌛ Waiting for search results…");
  await page.waitForSelector("#resultscontainer", { timeout: 15000 });

  const matchingFilmData = await page.$$eval(
    ".row.awards-result-alpha.result-group.group-film-alpha",
    (films) => {
      const normalizeText = t => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      return films.map(f => {
        const title = f.querySelector(".result-group-title a").innerText.trim();
        const url   = f.querySelector(".result-group-title a").href || null;
        return {
          title,
          normalizedTitle: normalizeText(title),
          similarity:      0,
          url,
        };
      });
    }
  );

  if (!matchingFilmData.length) {
    console.warn("⚠️ No Oscar results found.");
    return [];
  }

  const normalizedMovieTitle = movieTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  for (let e of matchingFilmData) {
    e.similarity = calculateSimilarity(e.normalizedTitle, normalizedMovieTitle);
  }
  matchingFilmData.sort((a,b) => b.similarity - a.similarity);

  const bestMatch = matchingFilmData[0];
  console.log(`🏆 Best Oscars title match: "${bestMatch.title}" (sim=${bestMatch.similarity.toFixed(2)})`);
  if (bestMatch.similarity < 0.5) {
    console.warn("❌ Best match similarity too low. Ignoring Oscars results.");
    return [];
  }

  const results = await page.$$eval(
    ".row.awards-result-alpha.result-group.group-film-alpha",
    (films, best) => {
      const normalizeText = t => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const bestNorm = normalizeText(best);
      let data = [];
      films.forEach(film => {
        const title = film.querySelector(".result-group-title a")?.innerText.trim() || "";
        if (normalizeText(title) !== bestNorm) return;
        film.querySelectorAll(".result-details").forEach(detail => {
          const catEl    = detail.querySelector(".awards-result-awardcategory-exact a");
          const nomEl    = detail.querySelector(".awards-result-nominationstatement a");
          const charEl   = detail.querySelector(".awards-result-character-name");
          const noteEl   = detail.querySelector(".awards-result-publicnote");
          const isWin    = !!detail.querySelector(".glyphicon-star[title='Winner']");
          const parts    = [];
          if (catEl)  parts.push(catEl.innerText.trim());
          if (nomEl)  parts.push(`-- ${nomEl.innerText.trim()}`);
          if (charEl) parts.push(`{"${charEl.innerText.trim()}"}`);
          if (noteEl) parts.push(`[NOTE: ${noteEl.innerText.trim()}]`);

          const songEl     = detail.querySelector('.awards-result-songtitle');
          if (songEl) parts.push(`"${songEl.innerText.trim()}"`);
          const citationEl = detail.querySelector('.awards-result-citation a');
          if (citationEl) parts.push(citationEl.innerText.trim());

          const fullCat = parts.join(" ");
          if (catEl) {
            data.push({
              originalCategory: catEl.innerText.trim(),
              fullCategory:     fullCat,
              isWin
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
