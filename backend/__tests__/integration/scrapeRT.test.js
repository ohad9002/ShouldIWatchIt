const { setupBrowser, teardownBrowser } = require('../setupPlaywright');
const { scrapeRT } = require('../../utils/scrapers/scrapeRT');

jest.setTimeout(60000);

let browser;

beforeAll(async () => {
  ({ browser } = await setupBrowser());
});

afterAll(async () => {
  await teardownBrowser(browser);
});

describe('scrapeRT', () => {
  it('should return valid RT data for a real movie', async () => {
    const result = await scrapeRT(browser, 'The Godfather');
    expect(result).not.toBeNull();
    expect(result.title.toLowerCase()).toContain('godfather');
    expect(result.criticScore).toMatch(/^\d+$|N\/A/);
    expect(result.audienceScore).toMatch(/^\d+$|N\/A/);
    expect(Array.isArray(result.genres)).toBe(true);
    expect(result.image).toMatch(/^https?:\/\/.+\.(jpg|png|jpeg|webp)/i);
    expect(result.url).toMatch(/^https:\/\/www\.rottentomatoes\.com/);
  });

  it('should return null for a fake movie', async () => {
    const result = await scrapeRT(browser, 'ZZZNonExistentMovie09876');
    expect(result).toBeNull();
  });
});
