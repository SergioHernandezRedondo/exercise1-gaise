/**
 * Change detection engine for Milestone 3
 * Detects new, changed, and removed listings
 */

const { normalizePrice, normalizeText, compareListings } = require('./normalization');
const { MAX_MISS_COUNT } = require('./constants');

/**
 * Process a new scrape run and detect all changes
 * 
 * @param {array} newListings - Listings from current scrape
 * @param {object} currentState - Current state map: id -> { title, price, price_num, location, url, active, miss_count, first_seen, last_seen, last_modified }
 * @param {string} siteId - Which site was scraped (e.g. 'iparralde')
 * @returns {object} { changes: [], updatedCurrent: {}, snapshots: [] }
 */
function detectChanges(newListings, currentState, siteId) {
  const now = new Date().toISOString();
  const changes = [];
  const updatedCurrent = JSON.parse(JSON.stringify(currentState)); // Deep copy
  const snapshots = [];

  // Track which IDs we see in this run
  const seenIds = new Set();

  // First pass: new and changed listings
  for (const listing of newListings) {
    const { price, price_num } = normalizePrice(listing.price);
    const normalizedTitle = normalizeText(listing.title);
    const normalizedLocation = normalizeText(listing.location);

    const currentListing = currentState[listing.id];
    seenIds.add(listing.id);

    if (!currentListing) {
      // NEW LISTING
      changes.push({
        change_type: 'new',
        listing_id: listing.id,
        diff_json: null
      });

      updatedCurrent[listing.id] = {
        title: normalizedTitle,
        price,
        price_num,
        location: normalizedLocation,
        url: listing.detailUrl || listing.url,
        active: 1,
        miss_count: 0,
        first_seen: now,
        last_seen: now,
        last_modified: now
      };

      // Create snapshot
      snapshots.push({
        id: listing.id,
        siteId,
        title: normalizedTitle,
        price,
        price_num,
        location: normalizedLocation,
        url: listing.detailUrl || listing.url
      });
    } else {
      // EXISTING LISTING - check for changes
      const oldState = currentListing;
      const newState = {
        title: normalizedTitle,
        price,
        price_num,
        location: normalizedLocation,
        url: listing.detailUrl || listing.url
      };

      // Compare fields
      const diffs = compareListings(oldState, newState);

      if (diffs.length > 0) {
        // ATTRIBUTES CHANGED
        changes.push({
          change_type: 'attributes_changed',
          listing_id: listing.id,
          diff_json: JSON.stringify(diffs)
        });

        // Update changed fields
        for (const diff of diffs) {
          updatedCurrent[listing.id][diff.field] = newState[diff.field];
        }
        updatedCurrent[listing.id].last_modified = now;
      }

      // Always update last_seen and reset miss_count
      updatedCurrent[listing.id].last_seen = now;
      updatedCurrent[listing.id].miss_count = 0;

      // Create snapshot with current state
      snapshots.push({
        id: listing.id,
        siteId,
        title: updatedCurrent[listing.id].title,
        price: updatedCurrent[listing.id].price,
        price_num: updatedCurrent[listing.id].price_num,
        location: updatedCurrent[listing.id].location,
        url: updatedCurrent[listing.id].url
      });
    }
  }

  // Second pass: detect removed listings
  for (const listingId in currentState) {
    if (!seenIds.has(listingId)) {
      // Not seen in this run
      updatedCurrent[listingId].miss_count += 1;

      if (updatedCurrent[listingId].miss_count > MAX_MISS_COUNT && updatedCurrent[listingId].active) {
        // REMOVED (exceeded max misses)
        changes.push({
          change_type: 'removed',
          listing_id: listingId,
          diff_json: null
        });

        updatedCurrent[listingId].active = 0;
        updatedCurrent[listingId].last_modified = now;
      }
    }
  }

  return { changes, updatedCurrent, snapshots };
}

/**
 * Summarize changes for display
 * @param {array} changes - Change events
 * @returns {object} Summary with counts
 */
function summarizeChanges(changes) {
  const summary = {
    new: 0,
    price_changed: 0,
    attributes_changed: 0,
    removed: 0
  };

  for (const change of changes) {
    if (change.change_type === 'price_changed' || change.change_type === 'attributes_changed') {
      // Both fall under "attributes_changed" in summary
      summary.attributes_changed++;
    } else {
      summary[change.change_type]++;
    }
  }

  return summary;
}

module.exports = {
  detectChanges,
  summarizeChanges
};
