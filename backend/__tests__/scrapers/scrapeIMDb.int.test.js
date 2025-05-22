//scrapeIMDb.int.test.js
const { scrapeIMDb } = require('../utils/scrapers/scrapeIMDb');
const playwright = require('playwright');

jest.setTimeout(30000);

describe('scrapeIMDb (integration)', () => {
  it('scrapes real IMDb data for The Godfather', async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    const data = await scrapeIMDb(browser, 'The Godfather');

    await browser.close();

    expect(data).toBeTruthy();
    expect(data.title.toLowerCase()).toContain('godfather');
    expect(data.rating).not.toBe('N/A');
    expect(data.genres.length).toBeGreaterThan(0);
    expect(data.url).toMatch(/^https:\/\/www\.imdb\.com/);
  });
});
