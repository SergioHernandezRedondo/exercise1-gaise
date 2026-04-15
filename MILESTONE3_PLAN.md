# Milestone 3 — Monitoring: Plan

## Overview
Implement full change detection and audit trail. On each run, detect what's new/changed/removed and store immutable snapshots.

## Database Schema

### 1. `scrape_runs` (Metadata)
```sql
CREATE TABLE scrape_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  siteId TEXT NOT NULL,
  started_at TEXT NOT NULL,       -- ISO timestamp
  finished_at TEXT,               -- ISO timestamp (NULL if in progress)
  listings_found INTEGER,         -- How many listings returned by adapter
  status TEXT DEFAULT 'in-progress',  -- in-progress, ok, partial, failed
  error_message TEXT,             -- If status != ok
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `listings_current` (Latest State)
```sql
CREATE TABLE listings_current (
  id TEXT PRIMARY KEY,
  siteId TEXT NOT NULL,
  title TEXT,
  price TEXT,
  price_num INTEGER,
  location TEXT,
  url TEXT,
  active BOOLEAN DEFAULT 1,       -- 1=active, 0=removed
  miss_count INTEGER DEFAULT 0,   -- Consecutive misses
  first_seen TEXT,                -- When first scraped
  last_seen TEXT,                 -- When last seen (updated every scrape)
  last_modified TEXT,             -- When any field last changed
  FOREIGN KEY (siteId) REFERENCES scrape_runs(siteId)
);
```

### 3. `listings_snapshot` (Immutable)
```sql
CREATE TABLE listings_snapshot (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  siteId TEXT NOT NULL,
  title TEXT,
  price TEXT,
  price_num INTEGER,
  location TEXT,
  url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES scrape_runs(run_id)
);
```

### 4. `listing_changes` (Audit Trail)
```sql
CREATE TABLE listing_changes (
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  listing_id TEXT NOT NULL,
  change_type TEXT NOT NULL,      -- new, price_changed, attributes_changed, removed
  diff_json TEXT,                 -- JSON array: [{"field": "price_num", "old": 195000, "new": 189000}]
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES scrape_runs(run_id),
  FOREIGN KEY (listing_id) REFERENCES listings_current(id)
);
```

## Implementation Steps

### Phase 1: Database Schema
- [ ] Add 4 new tables to `database.js` in `init()`
- [ ] Create indexes on `scrape_runs(siteId, finished_at)` and `listings_snapshot(run_id)`

### Phase 2: Normalization Utilities
Create `lib/normalization.js`:
- [ ] `normalizePrice(priceStr) -> { price_str, price_num }`
  - Strip €, $, commas, etc.
  - Parse to integer (cents or units depending on currency)
  - Return both raw and numeric
- [ ] `normalizeText(text) -> string`
  - Trim whitespace
  - Collapse multiple spaces to single space
  - Lowercase for comparison? (optional)

### Phase 3: Change Detection Engine
Create `lib/changeDetection.js`:
- [ ] `detectChanges(currentSnapshot, listings, run_id) -> { changes, newCurrent, newSnapshots }`
  - Compare current listings vs. listings_current
  - Generate change events for:
    - **new**: id not in listings_current
    - **price_changed**: normalized prices differ
    - **attributes_changed**: text fields differ after normalization
    - **removed**: last_seen + MAX_MISS_COUNT misses exceeded
  - Return:
    - Array of change events
    - Updated listings_current rows
    - New listings_snapshot rows

### Phase 4: Database Integration
Update `database.js`:
- [ ] `startRun(siteId) -> run_id`
  - Insert into scrape_runs with status='in-progress'
- [ ] `finishRun(run_id, status, listings_found, error_message?)`
  - Update scrape_runs with finished_at and status
- [ ] `processListings(run_id, listings, siteId, dryRun=false) -> { changes, stats }`
  - Call changeDetection engine
  - If not dryRun:
    - Insert snapshots into listings_snapshot
    - Update or insert into listings_current
    - Insert into listing_changes
  - Return summary stats

### Phase 5: CLI Updates
Update `scrape.js`:
- [ ] Add `--dry-run` flag (prints changes without writing)
- [ ] Wrap scraping workflow:
  ```
  1. startRun() -> run_id
  2. Call adapter
  3. processListings(run_id, listings, dryRun)
  4. Print change summary
  5. finishRun(run_id, 'ok', count)
  ```
- [ ] Add `--changes` command to view recent changes
  ```bash
  node scrape.js --changes [--site <site>] [--limit 20]
  ```

### Phase 6: Testing
- [ ] First run: verify all listings marked as "new"
- [ ] Second immediate run: verify no price/attributes changes, only last_seen updated
- [ ] Missing listing: verify miss_count increments, not marked removed until MAX_MISS_COUNT
- [ ] Reappeared listing: verify new "new" event, miss_count reset to 0
- [ ] --dry-run: verify no DB writes
- [ ] --changes: verify change query works

## Configuration

```javascript
// constants.js or top of database.js
const MAX_MISS_COUNT = 2;  // Mark removed after 2 consecutive misses
```

## Files to Create/Modify

### New Files
- `lib/normalization.js` — Price and text normalization
- `lib/changeDetection.js` — Change detection engine
- `lib/constants.js` — MAX_MISS_COUNT and other constants

### Modified Files
- `database.js` — Add 4 tables, new methods
- `scrape.js` — CLI integration with --dry-run, --changes
- `package.json` — (no changes if using libsql only)

## Change Detection Algorithm

```pseudocode
function detectChanges(currentListings, newListings, run_id):
  changes = []
  
  // First pass: new and changed
  for listing in newListings:
    normalized = normalize(listing)
    current = currentListings.get(listing.id)
    
    if current is null:
      changes.add({ type: 'new', id: listing.id, diff: null })
      currentListings[id] = { ...normalized, miss_count: 0, first_seen: now, last_seen: now, active: true }
    else:
      current.last_seen = now
      current.miss_count = 0
      
      diffs = compareFields(current, normalized)
      if diffs has price or attributes:
        changes.add({ type: 'attributes_changed', id: listing.id, diff: diffs })
        current.last_modified = now
  
  // Second pass: removals (check all listings not seen this run)
  for id, current in currentListings:
    if not found in newListings:
      current.miss_count += 1
      if current.miss_count > MAX_MISS_COUNT:
        current.active = false
        changes.add({ type: 'removed', id, diff: null })
      elif not already marked missing:
        // Still tracking, not yet removed
  
  return changes
