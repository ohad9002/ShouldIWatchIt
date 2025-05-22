//scrapeOscars.int.test.js
const { scrapeOscars } = require('../utils/scrapers/scrapeOscars');
const playwright = require('playwright');

jest.setTimeout(30000);

describe('scrapeOscars (integration)', () => {
  it('scrapes Oscars nominations for The Godfather', async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    const data = await scrapeOscars(browser, 'The Godfather');

    await browser.close();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('originalCategory');
    expect(data[0]).toHaveProperty('fullCategory');
  });
});
