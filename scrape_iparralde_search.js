const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');

// Helper function to generate MD5 hash from URL
function generateIdFromUrl(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Helper function to get current ISO8601 timestamp
function getCurrentTimestamp() {
  return new Date().toISOString();
}

// Main scraping function
async function scrapeProperties() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const allProperties = [];

  try {
    // Step 1: Open the website
    console.log('Opening website...');
    await page.goto('https://inmobiliariaiparralde.com/', { waitUntil: 'networkidle' });

    // Step 2: Select "Tipo de Inmueble" = Piso
    console.log('Selecting property type (Piso)...');
    try {
      // Using the correct name attribute
      await page.selectOption('select[name="tipoInmueble[]"]', { label: 'Piso' });
      console.log('Selected "Piso"');
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Error selecting type:', e.message);
    }

    // Step 3: Select "Municipio" = Hendaye
    console.log('Selecting municipality (Hendaye)...');
    try {
      // Using the correct name attribute
      await page.selectOption('select[name="municipio[]"]', { label: 'Hendaye' });
      console.log('Selected "Hendaye"');
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Error selecting municipality:', e.message);
    }

    // Step 4: Click the Search button
    console.log('Clicking search button...');
    try {
      // Try the submit button
      await page.click('button[type="submit"]');
      console.log('Clicked search button');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Error clicking search button:', e.message);
    }

    // Step 5: Wait for results page to load
    console.log('Waiting for results to load...');
    await page.waitForTimeout(3000);

    // Step 6 & 7: Extract properties and handle pagination
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= 10) {
      console.log(`\nProcessing page ${currentPage}...`);

      // Wait a bit for content to render
      await page.waitForTimeout(1500);

      // Extract property listings from the current page
      const properties = await page.evaluate(() => {
        const listings = [];
        
        // Property containers are .col-md-4 divs
        const propertyElements = document.querySelectorAll('.col-md-4');

        if (propertyElements.length === 0) {
          console.log('No .col-md-4 elements found');
          return listings;
        }

        propertyElements.forEach(el => {
          try {
            // Extract the link which should contain the URL
            const linkEl = el.querySelector('a');
            if (!linkEl || !linkEl.href) return;

            const url = linkEl.href;
            
            // Skip if it's the sidebar menu
            if (url.includes('/inmuebles/listado_de_inmuebles') || !url.includes('inmueble_detalles')) {
              return;
            }
            
            // Extract title - look for h2, h3, or other heading tags
            let title = '';
            const titleEl = el.querySelector('h2, h3, .title, strong, h4');
            if (titleEl) {
              title = titleEl.textContent.trim();
            }

            // If still no title, extract from link text
            if (!title) {
              title = linkEl.textContent.trim().substring(0, 100);
            }

            // Extract price - look for specific price element or regex
            let price = '';
            const allText = el.textContent;
            
            // Look for € symbol in element text
            const match = allText.match(/[\d.,]+\s*€/);
            if (match) {
              price = match[0];
            }

            // Extract location/city
            let location = '';
            const locationMatch = allText.match(/\b(Hendaye|Irun|Arcangues|Bagnères|Arantza)\b(?:\s*\d{5})?/i);
            if (locationMatch) {
              location = locationMatch[0];
            }

            if (url && title) {
              listings.push({
                title: title,
                price: price || 'Consultar',
                location: location || 'No especificado',
                url: url
              });
            }
          } catch (e) {
            // Silently catch errors and continue
          }
        });

        return listings;
      });

      console.log(`Found ${properties.length} properties on page ${currentPage}`);

      // Add ID and timestamp to each property
      const timestamp = getCurrentTimestamp();
      properties.forEach(prop => {
        const propertyData = {
          id: generateIdFromUrl(prop.url),
          title: prop.title,
          price: prop.price,
          location: prop.location,
          url: prop.url,
          scraped_at: timestamp
        };
        allProperties.push(propertyData);
      });

      // Log each property for inspection
      if (properties.length > 0) {
        console.log('Sample property:', JSON.stringify(properties[0], null, 2));
      }

      // Check for next page button
      console.log('Looking for next page button...');
      try {
        // Try to find and click next page
        const clicked = await page.evaluate(() => {
          // Look for links that might be "next page"
          const allLinks = Array.from(document.querySelectorAll('a'));
          
          // Find a next button - could be text ">" or "siguiente" or rel="next"
          const nextButton = allLinks.find(a => {
            const text = a.textContent.trim();
            const rel = a.getAttribute('rel') || '';
            const ariaLabel = a.getAttribute('aria-label') || '';
            const style = window.getComputedStyle(a);
            
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
            const isNext = text.includes('>') || rel.includes('next') || ariaLabel.toLowerCase().includes('next') || 
                          text.toLowerCase().includes('siguiente') || text.toLowerCase().includes('próxima');
            
            return isVisible && isNext;
          });

          if (nextButton && !nextButton.classList.contains('disabled')) {
            nextButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          hasNextPage = true;
          currentPage++;
          console.log('Navigated to next page');
          await page.waitForTimeout(2000);
        } else {
          console.log('No next page found');
          hasNextPage = false;
        }
      } catch (e) {
        console.log('Error checking for next page:', e.message);
        hasNextPage = false;
      }
    }

    console.log(`\n✓ Total properties scraped: ${allProperties.length}`);

    // Step 8: Output results as JSON
    const outputFile = 'properties_hendaye_piso.json';
    fs.writeFileSync(outputFile, JSON.stringify(allProperties, null, 2));
    console.log(`✓ Results saved to ${outputFile}`);

    // Print summary
    if (allProperties.length > 0) {
      console.log('\n=== FIRST 3 RESULTS ===');
      console.log(JSON.stringify(allProperties.slice(0, 3), null, 2));
    } else {
      console.log('\n⚠ No properties were found. Website structure may have changed.');
    }

    return allProperties;

  } catch (error) {
    console.error('Fatal error during scraping:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeProperties();
