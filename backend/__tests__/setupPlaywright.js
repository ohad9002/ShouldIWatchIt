const { chromium } = require('playwright');

const setupBrowser = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  return { browser, page };
};

const teardownBrowser = async (browser) => {
  if (browser) {
    await browser.close();
  }
};

module.exports = {
  setupBrowser,
  teardownBrowser
};
