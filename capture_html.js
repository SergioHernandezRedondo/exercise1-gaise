const { chromium } = require('playwright');
const fs = require('fs');

async function captureHTML() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Opening website...');
    await page.goto('https://inmobiliariaiparralde.com/', { waitUntil: 'networkidle' });

    // Select filters
    console.log('Selecting filters...');
    try {
      await page.selectOption('select[name="tipoInmueble[]"]', { label: 'Piso' });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Error selecting tipo:', e.message);
    }
    
    try {
      await page.selectOption('select[name="municipio[]"]', { label: 'Hendaye' });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Error selecting municipio:', e.message);
    }
    
    try {
      await page.click('button[type="submit"]');
      console.log('Search button clicked');
      console.log('Waiting for results...');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Error clicking search:', e.message);
    }

    // Get detailed info including HTML structure
    const info = await page.evaluate(() => {
      const colMd4Elements = document.querySelectorAll('.col-md-4');
      
      const data = {
        url: window.location.href,
        totalColMd4: colMd4Elements.length,
        elements: []
      };

      colMd4Elements.forEach((el, idx) => {
        if (idx >= 10) return; // Only first 10 for inspection
        
        const link = el.querySelector('a');
        const href = link ? link.href : '';
        
        if (!href.includes('inmueble_detalles')) return; // Only property links
        
        // Get all the inner HTML to see the structure
        const innerHTML = el.innerHTML;
        
        // Try to extract specific info
        let title = '';
        let price = '';
        let location = '';
        
        // Look for common patterns in the HTML
        const titleMatch = innerHTML.match(/<h[2-4][^>]*>([^<]+)<\/h[2-4]>/);
        if (titleMatch) title = titleMatch[1];
        
        const priceMatch = innerHTML.match(/[\d.,]+\s*€/);
        if (priceMatch) price = priceMatch[0];
        
        const locationMatch = innerHTML.match(/\b(Hendaye|Irun|Arcangues)\b/i);
        if (locationMatch) location = locationMatch[0];
        
        const info = {
          index: idx,
          href: href,
          title: title || 'Not found',
          price: price || 'Not found',
          location: location || 'Not found',
          htmlLength: innerHTML.length,
          htmlSnippet: innerHTML.substring(0, 500)
        };
        data.elements.push(info);
      });

      return data;
    });

    console.log(JSON.stringify(info, null, 2));
    fs.writeFileSync('page-details.json', JSON.stringify(info, null, 2));
    console.log('\nPage details saved to page-details.json');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

captureHTML();
