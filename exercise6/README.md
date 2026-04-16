# Exercise 6: Adapter-Based Scraping Framework

**Status**: ✅ Milestone 0 + Milestone 2 Complete (Cloud-based SQLite with Turso)

## Overview
This is an adapter-based scraping framework with cloud-based SQLite persistence using **Turso**. It allows scraping multiple real estate sites and storing results in a persistent cloud database.

## Prerequisites

1. **Create a free Turso account** at https://turso.tech
2. **Create a database** (get your DB URL)
3. **Generate an API token** (save it securely)
4. **Set environment variables** in `.env` file

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Turso Credentials

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
TURSO_DB_URL=libsql://your-db-name-xxxx.turso.io
TURSO_DB_TOKEN=eyJhbGc...your-long-token...
```

**Where to find these values:**
- **DB URL**: In Turso Dashboard → Your database → Connection details → `libsql://...`
- **Token**: Turso Dashboard → Your database → Tokens → Create new → Copy the token

### 3. Verify Setup

```bash
node scrape.js --status
```

Should show:
```
=== Database Status ===

Total listings: 0
Database: Turso (libsql)

No listings found in database.
```

## Architecture

### Core Components
- **`scrape.js`** - Main CLI entry point (site-agnostic)
- **`database.js`** - Turso/libsql management with upsert logic
- **`adapters/`** - Pluggable site-specific scrapers
- **`.env`** - Turso credentials (DO NOT commit to git)

### Adapter Interface
Each adapter exports:
```javascript
{
  siteId: 'site_name',
  list: async (params) => Promise<Listing[]>
}
```

### Listing Object
```javascript
{
  id: string,           // Stable unique identifier
  title: string,        // Property title
  price: string,        // Price as displayed
  location: string,     // Location info
  detailUrl: string     // URL to property details
}
```

## Usage

### Output JSON to stdout
```bash
node scrape.js --site iparralde
```

### Save to file
```bash
node scrape.js --site iparralde --out listings.json
```

### Scrape and persist to Turso
```bash
node scrape.js --site iparralde --persist
```

Output:
```
Scraping iparralde...
Found 37 listings
Persisted 37 listings to Turso
```

### Check database status
```bash
node scrape.js --status
```

Output:
```
=== Database Status ===

Total listings: 37
Database: Turso (libsql)

By site:
  iparralde: 37 listings
    First scraped: 2026-04-14T16:57:50.670Z
    Last scraped: 2026-04-14T16:58:19.266Z
```

### Both persist and export
```bash
node scrape.js --site iparralde --persist --out listings.json
```

### With custom filters (future)
```bash
node scrape.js --site iparralde \
  --filters.propertyType Piso \
  --filters.municipality Hendaye
```

## Database Schema

```sql
CREATE TABLE apartments (
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

CREATE INDEX idx_apartments_siteId ON apartments(siteId);
CREATE INDEX idx_apartments_scrapedAt ON apartments(scrapedAt);
```

## Acceptance Criteria

