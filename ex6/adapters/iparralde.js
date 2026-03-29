// adapters/iparralde.js
const { chromium } = require('playwright');

module.exports = {
  siteId: 'iparralde',

  list: async function(params) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://inmobiliariaiparralde.com/');

    // Esperar a que los selects estén disponibles
    await page.waitForSelector('select[name="tipo"]', { timeout: 60000 });
    await page.waitForSelector('select[name="municipio"]', { timeout: 60000 });

    // Aplicar filtros
    await page.selectOption('select[name="tipo"]', 'piso');
    await page.selectOption('select[name="municipio"]', 'Hendaye');
    await page.click('button:has-text("Buscar")');

    // Esperar que los resultados carguen
    await page.waitForSelector('div.listing-card', { timeout: 60000 });

    const listings = [];
    const items = await page.$$('div.listing-card');
    for (const item of items) {
      const detailUrl = await item.$eval('a', a => a.href);
      listings.push({
        id: detailUrl.split('/').pop(),
        title: await item.$eval('h2', h => h.innerText),
        price: await item.$eval('.price', el => el.innerText),
        location: await item.$eval('.location', el => el.innerText),
        detailUrl,
        scrapingTimestamp: new Date().toISOString()
      });
    }

    await browser.close();
    return listings;
  }
};
