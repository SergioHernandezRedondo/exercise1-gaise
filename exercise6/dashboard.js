#!/usr/bin/env node

/**
 * dashboard.js - Web UI for browsing listings, changes, and market trends
 * 
 * Usage:
 *   node dashboard.js [--port 3000]
 *   node scrape.js --dashboard --port 3000
 */

const express = require('express');
const path = require('path');
const ApartmentsDB = require('./database');
const minimist = require('minimist');

// Parse arguments
const argv = minimist(process.argv.slice(2));
const PORT = argv.port || process.env.DASHBOARD_PORT || 3000;

const app = express();
let db = null;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/**
 * Routes
 */

// Home page
app.get('/', async (req, res) => {
  try {
    res.render('index', { 
      title: 'Real Estate Dashboard',
      navActive: 'listings'
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Listings view
app.get('/listings', async (req, res) => {
  try {
    res.render('listings', { 
      title: 'Current Listings',
      navActive: 'listings'
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Changes view
app.get('/changes', async (req, res) => {
  try {
    res.render('changes', { 
      title: 'Change Log',
      navActive: 'changes'
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Stats view
app.get('/stats', async (req, res) => {
  try {
    res.render('stats', { 
      title: 'Market Statistics',
      navActive: 'stats'
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

/**
 * API Endpoints
 */

// Get all active listings
app.get('/api/listings', async (req, res) => {
  try {
    const siteId = req.query.site || 'iparralde';
    const sort = req.query.sort || 'price_asc';
    
    const result = await db.client.execute({
      sql: 'SELECT * FROM listings_current WHERE siteId = ? ORDER BY price_num ASC LIMIT 1000',
      args: [siteId]
    });

    const listings = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      price: r.price,
      price_num: r.price_num,
      location: r.location,
      detailUrl: r.url || '#',
      lastSeen: r.last_seen,
      firstSeen: r.first_seen,
      missCount: r.miss_count || 0
    }));

    res.json({ success: true, data: listings, count: listings.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get recent changes
app.get('/api/changes', async (req, res) => {
  try {
    const siteId = req.query.site || 'iparralde';
    const limit = parseInt(req.query.limit, 10) || 100;

    const result = await db.client.execute({
      sql: `SELECT lc.*, l.title, l.price 
       FROM listing_changes lc
       LEFT JOIN listings_current l ON lc.listing_id = l.id
       WHERE lc.siteId = ?
       ORDER BY lc.created_at DESC
       LIMIT ?`,
      args: [siteId, limit]
    });

    const changes = result.rows.map(r => ({
      id: r.id,
      listing_id: r.listing_id,
      title: r.title || `Listing ${r.listing_id}`,
      change_type: r.change_type,
      diff_json: r.diff_json ? (typeof r.diff_json === 'string' ? JSON.parse(r.diff_json) : r.diff_json) : [],
      created_at: r.created_at,
      timestamp: new Date(r.created_at).toLocaleString()
    }));

    res.json({ success: true, data: changes, count: changes.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const siteId = req.query.site || 'iparralde';

    // Total active listings
    const totalResult = await db.client.execute({
      sql: 'SELECT COUNT(*) as count FROM listings_current WHERE siteId = ?',
      args: [siteId]
    });
    const totalListings = totalResult.rows[0]?.count || 0;

    // Recent changes (last 24 hours)
    const changesResult = await db.client.execute({
      sql: `SELECT change_type, COUNT(*) as count 
       FROM listing_changes 
       WHERE siteId = ? AND created_at > datetime('now', '-24 hours')
       GROUP BY change_type`,
      args: [siteId]
    });
    
    const changes24h = {};
    changesResult.rows.forEach(r => {
      changes24h[r.change_type] = r.count;
    });

    // Average price
    const priceResult = await db.client.execute({
      sql: 'SELECT AVG(price_num) as avg_price, MIN(price_num) as min_price, MAX(price_num) as max_price FROM listings_current WHERE siteId = ?',
      args: [siteId]
    });
    
    const avgPrice = Math.round(priceResult.rows[0]?.avg_price || 0);
    const minPrice = priceResult.rows[0]?.min_price || 0;
    const maxPrice = priceResult.rows[0]?.max_price || 0;

    // Price distribution (histogram buckets)
    const bucketSize = 50000;
    const histResult = await db.client.execute({
      sql: `SELECT 
        CAST(CAST(price_num / ? AS INTEGER) * ? AS INTEGER) as bucket, 
        COUNT(*) as count 
       FROM listings_current 
       WHERE siteId = ? 
       GROUP BY bucket
       ORDER BY bucket`,
      args: [bucketSize, bucketSize, siteId]
    });

    const priceHistogram = [];
    histResult.rows.forEach(r => {
      priceHistogram.push({
        bucket: `€${r.bucket / 1000}k`,
        count: r.count
      });
    });

    res.json({
      success: true,
      data: {
        totalListings,
        changes24h: {
          new: changes24h.new || 0,
          attributes_changed: changes24h.attributes_changed || 0,
          removed: changes24h.removed || 0
        },
        prices: {
          average: avgPrice,
          min: minPrice,
          max: maxPrice
        },
        priceHistogram
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get sites list
app.get('/api/sites', async (req, res) => {
  try {
    const result = await db.client.execute({
      sql: 'SELECT DISTINCT siteId FROM listings_current'
    });
    const sites = result.rows.map(r => r.siteId);
    res.json({ success: true, data: sites || ['iparralde'] });
  } catch (err) {
    res.json({ success: true, data: ['iparralde'] });
  }
});

// Get database status
app.get('/api/status', async (req, res) => {
  try {
    const status = await db.getStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.json({ success: true, data: { message: 'Database not yet initialized' } });
  }
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message 
  });
});

/**
 * Start server
 */
async function start() {
  try {
    db = new ApartmentsDB();
    
    app.listen(PORT, () => {
      console.log(`\n🌐 Dashboard running at http://localhost:${PORT}`);
      console.log(`\n📊 Views:`);
      console.log(`   http://localhost:${PORT}/         - Listings`);
      console.log(`   http://localhost:${PORT}/changes  - Change Log`);
      console.log(`   http://localhost:${PORT}/stats    - Statistics`);
      console.log(`\n🛑 Press Ctrl+C to stop\n`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down dashboard...');
      await db.close();
      console.log('✅ Database closed');
      process.exit(0);
    });

  } catch (err) {
    console.error('❌ Failed to start dashboard:', err.message);
    process.exit(1);
  }
}

// Handle being imported or run directly
if (require.main === module) {
  start();
}

module.exports = { app, start };
