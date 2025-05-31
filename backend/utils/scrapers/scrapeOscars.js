const { calculateSimilarity } = require('../similarity');
const { blockUnwantedResources } = require('../blockUnwantedResources');

async function scrapeOscars(page, movieTitle) {
  console.log("🎬 Starting Oscars scraping…");

  await blockUnwantedResources(page);

  page.on('requestfailed', req => {
    console.error(`❌ [Oscars] Request failed: ${req.url()} → ${req.failure()?.errorText}`);
  });
  page.on('pageerror', err => {
    console.error(`⚠️ [Oscars] Page error:`, err);
  });

  try {
    await page.goto("https://awardsdatabase.oscars.org/", {
      waitUntil: 'networkidle',
      timeout: 25000 // Shorter timeout
    });
    await page.waitForSelector("input#BasicSearchView_FilmTitle", { timeout: 7000 });
    console.log(`🔍 Typing "${movieTitle}"…`);
    await page.fill("input#BasicSearchView_FilmTitle", movieTitle);
    await page.keyboard.press("Enter");

    console.log("⌛ Waiting for results…");
    await page.waitForSelector("#resultscontainer", { timeout: 10000 });

    const films = await page.$$eval(
      ".row.awards-result-alpha.result-group.group-film-alpha",
      nodes => nodes.map(f => {
        const a = f.querySelector(".result-group-title a");
        const t = a?.innerText.trim() || '';
        return {
          title: t,
          normalizedTitle: t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
          url: a?.href || ''
        };
      })
    );

    if (!films.length) {
      console.warn("⚠️ No Oscar results found.");
      return [];
    }

    const norm = movieTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    films.forEach(f => {
      f.similarity = calculateSimilarity(f.normalizedTitle, norm);
    });
    films.sort((a,b) => b.similarity - a.similarity);

    const best = films[0];
    console.log(`🏆 Best match "${best.title}" (${best.similarity.toFixed(2)})`);
    if (best.similarity < 0.5) {
      console.warn("❌ Match too low—skipping Oscars.");
      return [];
    }

    const data = await page.$$eval(
      ".row.awards-result-alpha.result-group.group-film-alpha",
      (nodes, bestTitle) => {
        const norm = t => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        let out = [];
        nodes.forEach(f => {
          const title = f.querySelector(".result-group-title a")?.innerText.trim() || '';
          if (norm(title) !== norm(bestTitle)) return;
          f.querySelectorAll(".result-details").forEach(d => {
            const cat = d.querySelector(".awards-result-awardcategory-exact a");
            if (!cat) return;
            const nom = d.querySelector(".awards-result-nominationstatement a")?.innerText.trim();
            const win = !!d.querySelector(".glyphicon-star[title='Winner']");
            out.push({
              originalCategory: cat.innerText.trim(),
              fullCategory: [ cat.innerText.trim(), nom && `-- ${nom}` ].filter(Boolean).join(' '),
              isWin: win
            });
          });
        });
        return out;
      },
      best.title
    );

    console.log(`✅ Extracted ${data.length} Oscar nominations.`);
    return data;
  } catch (err) {
    console.error("❌ scrapeOscars error:", err.message);
    return [];
  }
}

module.exports = { scrapeOscars };