### Milestone 0 ✅
- [x] CLI outputs valid JSON
- [x] Each listing has a non-empty `id`
- [x] `id` is stable across repeated runs
- [x] Adapter interface is documented and extensible
- [x] iparralde adapter implemented using Playwright
- [x] Framework is site-agnostic (core doesn't know about specific adapters)

### Milestone 2 ✅ (Cloud SQLite with Turso)
- [x] Cloud-based SQLite database using Turso
- [x] Upsert by id (no duplicates after multiple runs)
- [x] Correct schema with all required fields
- [x] `--persist` flag stores listings in Turso
- [x] `--status` flag shows Turso database summary
- [x] Database can be accessed via Turso dashboard

## Testing

```bash
# Test 1: Empty database
node scrape.js --status

# Test 2: First scrape with persistence
node scrape.js --site iparralde --persist

# Test 3: Check database
node scrape.js --status

# Test 4: Second scrape (should not create duplicates)
node scrape.js --site iparralde --persist
node scrape.js --status  # Count should remain the same

# Test 5: Export to JSON
node scrape.js --site iparralde --out listings.json

# Test 6: View in Turso Dashboard
# Go to https://turso.tech and view your database in the web console
```

## Adding a New Adapter

To add support for a new website:

1. Create `adapters/mysite.js`:
```javascript
const { chromium } = require('playwright');

module.exports = {
  siteId: 'mysite',
  
  list: async (params) => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      await page.goto('https://mysite.com');
      // Scraping logic here
      const listings = []; // Your scraped data
      return listings;
    } finally {
      await browser.close();
    }
  }
};
```

2. Test:
```bash
node scrape.js --site mysite
node scrape.js --site mysite --persist
```

## File Structure
```
exercise6/
├── scrape.js                      # Main CLI
├── database.js                    # Turso management
├── ADAPTER_INTERFACE.md           # Adapter documentation
├── README.md                      # This file
├── .env.example                   # Environment variables template
├── .gitignore                     # Excludes .env
├── package.json                   # Dependencies
└── adapters/
    └── iparralde.js               # Iparralde scraper
```

## Dependencies
- `@libsql/client` - Cloud SQLite via Turso
- `dotenv` - Environment variable management
- `playwright` - Browser automation
- `minimist` - CLI argument parsing

## Troubleshooting

### Missing .env file
```
Error: Missing Turso credentials. Please set TURSO_DB_URL and TURSO_DB_TOKEN in .env file
```
**Solution**: Copy `.env.example` to `.env` and add your Turso credentials.

### Invalid credentials
```
Error: Unauthorized. Token may be invalid or expired.
```
**Solution**: 
1. Verify your DB URL and token in Turso Dashboard
2. Create a new token if the old one is compromised
3. Make sure there are no extra spaces in `.env`

### Connection timeout
```
Error: Failed to connect to database
```
**Solution**: Check your internet connection and verify the DB URL is correct.

## Next Steps
- Add more adapters for other real estate websites
- Implement advanced filtering parameters
- Build API endpoints for database querying
- Add data validation and error recovery

## Project Summary

### Who I am and what I did
I am GitHub Copilot helping implement this project. I built a complete real estate scraping and dashboard pipeline for Exercise 6, including:
- adapter-based scraping architecture
- cloud persistence using Turso
- change tracking and audit logs
- optional Telegram notification support
- a web dashboard for listings, changes, and market statistics

### Milestones completed
- **Milestone 0**: Core scraper CLI and adapter interface
- **Milestone 2**: Turso-backed persistence, upsert logic, and `--status` reporting
- **Milestone 3**: Change detection, current-state tracking, and audit records
- **Milestone 4**: Telegram notification support (optional milestone implemented in code)
- **Milestone 5**: Scheduler support for repeated scraping
- **Milestone 6**: Express dashboard with listings, change log, and stats views

### Adapters implemented
- `adapters/iparralde.js` — scraper for the Iparralde real estate website

The framework is designed to add new adapters by creating a new file in `adapters/` with the same interface.

### Deployment and access
- **Current deployment**: Ubuntu VM on Azure
- **Dashboard access**: `http://localhost:3000` on the VM
- **Domain/IP**: No public domain configured yet; use the VM localhost or public IP if exposed

### Problems encountered
- The dashboard exited immediately on the VM because Node.js had an empty event loop in the server environment. I fixed this by adding a small keep-alive timer.
- The dashboard was also failing when the home route rendered `index`, because `views/index.ejs` was missing; I added that template.
- API queries originally assumed `siteId` existed on the wrong change table, which caused SQL errors. I fixed the query joins.
- Deployment required making sure the branch was pushed and the VM pulled the latest changes.

### Comments
- The dashboard is read-only and does not trigger scrapes or modify DB data.
- Populate the database first with:
  ```bash
  node scrape.js --site iparralde --persist
  ```
- Then run the dashboard:
  ```bash
  node dashboard.js
  ```
- If you want Telegram alerts, set `ENABLE_NOTIFICATIONS=true`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in `.env`.

### Screenshots
#### Dashboard screenshot
![Dashboard screenshot](../results-page.png)

#### Telegram bot alerts
No Telegram screenshot is available yet. The notification module is implemented, but the bot has not been captured in a screenshot.