```

## Example Output

### First Run
```
=== Scrape Results ===
Site: iparralde
Listings found: 37

Changes detected:
  new: 37
  price_changed: 0
  attributes_changed: 0
  removed: 0
```

### Second Run (no changes)
```
=== Scrape Results ===
Site: iparralde
Listings found: 37

Changes detected:
  new: 0
  price_changed: 0
  attributes_changed: 0
  removed: 0
  
Note: 37 listings seen again (last_seen updated)
```

### --dry-run Output
```
=== DRY RUN (no DB writes) ===
Site: iparralde
Listings found: 38

Changes detected:
  new: 1
  price_changed: 0
  attributes_changed: 0
  removed: 0

New listing: id=iparralde-1234, title="Piso nuevo en Hendaye"
```

## Acceptance Criteria Checklist

- [ ] First run creates "new" events for all 37 listings
- [ ] Second immediate run has no price/attributes changes
- [ ] Missing listing not marked removed until 3rd consecutive miss (MAX_MISS_COUNT=2)
- [ ] Reappeared listing generates "new" event, resets miss_count
- [ ] scrape_runs table tracks all runs with metadata
- [ ] listings_snapshot immutable copies all listings per run
- [ ] --dry-run flag works without DB writes
- [ ] --changes command shows recent modifications

## Estimated Complexity
- Database schema: ~30 lines
- Normalization helpers: ~40 lines
- Change detection engine: ~80 lines
- Database integration: ~100 lines
- CLI updates: ~50 lines
- Total: ~300 lines of new code

---

## Ready to Implement?
Reply with:
- ✅ Yes, proceed with implementation
- 🔧 Modify the plan first (specify changes)
- ❓ Ask questions before starting
