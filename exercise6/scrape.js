// scrape.js
const fs = require('fs');
const path = require('path');

// Simple parser de argumentos estilo --site iparralde --out listings.json
const argv = require('minimist')(process.argv.slice(2));

if (!argv.site || !argv.out) {
  console.error('Usage: node scrape.js --site <siteId> --out <file>');
  process.exit(1);
}

// Cargar el adapter correspondiente
const adaptersDir = path.join(__dirname, 'adapters');
let adapter;
try {
  adapter = require(path.join(adaptersDir, argv.site));
} catch (err) {
  console.error(`Adapter for site "${argv.site}" not found.`);
  process.exit(1);
}

// Ejecutar el scraping
async function main() {
  try {
    const listings = await adapter.list({});
    // Guardar JSON
    fs.writeFileSync(argv.out, JSON.stringify(listings, null, 2));
    console.log(`Scraped ${listings.length} listings from ${argv.site}.`);
    console.log(`Results saved to ${argv.out}`);
  } catch (err) {
    console.error('Error during scraping:', err);
  }
}

main();
