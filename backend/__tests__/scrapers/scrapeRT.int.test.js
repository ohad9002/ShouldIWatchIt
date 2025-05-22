//scrapeRT.int.test.js
const { scrapeRT } = require('../utils/scrapers/scrapeRT');
const playwright = require('playwright');

jest.setTimeout(30000);

describe('scrapeRT (integration)', () => {
  it('scrapes real Rotten Tomatoes data for The Godfather', async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    const data = await scrapeRT(browser, 'The Godfather');

    await browser.close();

    expect(data).toBeTruthy();
    expect(data.title.toLowerCase()).toContain('godfather');
    expect(data.criticScore).not.toBe('N/A');
    expect(data.genres.length).toBeGreaterThan(0);
    expect(data.url).toMatch(/^https:\/\/www\.rottentomatoes\.com/);
  });
});
