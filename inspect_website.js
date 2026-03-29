const { chromium } = require('playwright');

async function inspectWebsite() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Opening website for inspection...');
    await page.goto('https://inmobiliariaiparralde.com/', { waitUntil: 'networkidle' });

    // Log page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`\nPage Title: ${title}`);
    console.log(`Page URL: ${url}`);

    // Inspect form elements
    console.log('\n=== FORM INSPECTION ===');
    const formElements = await page.evaluate(() => {
      const elements = {
        selectElements: [],
        buttons: [],
        inputs: [],
        divElements: []
      };

      // Get all select elements
      document.querySelectorAll('select').forEach((sel, i) => {
        elements.selectElements.push({
          index: i,
          name: sel.name,
          id: sel.id,
          class: sel.className,
          options: Array.from(sel.options).map(o => o.textContent.trim()).slice(0, 5)
        });
      });

      // Get all buttons
      document.querySelectorAll('button').forEach((btn, i) => {
        elements.buttons.push({
          index: i,
          text: btn.textContent.trim().substring(0, 50),
          class: btn.className,
          id: btn.id,
          type: btn.type
        });
      });

      // Get all input elements
      document.querySelectorAll('input').forEach((inp, i) => {
        elements.inputs.push({
          index: i,
          name: inp.name,
          id: inp.id,
          type: inp.type,
          class: inp.className
        });
      });

      // Get elements that might contain listings
      const possibleContainers = [
        '.property-listing',
        '[data-property]',
        '.listing-item',
        '.property-item',
        '.inmueble',
        'article',
        '.property-card',
        '.resultado',
        '[class*="result"]',
        '.anuncio'
      ];

      possibleContainers.forEach(selector => {
        const count = document.querySelectorAll(selector).length;
        if (count > 0) {
          elements.divElements.push({
            selector: selector,
            count: count
          });
        }
      });

      return elements;
    });

    console.log('Select Elements Found:');
    console.log(JSON.stringify(formElements.selectElements, null, 2));

    console.log('\nButtons Found:');
    console.log(JSON.stringify(formElements.buttons, null, 2));

    console.log('\nInput Elements Found:');
    console.log(JSON.stringify(formElements.inputs, null, 2));

    console.log('\nPossible Property Container Selectors:');
    console.log(JSON.stringify(formElements.divElements, null, 2));

    // Try to interact and see the page
    console.log('\n\nBrowser window is open. Inspect the page manually and press Ctrl+C when done.');
    console.log('You can interact with the page - select filters and observe the results.');
    await page.pause();

  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    await browser.close();
  }
}

inspectWebsite();
