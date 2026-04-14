// scrape.js - CLI for adapter-based scraping framework

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const ApartmentsDB = require('./database');

// Parse command-line arguments
const argv = minimist(process.argv.slice(2));

// Helper: Print usage information
function printUsage() {
  console.error(`Usage:
  node scrape.js --site <siteId> [--out <file>] [--persist] [--filters.key value]
  node scrape.js --status
  
Examples:
  node scrape.js --site iparralde
  node scrape.js --site iparralde --out listings.json
  node scrape.js --site iparralde --persist
  node scrape.js --status
  node scrape.js --site iparralde --filters.municipality Hendaye
  
Options:
  --site       Adapter to use (required, except with --status)
  --out        Output file (default: stdout as JSON)
  --persist    Store results in SQLite database
  --status     Show database status
  --filters.*  Custom filter parameters (e.g., --filters.municipality Hendaye)
  `);
}

// Handle --status flag
if (argv.status) {
  (async () => {
    try {
      const db = new ApartmentsDB();
      const status = await db.getStatus();
      console.log('\n=== Database Status ===\n');
      console.log(`Total listings: ${status.totalListings}`);
      console.log(`Database: ${status.database}`);
      
      if (status.bySite.length > 0) {
        console.log('\nBy site:');
        for (const site of status.bySite) {
          console.log(`  ${site.site}: ${site.listings} listings`);
          console.log(`    First scraped: ${site.firstScraped}`);
          console.log(`    Last scraped: ${site.lastScraped}`);
        }
      } else {
        console.log('\nNo listings found in database.');
      }
      console.log();
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Error reading database:', err.message);
      process.exit(1);
    }
  })();
} else {
  // Main scraping mode (NOT status mode)
  
  // Validate required arguments
  if (!argv.site) {
    console.error('Error: --site is required (except with --status)\n');
    printUsage();
    process.exit(1);
  }

  const siteId = argv.site;

  // Load adapter
  const adaptersDir = path.join(__dirname, 'adapters');
  const adapterPath = path.join(adaptersDir, `${siteId}.js`);

  let adapter;
  try {
    adapter = require(adapterPath);
  } catch (err) {
    console.error(`Error: Adapter "${siteId}" not found at ${adapterPath}`);
    console.error(`Make sure you have adapters/${siteId}.js installed.\n`);
    printUsage();
    process.exit(1);
  }

  // Validate adapter interface
  if (!adapter.siteId || !adapter.list) {
    console.error(`Error: Adapter "${siteId}" does not implement required interface.`);
    console.error('Adapter must export: { siteId: string, list: async (params) => Promise<Listing[]> }');
    process.exit(1);
  }

  // Main execution
  async function main() {
    try {
      console.error(`Scraping ${siteId}...`);
      
      // Call adapter with parameters
      const params = {};
      if (argv.filters) {
        params.filters = argv.filters;
      }
      if (argv['max-pages']) {
        params.maxPages = argv['max-pages'];
      }

      const listings = await adapter.list(params);
      
      // Validate output
      if (!Array.isArray(listings)) {
        throw new Error('Adapter must return an array of listings');
      }

      if (listings.length === 0) {
        console.error(`Warning: No listings found`);
      } else {
        console.error(`Found ${listings.length} listings`);
      }

      // Validate each listing
      for (const listing of listings) {
        if (!listing.id) {
          throw new Error('Each listing must have a non-empty "id" field');
        }
      }

      // If --persist, save to database
      if (argv.persist) {
        const db = new ApartmentsDB();
        const count = await db.upsertListings(listings, adapter.siteId);
        console.error(`Persisted ${count} listings to Turso`);
        await db.close();
      }

      // If --out, save to file
      if (argv.out) {
        const output = JSON.stringify(listings, null, 2);
        fs.writeFileSync(argv.out, output);
        console.error(`Wrote ${listings.length} listings to ${argv.out}`);
      }

      // If no --persist and no --out, print to stdout
      if (!argv.persist && !argv.out) {
        const output = JSON.stringify(listings, null, 2);
        console.log(output);
      }

    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }

  main();
}
