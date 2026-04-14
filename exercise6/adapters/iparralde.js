// adapters/iparralde.js - Scraper for inmobiliariaiparralde.com

const { chromium } = require('playwright');

module.exports = {
  siteId: 'iparralde',

  list: async function(params) {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // Go directly to listings page  
      await page.goto('https://inmobiliariaiparralde.com/inmuebles/listado_de_inmuebles', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await page.waitForLoadState('networkidle');

      // Extract listings - deduplicate by ID and extract data properly
      const listings = await page.evaluate(() => {
        const itemsMap = {};
        
        // Get all unique property links
        const propertyLinks = document.querySelectorAll('a[href*="/inmueble_detalles/"]');
        
        propertyLinks.forEach(link => {
          try {
            const detailUrl = link.href;
            const id = detailUrl.split('/').pop();
            
            // Skip if already processed or invalid ID
            if (!id || !id.match(/^\d+$/) || itemsMap[id]) {
              return;
            }

            // Find the parent article or card that contains this link
            let container = link.closest('div[role="article"]') || link.closest('[class*="card"]') || link.closest('form');
            if (!container) {
              container = link.parentElement?.parentElement;
            }

            let title = 'N/A';
            let price = 'N/A';
            let location = 'Spain / France';

            if (container) {
              const containerText = container.innerText || container.textContent;

              // Extract title - from link text or element
              title = link.innerText || link.textContent;
              title = title.trim().substring(0, 150);

              // Extract price - look for € symbol with numbers
              const priceMatch = containerText.match(/([\d.,]+)\s*€/);
              if (priceMatch) {
                price = priceMatch[0];
              }

              // Extract location - look for cities or postal codes
              const cityMatch = containerText.match(/(Hendaye|Irun|Hondarribia|Hendaia|Donostia|Arantza|Irún)/i);
              if (cityMatch) {
                location = cityMatch[1];
              } else {
                const zipMatch = containerText.match(/(\d{4,5})\s+([A-Za-z\s]+)/);
                if (zipMatch) {
                  location = zipMatch[1] + ' ' + zipMatch[2].trim();
                }
              }
            }

            // Only add if we have at least id and a reasonable title
            if (id && title && title.length > 2 && title !== 'N/A' && !title.includes('Ver')) {
              itemsMap[id] = {
                id: id.toString(),
                title: title.trim(),
                price: price.trim(),
                location: location.trim(),
                detailUrl: detailUrl
              };
            }
          } catch (err) {
            // Skip problematic links
          }
        });

        return Object.values(itemsMap);
      });

      return listings;

    } finally {
      await browser.close();
    }
  }
};
