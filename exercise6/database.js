const { createClient } = require('@libsql/client');
require('dotenv').config();

class ApartmentsDB {
  constructor() {
    const url = process.env.TURSO_DB_URL;
    const token = process.env.TURSO_DB_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing Turso credentials. Please set TURSO_DB_URL and TURSO_DB_TOKEN in .env file\n' +
        'See .env.example for instructions.'
      );
    }

    this.client = createClient({ url, authToken: token });
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Create tables if they don't exist
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS apartments (
        id TEXT PRIMARY KEY,
        siteId TEXT NOT NULL,
        title TEXT,
        price TEXT,
        location TEXT,
        url TEXT,
        scrapedAt TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_apartments_siteId ON apartments(siteId);
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_apartments_scrapedAt ON apartments(scrapedAt);
    `);

    // Milestone 3: Monitoring tables
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS scrape_runs (
        run_id INTEGER PRIMARY KEY AUTOINCREMENT,
        siteId TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        listings_found INTEGER,
        status TEXT DEFAULT 'in-progress',
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_scrape_runs_siteId ON scrape_runs(siteId);
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_scrape_runs_finished_at ON scrape_runs(finished_at);
    `);

    // listings_current: latest state per listing
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS listings_current (
        id TEXT PRIMARY KEY,
        siteId TEXT NOT NULL,
        title TEXT,
        price TEXT,
        price_num INTEGER,
        location TEXT,
        url TEXT,
        active INTEGER DEFAULT 1,
        miss_count INTEGER DEFAULT 0,
        first_seen TEXT,
        last_seen TEXT,
        last_modified TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_listings_current_siteId ON listings_current(siteId);
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_listings_current_active ON listings_current(active);
    `);

    // listings_snapshot: immutable per run
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS listings_snapshot (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        id TEXT NOT NULL,
        siteId TEXT NOT NULL,
        title TEXT,
        price TEXT,
        price_num INTEGER,
        location TEXT,
        url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (run_id) REFERENCES scrape_runs(run_id)
      );
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_listings_snapshot_run_id ON listings_snapshot(run_id);
    `);

    // listing_changes: audit trail
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS listing_changes (
        change_id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        listing_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        diff_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (run_id) REFERENCES scrape_runs(run_id)
      );
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_listing_changes_run_id ON listing_changes(run_id);
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS idx_listing_changes_listing_id ON listing_changes(listing_id);
    `);

    this.initialized = true;
  }

  /**
   * Upsert listings into the database.
   * Updates existing records by id, inserts new ones.
   */
  async upsertListings(listings, siteId) {
    await this.init();

    const scrapedAt = new Date().toISOString();
    let insertedCount = 0;

    for (const listing of listings) {
      try {
        await this.client.execute({
          sql: `
            INSERT INTO apartments (id, siteId, title, price, location, url, scrapedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              price = excluded.price,
              location = excluded.location,
              url = excluded.url,
              scrapedAt = excluded.scrapedAt,
              updatedAt = datetime('now')
          `,
          args: [
            listing.id,
            siteId,
            listing.title,
            listing.price,
            listing.location,
            listing.detailUrl || listing.url,
            scrapedAt
          ]
        });
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting listing ${listing.id}:`, err.message);
      }
    }

    return insertedCount;
  }

  /**
   * Get database status
   */
  async getStatus() {
    await this.init();

    try {
      const totalResult = await this.client.execute('SELECT COUNT(*) as count FROM apartments');
      const totalCount = totalResult.rows[0]?.count || 0;

      const bySiteResult = await this.client.execute(`
        SELECT siteId, COUNT(*) as count, MIN(scrapedAt) as firstScraped, MAX(scrapedAt) as lastScraped
        FROM apartments
        GROUP BY siteId
        ORDER BY siteId
      `);

      const bySite = (bySiteResult.rows || []).map(row => ({
        site: row.siteId,
        listings: row.count,
        firstScraped: row.firstScraped,
        lastScraped: row.lastScraped
      }));

      return {
        totalListings: totalCount,
        database: 'Turso (libsql)',
        bySite
      };
    } catch (err) {
      throw new Error(`Failed to get database status: ${err.message}`);
    }
  }

  /**
   * Get all listings (optionally filtered by site)
   */
  async getListings(siteId = null) {
    await this.init();

    try {
      let sql = 'SELECT * FROM apartments';
      let args = [];

      if (siteId) {
        sql += ' WHERE siteId = ?';
        args = [siteId];
      }

      sql += ' ORDER BY scrapedAt DESC';

      const result = await this.client.execute({ sql, args });
      return result.rows || [];
    } catch (err) {
      throw new Error(`Failed to get listings: ${err.message}`);
    }
  }

  /**
   * Milestone 3: Start a new scrape run
   * Returns run_id for tracking
   */
  async startRun(siteId) {
    await this.init();

    const now = new Date().toISOString();

    try {
      const result = await this.client.execute({
        sql: `
          INSERT INTO scrape_runs (siteId, started_at, status)
          VALUES (?, ?, 'in-progress')
          RETURNING run_id
        `,
        args: [siteId, now]
      });

      const runId = result.rows[0]?.run_id;
      if (!runId) {
        throw new Error('Failed to get run_id from insert');
      }

      return runId;
    } catch (err) {
      throw new Error(`Failed to start run: ${err.message}`);
    }
  }

  /**
   * Milestone 3: Finish a scrape run
   */
  async finishRun(runId, status, listingsFound, errorMessage = null) {
    await this.init();

    const now = new Date().toISOString();

    try {
      await this.client.execute({
        sql: `
          UPDATE scrape_runs
          SET finished_at = ?, status = ?, listings_found = ?, error_message = ?
          WHERE run_id = ?
        `,
        args: [now, status, listingsFound, errorMessage, runId]
      });
    } catch (err) {
      throw new Error(`Failed to finish run: ${err.message}`);
    }
  }

  /**
   * Milestone 3: Get current listings state as a map
   */
  async getCurrentListingsState(siteId) {
    await this.init();

    try {
      const result = await this.client.execute({
        sql: 'SELECT * FROM listings_current WHERE siteId = ?',
        args: [siteId]
      });

      const state = {};
      for (const row of result.rows || []) {
        state[row.id] = {
          title: row.title,
          price: row.price,
          price_num: row.price_num,
          location: row.location,
          url: row.url,
          active: row.active,
          miss_count: row.miss_count,
          first_seen: row.first_seen,
          last_seen: row.last_seen,
          last_modified: row.last_modified
        };
      }

      return state;
    } catch (err) {
      throw new Error(`Failed to get current listings state: ${err.message}`);
    }
  }

  /**
   * Milestone 3: Process listings from a scrape run
   * Detects changes and optionally writes to DB
   */
  async processListings(runId, listings, siteId, changes, snapshots, dryRun = false) {
    await this.init();

    if (dryRun) {
      // Don't write anything
      return {
        changesInserted: 0,
        snapshotsInserted: 0,
        currentUpdated: 0
      };
    }

    try {
      let changesInserted = 0;
      let snapshotsInserted = 0;

      // Insert snapshots
      for (const snapshot of snapshots) {
        try {
          await this.client.execute({
            sql: `
              INSERT INTO listings_snapshot (run_id, id, siteId, title, price, price_num, location, url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              runId,
              snapshot.id,
              snapshot.siteId,
              snapshot.title,
              snapshot.price,
              snapshot.price_num,
              snapshot.location,
              snapshot.url
            ]
          });
          snapshotsInserted++;
        } catch (err) {
          console.error(`Error inserting snapshot for ${snapshot.id}:`, err.message);
        }
      }

      // UPSERT listings_current (insert or replace on conflict)
      for (const listingId in changes.updatedCurrent) {
        const current = changes.updatedCurrent[listingId];

        try {
          await this.client.execute({
            sql: `
              INSERT INTO listings_current (id, siteId, title, price, price_num, location, url, active, miss_count, first_seen, last_seen, last_modified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                price = excluded.price,
                price_num = excluded.price_num,
                location = excluded.location,
                url = excluded.url,
                active = excluded.active,
                miss_count = excluded.miss_count,
                last_seen = excluded.last_seen,
                last_modified = excluded.last_modified,
                updated_at = datetime('now')
            `,
            args: [
              listingId,
              siteId,
              current.title,
              current.price,
              current.price_num,
              current.location,
              current.url,
              current.active,
              current.miss_count,
              current.first_seen,
              current.last_seen,
              current.last_modified
            ]
          });
        } catch (err) {
          console.error(`Error upserting listing ${listingId}:`, err.message);
        }
      }

      // Insert change events
      for (const change of changes.changes) {
        try {
          await this.client.execute({
            sql: `
              INSERT INTO listing_changes (run_id, listing_id, change_type, diff_json)
              VALUES (?, ?, ?, ?)
            `,
            args: [
              runId,
              change.listing_id,
              change.change_type,
              change.diff_json
            ]
          });
          changesInserted++;
        } catch (err) {
          console.error(`Error inserting change for ${change.listing_id}:`, err.message);
        }
      }

      return {
        changesInserted,
        snapshotsInserted,
        currentUpdated: Object.keys(changes.updatedCurrent).length
      };
    } catch (err) {
      throw new Error(`Failed to process listings: ${err.message}`);
    }
  }

  /**
   * Milestone 3: Get recent changes (audit trail)
   */
  async getRecentChanges(siteId, limit = 50) {
    await this.init();

    try {
      const result = await this.client.execute({
        sql: `
          SELECT lc.change_id, lc.run_id, lc.listing_id, lc.change_type, lc.diff_json, lc.created_at,
                 sr.started_at, sr.finished_at
          FROM listing_changes lc
          JOIN scrape_runs sr ON lc.run_id = sr.run_id
          WHERE sr.siteId = ?
          ORDER BY lc.created_at DESC
          LIMIT ?
        `,
        args: [siteId, limit]
      });

      return (result.rows || []).map(row => ({
        change_id: row.change_id,
        run_id: row.run_id,
        listing_id: row.listing_id,
        change_type: row.change_type,
        diff_json: row.diff_json ? JSON.parse(row.diff_json) : null,
        created_at: row.created_at,
        run_started_at: row.started_at,
        run_finished_at: row.finished_at
      }));
    } catch (err) {
      throw new Error(`Failed to get recent changes: ${err.message}`);
    }
  }

  /**
   * Close database connection
   */
  async close() {
    // Turso client doesn't require explicit close, but included for compatibility
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
    }
  }
}

module.exports = ApartmentsDB;

