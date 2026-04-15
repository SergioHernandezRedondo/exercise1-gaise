/**
 * changes.js - Change log page functionality
 */

let allChanges = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  loadChanges();
  
  document.getElementById('refreshBtn').addEventListener('click', loadChanges);

  // Filter buttons
  document.querySelectorAll('input[name="changeType"]').forEach(input => {
    input.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      displayChanges();
    });
  });
});

async function loadChanges() {
  const result = await apiFetch('/changes?limit=200');
  if (result.success && result.data) {
    allChanges = result.data;
    displayChanges();
  } else {
    showEmptyState();
  }
}

function displayChanges() {
  const container = document.getElementById('changesList');
  container.innerHTML = '';

  if (allChanges.length === 0) {
    showEmptyState();
    return;
  }

  // Filter changes
  let filtered = allChanges;
  if (currentFilter !== 'all') {
    filtered = allChanges.filter(change => change.change_type === currentFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted mt-5">
        <i class="bi bi-inbox"></i> No changes of this type.
      </div>
    `;
    return;
  }

  filtered.forEach((change) => {
    const changeEl = createChangeElement(change);
    container.appendChild(changeEl);
  });
}

function createChangeElement(change) {
  const div = document.createElement('div');
  div.className = `change-item ${change.change_type}`;

  let icon = getChangeTypeIcon(change.change_type);
  let badgeClass = getChangeTypeColor(change.change_type);
  
  const typeNames = {
    'new': 'New Listing',
    'attributes_changed': 'Modified',
    'removed': 'Removed',
    'price_changed': 'Price Changed'
  };

  let diffHTML = '';
  if (change.diff_json && Array.isArray(change.diff_json)) {
    diffHTML = '<div class="mt-2">';
    change.diff_json.forEach(diff => {
      diffHTML += `
        <div class="diff-item">
          <strong>${diff.field}:</strong>
          <span class="diff-old">${diff.old}</span>
          <span class="diff-arrow">→</span>
          <span class="diff-new">${diff.new}</span>
        </div>
      `;
    });
    diffHTML += '</div>';
  }

  div.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      <div>
        <span class="change-type-badge ${change.change_type}">
          ${icon} ${typeNames[change.change_type] || change.change_type}
        </span>
        <h6 class="mt-2 mb-1">Listing <code>${change.listing_id}</code></h6>
        <p class="mb-2"><strong>${change.title.substring(0, 60)}${change.title.length > 60 ? '...' : ''}</strong></p>
        ${diffHTML}
      </div>
      <small class="text-muted text-nowrap ms-2">${change.timestamp}</small>
    </div>
  `;

  return div;
}

function showEmptyState() {
  const container = document.getElementById('changesList');
  container.innerHTML = `
    <div class="text-center text-muted mt-5">
      <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
      <p class="mt-3">No changes recorded yet.</p>
      <small>Run a scrape and modify some listings to see changes here.</small>
    </div>
  `;
}
