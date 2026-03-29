const { chromium } = require('playwright');

async function debugResultsPage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Opening website...');
    await page.goto('https://inmobiliariaiparralde.com/', { waitUntil: 'networkidle' });

    // Select filters
    await page.selectOption('select[name="tipoInmueble[]"]', { label: 'Piso' });
    await page.waitForTimeout(500);
    
    await page.selectOption('select[name="municipio[]"]', { label: 'Hendaye' });
    await page.waitForTimeout(500);
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Now inspect the page structure
    console.log('\n=== PAGE INSPECTION ===');
    
    const pageInfo = await page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        htmlSnippet: document.body.innerHTML.substring(0, 2000),
        allClasses: new Set(),
        elementCounts: {}
      };

      // Collect all unique classes
      document.querySelectorAll('[class]').forEach(el => {
        const className = el.getAttribute('class') || '';
        className.split(/\s+/).forEach(cls => {
          if (cls) info.allClasses.add(cls);
        });
      });

      info.allClasses = Array.from(info.allClasses).sort().slice(0, 50);

      // Count specific element types
      info.elementCounts = {
        articles: document.querySelectorAll('article').length,
        divs: document.querySelectorAll('div').length,
        links: document.querySelectorAll('a').length,
        items: document.querySelectorAll('[class*="item"]').length,
        results: document.querySelectorAll('[class*="result"]').length,
        products: document.querySelectorAll('[class*="product"]').length,
        properties: document.querySelectorAll('[class*="property"]').length,
        listings: document.querySelectorAll('[class*="listing"]').length,
        'contenido-principal': document.querySelectorAll('.contenido-principal').length,
        'resultado-item': document.querySelectorAll('.resultado-item').length
      };

      return info;
    });

    console.log('URL:', pageInfo.url);
    console.log('Title:', pageInfo.title);
    console.log('\nElement Counts:', pageInfo.elementCounts);
    console.log('\nFirst 30 Classes found:');
    console.log(pageInfo.allClasses.slice(0, 30).join(', '));

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'results-page.png' });
    console.log('\nScreenshot saved as results-page.png');

    // Try to find property results with different approaches
    console.log('\n=== SEARCHING FOR PROPERTIES ===');
    
    const results = await page.evaluate(() => {
      const findings = {};

      // Try various selectors
      const selectors = [
        'article',
        '.resultado-item',
        '.contenido-principal > div',
        '.inmueble',
        '[class*="card"]',
        '.col-md-4',
        '.col-lg-4'
      ];

      selectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          findings[sel] = {
            count: elements.length,
            sample: Array.from(elements).slice(0, 1).map(el => ({
              classes: el.className,
              tag: el.tagName,
              textPreview: el.textContent.substring(0, 100),
              html: el.innerHTML.substring(0, 200)
            }))
          };
        }
      });

      return findings;
    });

    console.log(JSON.stringify(results, null, 2));

    await page.pause();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugResultsPage();
