const { chromium } = require('playwright');
const { fetchOMDb } = require('./fetchOMDb');
const { scrapeRT } = require('./scrapeRT');
const { scrapeOscars } = require('./scrapeOscars');
const { blockUnwantedResources } = require('../blockUnwantedResources');

async function parallelScrapeMovieDetails(movieTitle) {
  // IMDb is just an API call, so start it immediately
  const imdbPromise = fetchOMDb(movieTitle);

  // Start browser for RT and Oscars in parallel
  const browser = await chromium.launch({ headless: true });
  const [rtPage, oscarsPage] = await Promise.all([
    browser.newPage(),
    browser.newPage()
  ]);

  // Block unwanted resources for both pages
  await Promise.all([
    blockUnwantedResources(rtPage),
    blockUnwantedResources(oscarsPage)
  ]);

  // Start both scrapers in parallel
  const [rtData, oscarsData, imdbData] = await Promise.all([
    scrapeRT(rtPage, movieTitle),
    scrapeOscars(oscarsPage, movieTitle),
    imdbPromise
  ]);

  await browser.close();

  // Compose result
  return {
    imdb: imdbData,
    rottenTomatoes: rtData,
    oscars: oscarsData,
    genres: [
      ...(imdbData?.genres || []),
      ...(rtData?.genres || [])
    ].filter((v, i, arr) => arr.indexOf(v) === i)
  };
}

module.exports = { parallelScrapeMovieDetails };