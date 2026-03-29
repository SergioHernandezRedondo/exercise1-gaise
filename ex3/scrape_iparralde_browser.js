const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

function runAgentBrowser(command) {
  return execSync(`agent-browser ${command}`, { encoding: 'utf-8' }).trim();
}

(async () => {
  const allListings = [];
  const timestamp = new Date().toISOString();

  try {
    console.log('🚀 Starting agent-browser scraping...\n');

    // --- 1) Navegar y aplicar filtros ---
    runAgentBrowser('open https://inmobiliariaiparralde.com/');
    runAgentBrowser('select "select[name=\'tipoInmueble[]\']" "Piso"');
    runAgentBrowser('select "select[name=\'municipio[]\']" "Hendaye"');
    runAgentBrowser('eval "document.querySelector(\'form\').requestSubmit()"');
    runAgentBrowser('wait 2000'); // wait for load

    let pageNum = 1;
    let hasNextPage = true;

    while (hasNextPage && pageNum <= 3) { // limit to 3 pages
      console.log(`\nScraping page ${pageNum}...`);

      // --- 2) Extraer datos ---
      const titles = JSON.parse(runAgentBrowser('eval "Array.from(document.querySelectorAll(\'h3\')).slice(0,10).map(h => h.textContent.trim())"'));
      const prices = JSON.parse(runAgentBrowser('eval "Array.from(document.querySelectorAll(\'p\')).filter(p => p.textContent.includes(\'€\') || p.textContent.includes(\'consultar\')).map(p => p.textContent.trim())"'));
      const locations = JSON.parse(runAgentBrowser('eval "Array.from(document.querySelectorAll(\'p\')).filter(p => p.textContent.includes(\'Hendaye\') || p.textContent.includes(\'Hendaia\')).slice(0,10).map(p => p.textContent.trim())"'));
      const urls = JSON.parse(runAgentBrowser('eval "Array.from(document.querySelectorAll(\'a\')).filter(a => a.textContent.includes(\'Ver Detalles\')).map(a => a.href)"'));

      const numListings = Math.min(titles.length, prices.length, locations.length, urls.length);

      for (let i = 0; i < numListings; i++) {
        const stableId = urls[i] ? urls[i].split('/').pop() : null;
        allListings.push({
          title: titles[i],
          price: prices[i],
          location: locations[i],
          detailUrl: urls[i],
          scrapingTimestamp: timestamp,
          stableId: stableId
        });
      }

      console.log(`Found ${numListings} listings on page ${pageNum}`);

      // --- 3) Paginación ---
      const nextExists = runAgentBrowser('eval "!!document.querySelector(\'a\') && Array.from(document.querySelectorAll(\'a\')).some(a => a.textContent.includes(\'Siguiente\') || a.textContent.includes(\'>\'))"');
      if (nextExists === 'true') {
        runAgentBrowser('find text "Siguiente" click');
        runAgentBrowser('wait 2000');
        pageNum++;
      } else {
        hasNextPage = false;
      }
    }

    console.log(`\nTotal listings scraped: ${allListings.length}`);

    // --- 4) Guardar resultados ---
    fs.writeFileSync(
      'iparralde_agent_browser.json',
      JSON.stringify(allListings, null, 2)
    );

    console.log('Results saved to iparralde_agent_browser.json');

    // Output final
    console.log('\nOUTPUT:\n');
    console.log(JSON.stringify(allListings, null, 2));

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
})();