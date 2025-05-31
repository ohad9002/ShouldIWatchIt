/**
 * Blocks images, fonts, ads, analytics, videos, and other non-essential resources in Playwright.
 * Call this at the top of each scraper before navigation.
 */
async function blockUnwantedResources(page) {
  await page.route('**/*', route => {
    const url = route.request().url();
    if (
      /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|otf|mp4|webm|css)$/i.test(url) ||
      /doubleverify|adobedtm|googletagmanager|analytics|fandango|cookielaw|justwatch|pagead2|flximg|flxster|scorecardresearch|googlesyndication|amazon-adsystem|pubmatic|rubiconproject|criteo|adsafeprotected|moatads|taboola|outbrain|trustarc|privacyportal|onetrust|statcdn|pix\.nbcuni|mpx|fonts\.gstatic|fonts\.googleapis|editorial\.rottentomatoes|resizing\.flixster/i
        .test(url)
    ) {
      return route.abort();
    }
    return route.continue();
  });
}

module.exports = { blockUnwantedResources };