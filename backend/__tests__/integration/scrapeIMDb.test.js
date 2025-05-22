const { setupBrowser, teardownBrowser } = require('../setupPlaywright');
const { scrapeIMDb } = require('../../utils/scrapers/scrapeIMDb');

jest.setTimeout(60000);

let browser, page;

beforeAll(async () => {
  ({ browser, page } = await setupBrowser());
});

afterAll(async () => {
  await teardownBrowser(browser);
});

describe('scrapeIMDb', () => {
  it('should return valid data for a real movie', async () => {
    const data = await scrapeIMDb(page, 'The Godfather');
    expect(data).not.toBeNull();
    expect(data.title.toLowerCase()).toContain('godfather');
    expect(data.rating).toMatch(/^\d+(\.\d+)?|N\/A$/);
    expect(Array.isArray(data.genres)).toBe(true);
    expect(data.url).toMatch(/^https:\/\/www\.imdb\.com\/title\//);
  });

  it('should return null for a fake movie', async () => {
    const data = await scrapeIMDb(page, 'ZZZNotARealMovie123456');
    expect(data).toBeNull();
  });
});
