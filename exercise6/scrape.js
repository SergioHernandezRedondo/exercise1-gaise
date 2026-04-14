// scrape.js - CLI for adapter-based scraping framework with Milestone 3 monitoring

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const ApartmentsDB = require('./database');
const { detectChanges, summarizeChanges } = require('./lib/changeDetection');

// Parse command-line arguments
const argv = minimist(process.argv.slice(2));

// Helper: Print usage information
function printUsage() {
  console.error(`Usage:
  node scrape.js --site <siteId> [--out <file>] [--persist] [--dry-run] [--filters.key value]
  node scrape.js --status
  node scrape.js --changes [--site <site>] [--limit 50]
  
Examples:
  node scrape.js --site iparralde
  node scrape.js --site iparralde --out listings.json
  node scrape.js --site iparralde --persist
  node scrape.js --site iparralde --persist --dry-run
  node scrape.js --status
  node scrape.js --changes --site iparralde --limit 20
  node scrape.js --site iparralde --filters.municipality Hendaye
  
Options:
  --site       Adapter to use (required, except with --status and --changes)
  --out        Output file (default: stdout as JSON)
  --persist    Store results and detect changes (M3: Milestone 3)
  --dry-run    Show what would change without writing to DB
  --status     Show database status
  --changes    Show recent change events (audit trail)
  --limit      Number of recent changes to show (default: 50)
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
} else if (argv.changes) {
  // Handle --changes flag (show audit trail)
  (async () => {
    try {
      const db = new ApartmentsDB();
      const siteId = argv.site || 'all';
      const limit = argv.limit ? parseInt(argv.limit, 10) : 50;

      if (siteId === 'all') {
        console.error('Error: --changes requires --site <siteId>');
        console.error('Usage: node scrape.js --changes --site iparralde [--limit 50]\n');
        process.exit(1);
      }

      const changes = await db.getRecentChanges(siteId, limit);

      console.log(`\n=== Recent Changes for "${siteId}" (last ${limit}) ===\n`);

      if (changes.length === 0) {
        console.log('No changes found.');
      } else {
        for (const change of changes) {
          const timestamp = new Date(change.created_at).toLocaleString();
          console.log(`[${timestamp}] ${change.change_type.toUpperCase()} - Listing: ${change.listing_id}`);
          
          if (change.diff_json && Array.isArray(change.diff_json)) {
            for (const diff of change.diff_json) {
              console.log(`  ${diff.field}: "${diff.old}" → "${diff.new}"`);
            }
          }
          console.log();
        }
      }

      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Error reading changes:', err.message);
      process.exit(1);
    }
  })();
} else {
  // Main scraping mode (NOT status or changes mode)
  
  // Validate required arguments
  if (!argv.site) {
    console.error('Error: --site is required (except with --status and --changes)\n');
    printUsage();
    process.exit(1);
  }

  const siteId = argv.site;
  const dryRun = argv['dry-run'] || false;

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
    let db = null;
    let runId = null;

    try {
      console.error(`Scraping ${siteId}...`);
      
      // Initialize database
      db = new ApartmentsDB();

      // Milestone 3: Start run tracking
      if (argv.persist) {
        runId = await db.startRun(siteId);
        console.error(`[Run #${runId}] Started`);
      }

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

      // Milestone 3: Change detection if using --persist
      if (argv.persist) {
        const currentState = await db.getCurrentListingsState(siteId);
        const { changes, updatedCurrent, snapshots } = detectChanges(listings, currentState, siteId);

        const summary = summarizeChanges(changes);
        console.error('\nChanges detected:');
        console.error(`  new: ${summary.new}`);
        console.error(`  attributes_changed: ${summary.attributes_changed}`);
        console.error(`  removed: ${summary.removed}`);

        if (dryRun) {
          console.error('\n=== DRY RUN (no DB writes) ===');
          console.error(`Would insert: ${snapshots.length} snapshots, ${changes.length} changes`);
          
          // Show sample of new listings
          const newChanges = changes.filter(c => c.change_type === 'new').slice(0, 3);
          if (newChanges.length > 0) {
            console.error('\nSample new listings:');
            for (const change of newChanges) {
              const listing = listings.find(l => l.id === change.listing_id);
              if (listing) {
                console.error(`  - ${change.listing_id}: ${listing.title}`);
              }
            }
          }
        } else {
          // Write changes to database
          await db.processListings(
            runId,
            listings,
            siteId,
            { changes, updatedCurrent, snapshots },
            snapshots,
            false
          );

          console.error(`Processed successfully`);
        }
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

      // Milestone 3: Finish run
      if (argv.persist && runId && !dryRun) {
        await db.finishRun(runId, 'ok', listings.length);
        console.error(`[Run #${runId}] Finished`);
      }

    } catch (err) {
      if (runId && argv.persist && db) {
        await db.finishRun(runId, 'failed', 0, err.message).catch(() => {});
      }
      console.error(`Error: ${err.message}`);
      process.exit(1);
    } finally {
      if (db) {
        await db.close();
      }
    }
  }

  main();
}
