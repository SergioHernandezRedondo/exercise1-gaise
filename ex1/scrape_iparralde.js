const { chromium } = require('playwright');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // --- 1) Navegar y aplicar filtros ---
  await page.goto('https://inmobiliariaiparralde.com/');
  await page.selectOption('select[name="tipo"]', { label: 'Piso' });
  await page.selectOption('select[name="municipio"]', { label: 'Hendaye' });
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  const allResults = [];

  while (true) {
    // --- 2) Esperar a que aparezcan resultados ---
    await page.waitForSelector('a:has-text("Ver detalles")');

    // --- 3) Extraer datos de la página actual ---
    const pageData = await page.$$eval('a:has-text("Ver detalles")', links => {
      return links.map(link => {
        const card = link.closest('div');

        // EXTRACT title/description
        const textNodes = Array.from(card.querySelectorAll('div, p, h2, h3'))
          .map(el => el.textContent.trim())
          .filter(txt => !!txt);
        
        // Try to pick a sensible title
        const title = textNodes.find(txt => !/REF:/.test(txt) && !txt.includes('€')) || null;

        // LOCATION (code + city)
        const loc = textNodes.find(txt => /\d{5}\s+[A-Za-z]/.test(txt)) || null;

        // PRICE
        const price = textNodes.find(txt => txt.includes('€')) || null;

        const url = link.href;

        return { title, price, location: loc, url };
      });
    });

    // --- 4) Add id/timestamp and store
    const timestamp = new Date().toISOString();
    for (const item of pageData) {
      allResults.push({
        id: item.url ? crypto.createHash('md5').update(item.url).digest('hex') : null,
        title: item.title,
        price: item.price,
        location: item.location,
        url: item.url,
        scraped_at: timestamp
      });
    }

    // --- 5) Pagination: intentar pasar a la siguiente página ---
    const nextButton = await page.$('a:has-text("»"), a:has-text("Siguiente")');
    if (nextButton) {
      await Promise.all([
        page.waitForNavigation(),
        nextButton.click()
      ]);
    } else {
      break;
    }
  }

  await browser.close();

  // --- 6) Guardar resultados en JSON ---
  const out = JSON.stringify(allResults, null, 2);
  fs.writeFileSync('iparralde_hendaye_pisos.json', out);

  console.log(out);
})();