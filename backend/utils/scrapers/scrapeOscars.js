//backend/utils/scrapers/scrapeOscars.js


const { calculateSimilarity } = require('../similarity');

async function scrapeOscars(page, movieTitle) {
  console.log(`🎬 [Oscars] Searching for "${movieTitle}"`);
  await page.goto('https://awardsdatabase.oscars.org/', {
    waitUntil: 'networkidle', timeout: 30000
  });

  await page.waitForSelector('#BasicSearchView_FilmTitle', { timeout: 5000 });
  await page.fill('#BasicSearchView_FilmTitle', movieTitle);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#resultscontainer', { timeout: 10000 });

  // 1) gather all film rows
  const films = await page.$$eval(
    '.row.awards-result-alpha.result-group.group-film-alpha',
    nodes => nodes.map(n => {
      const a = n.querySelector('.result-group-title a');
      const txt = a?.textContent.trim() || '';
      return { title: txt, url: a.href };
    })
  );
  if (!films.length) {
    console.warn('⚠️ [Oscars] No films found');
    return [];
  }

  // 2) normalize & score
  const norm = t => t.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
  const target = norm(movieTitle);
  films.forEach(f => {
    f.similarity = calculateSimilarity(norm(f.title), target);
  });
  films.sort((a,b) => b.similarity - a.similarity);

  const best = films[0];
  if (best.similarity < 0.5) {
    console.warn('⚠️ [Oscars] Best match too low:', best);
    return [];
  }
  console.log(`🏆 [Oscars] Best match "${best.title}" (${best.similarity.toFixed(2)})`);

  // 3) extract nominations for that title
  const results = await page.$$eval(
    '.row.awards-result-alpha.result-group.group-film-alpha',
    (nodes, bt) => {
      const normalize = str => str.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
      const bestNorm = normalize(bt);
      let out = [];
      nodes.forEach(n => {
        const t = n.querySelector('.result-group-title a')?.textContent.trim() || '';
        if (normalize(t) !== bestNorm) return;
        n.querySelectorAll('.result-details').forEach(d => {
          const cat  = d.querySelector('.awards-result-awardcategory-exact a')?.innerText.trim();
          const win  = !!d.querySelector('.glyphicon-star[title="Winner"]');
          if (cat) out.push({ category: cat, isWin: win });
        });
      });
      return out;
    },
    best.title
  );

  console.log(`✅ [Oscars] Extracted ${results.length} nominations`);
  return results;
}

module.exports = { scrapeOscars };

