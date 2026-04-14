/**
 * Normalization utilities for consistent comparisons
 */

/**
 * Normalize price string to both raw and numeric forms
 * Strips currency symbols, commas, etc. and parses to integer (cents)
 * 
 * @param {string} priceStr - Raw price string e.g. "195.000 €" or "$45,000"
 * @returns {object} { price: string, price_num: number }
 */
function normalizePrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') {
    return { price: priceStr || '', price_num: null };
  }

  // Return raw as-is for storage
  const price = priceStr.trim();

  // Parse numeric value: remove symbols, spaces, commas, periods
  // Then parse as integer
  let numStr = priceStr
    .replace(/[€$£¥]/g, '') // Currency symbols
    .replace(/,\s*/g, '')    // Commas (used for thousands in some locales)
    .replace(/\s+/g, '')     // All whitespace
    .trim();

  // Handle localized decimals: if last period is followed by 1-2 digits, it's a decimal
  // Otherwise it's a thousands separator and should be removed
  const matches = numStr.match(/\.(\d+)$/);
  if (matches && matches[1].length <= 2) {
    // It's a decimal point, convert to integer by removing it
    // For EUR, we typically work with whole euros, not cents
    numStr = numStr.replace(/\./, '');
  } else {
    // Remove all periods (thousands separators)
    numStr = numStr.replace(/\./g, '');
  }

  // Parse to integer
  const price_num = parseInt(numStr, 10) || null;

  return { price, price_num };
}

/**
 * Normalize text field for comparison
 * Trims whitespace, collapses multiple spaces, optionally lowercase
 * 
 * @param {string} text - Raw text field
 * @param {boolean} lowercase - Whether to lowercase for comparison (default: false)
 * @returns {string} Normalized text
 */
function normalizeText(text, lowercase = false) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalized = text
    .trim()                    // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ');     // Collapse multiple spaces to single

  if (lowercase) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Compare two listings and detect which fields changed
 * Returns array of changes in { field, old, new } format
 * 
 * @param {object} oldListing - Previous state
 * @param {object} newListing - Current state (with normalized price_num)
 * @returns {array} Array of { field, old, new } objects, empty if no changes
 */
function compareListings(oldListing, newListing) {
  const changes = [];
  const fieldsToCompare = ['title', 'location', 'price_num'];

  for (const field of fieldsToCompare) {
    const oldVal = oldListing[field];
    const newVal = newListing[field];

    // For text fields, normalize for comparison
    let oldNorm = oldVal;
    let newNorm = newVal;

    if (field === 'title' || field === 'location') {
      oldNorm = normalizeText(oldVal);
      newNorm = normalizeText(newVal);
    }

    if (oldNorm !== newNorm) {
      changes.push({
        field,
        old: oldVal,
        new: newVal
      });
    }
  }

  return changes;
}

module.exports = {
  normalizePrice,
  normalizeText,
  compareListings
};
