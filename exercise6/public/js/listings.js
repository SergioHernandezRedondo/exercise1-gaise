/**
 * listings.js - Listings page functionality
 */

let allListings = [];
let currentSort = 'price_asc';

document.addEventListener('DOMContentLoaded', () => {
  loadListings();
  loadStats();
  
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadListings();
    loadStats();
  });

  document.getElementById('sortPrice').addEventListener('click', () => {
    currentSort = currentSort === 'price_asc' ? 'price_desc' : 'price_asc';
    displayListings();
  });

  document.getElementById('sortLocation').addEventListener('click', () => {
    currentSort = 'location';
    displayListings();
  });
});

async function loadStats() {
  const result = await apiFetch('/stats');
  if (result.success && result.data) {
    const data = result.data;
    document.getElementById('totalListings').textContent = data.totalListings || 0;
    document.getElementById('avgPrice').textContent = formatPrice(data.prices.average);
    document.getElementById('priceRange').textContent = 
      `${formatPrice(data.prices.min)} - ${formatPrice(data.prices.max)}`;
    
    // Last updated
    const lastUpdated = new Date().toLocaleTimeString('de-ES');
    document.getElementById('lastUpdated').textContent = lastUpdated;
  }
}

async function loadListings() {
  const result = await apiFetch('/listings');
  if (result.success && result.data) {
    allListings = result.data;
    displayListings();
  } else {
    showEmptyState();
  }
}

function displayListings() {
  const tbody = document.getElementById('listingsTable');
  tbody.innerHTML = '';

  if (allListings.length === 0) {
    tbody.innerHTML = `
      <tr class="text-center text-muted">
        <td colspan="6">
          <i class="bi bi-inbox"></i> No listings found. Run a scrape first.
        </td>
      </tr>
    `;
    return;
  }

  // Sort listings
  let sorted = [...allListings];
  if (currentSort === 'price_asc') {
    sorted.sort((a, b) => a.price_num - b.price_num);
  } else if (currentSort === 'price_desc') {
    sorted.sort((a, b) => b.price_num - a.price_num);
  } else if (currentSort === 'location') {
    sorted.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
  }

  sorted.forEach((listing) => {
    const row = document.createElement('tr');
    const firstSeen = new Date(listing.firstSeen).toLocaleDateString('de-ES');
    
    row.innerHTML = `
      <td><code>${listing.id}</code></td>
      <td>
        <strong>${listing.title.substring(0, 50)}${listing.title.length > 50 ? '...' : ''}</strong>
        <br>
        <small class="text-muted">${listing.detailUrl ? `<a href="${listing.detailUrl}" target="_blank">Ver detalles →</a>` : 'No disponible'}</small>
      </td>
      <td><strong>${formatPrice(listing.price_num)}</strong></td>
      <td>${listing.location || '-'}</td>
      <td><small>${firstSeen}</small></td>
      <td>
        <button class="btn btn-sm btn-outline-secondary" onclick="copyToClipboard('${listing.id}')">
          <i class="bi bi-link-45deg"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function showEmptyState() {
  const tbody = document.getElementById('listingsTable');
  tbody.innerHTML = `
    <tr class="text-center">
      <td colspan="6" class="py-5">
        <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
        <p class="text-muted mt-3">No listings in database yet.</p>
        <small class="text-muted">Run the scraper first: <code>node scrape.js --site iparralde --persist</code></small>
      </td>
    </tr>
  `;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert(`Copied: ${text}`);
  });
}
