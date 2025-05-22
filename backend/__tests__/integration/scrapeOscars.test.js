const { setupBrowser, teardownBrowser } = require('../setupPlaywright');
const { scrapeOscars } = require('../../utils/scrapers/scrapeOscars');

jest.setTimeout(60000);

let browser, page;

beforeAll(async () => {
  ({ browser, page } = await setupBrowser());
});

afterAll(async () => {
  await teardownBrowser(browser);
});

describe('scrapeOscars', () => {
  it('should return Oscars data for a real movie', async () => {
    const results = await scrapeOscars(page, 'The Godfather');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('originalCategory');
    expect(results[0]).toHaveProperty('fullCategory');
  });

  it('should return empty array for fake movie', async () => {
    const results = await scrapeOscars(page, 'ZZZFakeMovieWithNoAwards123');
    expect(results).toEqual([]);
  });
});
