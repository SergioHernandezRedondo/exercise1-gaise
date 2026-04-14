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

