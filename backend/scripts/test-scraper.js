const { scrapeMovieDetails } = require('../utils/scrape.js');

(async () => {
    console.log('🚀 Starting scraper test...');

    try {
        const movieName = 'Inception';
        console.log(`🔎 Searching for: ${movieName}`);

        const data = await scrapeMovieDetails(movieName, { debug: true }); // Enable debug mode
        console.log('🎬 Scraped Data:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Scraper test failed:', error);
    } finally {
        console.log('✅ Scraper test completed.');
    }
})();
