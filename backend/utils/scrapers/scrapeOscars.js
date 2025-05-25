const { calculateSimilarity } = require('../similarity');
const { retry } = require('../retry');

async function safeGoto(page, url, options) {
  return await retry(
    () => page.goto(url, options),
    { retries: 2, delayMs: 3000, factor: 2, jitter: true }
  );
}

async function scrapeOscars(page, movieTitle) {
  console.log("🎬 Starting Oscars scraping…");

  // block heavy assets
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.match(/\.(png|jpe?g|gif|svg|woff2?|ttf)$/i) ||
        /google-analytics|googletagmanager|doubleverify/.test(u)
    ) {
      return route.abort();
    }
    return route.continue();
  });

  await safeGoto(page, "https://awardsdatabase.oscars.org/", {
    waitUntil: 'networkidle',
    timeout:    60000
  });
  await page.waitForSelector("input#BasicSearchView_FilmTitle", { timeout: 15000 });
  await page.fill("input#BasicSearchView_FilmTitle", movieTitle);
  await page.keyboard.press("Enter");
  await page.waitForSelector("#resultscontainer", { timeout: 20000 });

  // collect the film entries
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
  if (!films.length) return [];

  // score by similarity
  const norm = movieTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  films.forEach(f => {
    f.similarity = calculateSimilarity(f.normalizedTitle, norm);
  });
  films.sort((a,b) => b.similarity - a.similarity);

  const best = films[0];
  if (best.similarity < 0.5) {
    console.warn("❌ Match too low—skipping Oscars.");
    return [];
  }

  // extract nominations for that film
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
          const nom = d.querySelector(".awards-result-nominationstatement a")?.innerText.trim();
          const win = !!d.querySelector(".glyphicon-star[title='Winner']");
          if (cat) {
            out.push({
              originalCategory: cat.innerText.trim(),
              fullCategory: [ cat.innerText.trim(), nom && `-- ${nom}` ].filter(Boolean).join(' '),
              isWin: win
            });
          }
        });
      });
      return out;
    },
    best.title
  );

  console.log(`✅ Extracted ${data.length} Oscar nominations.`);
  return data;
}

module.exports = { scrapeOscars };
