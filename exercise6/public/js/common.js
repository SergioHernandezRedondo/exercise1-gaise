/**
 * common.js - Shared utilities for dashboard
 */

const API_BASE = '/api';

/**
 * Format price as EUR currency
 */
function formatPrice(priceNum) {
  if (!priceNum) return '€0';
  return `€${parseInt(priceNum).toLocaleString('de-DE')}`;
}

/**
 * Format date to readable format
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-ES') + ' ' + date.toLocaleTimeString('de-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Fetch from API
 */
async function apiFetch(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error: ${endpoint}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update footer status
 */
async function updateFooterStatus() {
  try {
    const result = await apiFetch('/status');
    if (result.success && result.data) {
      const footerEl = document.getElementById('footer-status');
      if (footerEl) {
        const dbInfo = result.data;
        footerEl.innerHTML = `
          📊 Total Listings: <strong>${dbInfo.totalListings || 0}</strong> | 
          Last Update: <strong>${new Date(dbInfo.lastRun || Date.now()).toLocaleTimeString('de-ES')}</strong>
        `;
      }
    }
  } catch (err) {
    console.error('Error updating status:', err);
  }
}

/**
 * Change type to emoji
 */
function getChangeTypeIcon(changeType) {
  const icons = {
    'new': '🆕',
    'attributes_changed': '✏️',
    'removed': '🗑️',
    'price_changed': '💰'
  };
  return icons[changeType] || '📝';
}

/**
 * Change type to color
 */
function getChangeTypeColor(changeType) {
  const colors = {
    'new': 'success',
    'attributes_changed': 'warning',
    'removed': 'danger',
    'price_changed': 'info'
  };
  return colors[changeType] || 'secondary';
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show brief toast-like notification
    const originalText = event.target.innerHTML;
    event.target.innerHTML = '<i class="bi bi-check"></i> Copied!';
    setTimeout(() => {
      event.target.innerHTML = originalText;
    }, 2000);
  }).catch(() => {
    alert(`Copy failed. Text: ${text}`);
  });
}

// Update footer on page load
document.addEventListener('DOMContentLoaded', () => {
  updateFooterStatus();
  // Update every 30 seconds
  setInterval(updateFooterStatus, 30000);
});
