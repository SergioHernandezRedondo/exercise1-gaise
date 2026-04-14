# Quick Start: Turso-Powered Scraper

## TL;DR Setup (5 minutes)

### 1. Create Turso Account & Database
```bash
# Go to https://turso.tech
# Sign up → Create database → Get credentials
```

### 2. Configure .env
```bash
cp .env.example .env
# Edit .env and paste your Turso credentials:
# TURSO_DB_URL=libsql://your-db-name-xxxx.turso.io
# TURSO_DB_TOKEN=eyJhbGc...
```

### 3. Verify Setup
```bash
node scrape.js --status
# Should show: "Database: Turso (libsql)"
```

### 4. Start Scraping
```bash
# Run first time
node scrape.js --site iparralde --persist
# Output: Persisted 37 listings to Turso

# Check status
node scrape.js --status
# Shows: iparralde: 37 listings

# Run again (tests upsert)
node scrape.js --site iparralde --persist
# Still 37 listings - NO DUPLICATES!
```

## Commands Reference

```bash
# JSON to stdout
node scrape.js --site iparralde

# Save to local file
node scrape.js --site iparralde --out listings.json

# Persist to Turso
node scrape.js --site iparralde --persist

# Check database (Turso stats)
node scrape.js --status

# Both persist + export
node scrape.js --site iparralde --persist --out listings.json
```

## Status Output

```
=== Database Status ===

Total listings: 37
Database: Turso (libsql)

By site:
  iparralde: 37 listings
    First scraped: 2026-04-14T16:57:50.670Z
    Last scraped: 2026-04-14T16:58:19.267Z
```

## Project Structure

```
exercise6/
├── scrape.js              ← Main CLI command
├── database.js            ← Turso connection
├── adapters/
│   └── iparralde.js       ← Scraper for iparralde.com
├── .env                   ← Your Turso credentials (DO NOT COMMIT!)
├── .env.example           ← Template for .env
├── .gitignore             ← Excludes .env from git
├── README.md              ← Full documentation
├── TURSO_SETUP.md         ← Detailed Turso setup
├── MIGRATION.md           ← Local SQLite → Turso migration
├── ADAPTER_INTERFACE.md   ← How to build adapters
└── CHANGES_SUMMARY.md     ← What changed in code
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing Turso credentials" | Run `cp .env.example .env` and fill in your credentials |
| No .env file | Copy from `.env.example` |
| "Unauthorized" token error | Check token in Turso dashboard, create new if needed |
| Connection timeout | Verify internet connection and DB URL format |
| Command not found | Run `npm install` first |

## View Your Data

### Option 1: Turso Dashboard (Easiest)
1. Go to https://turso.tech/app
2. Select your database
3. Click "Explore"
4. Run: `SELECT * FROM apartments;`

### Option 2: Command Line
With Turso CLI:
```bash
turso db shell your-db-name
# Then: SELECT * FROM apartments;
```

## Important Notes

⚠️ **DO NOT COMMIT `.env` FILE**
- It contains your auth token
- `.gitignore` already excludes it
- Treat like a password!

✅ **Benefits of Turso**
- Data persists across machines
- Automatic backups
- Free tier: 3 GB storage, 1M requests/month
- No local database files to manage

## Next Steps

1. ✅ Set up Turso account (5 min)
2. ✅ Configure `.env` (2 min)
3. ✅ Run first scrape (1 min)
4. 📊 View data in Turso dashboard
5. 🔄 Add more adapters for other websites
6. 📈 Scale: Turso handles millions of listings

## Learning Resources

- Turso Docs: https://docs.turso.tech
- libsql Client: https://github.com/libsql/libsql-js
- Read `README.md` for full documentation
- See `TURSO_SETUP.md` for detailed setup
