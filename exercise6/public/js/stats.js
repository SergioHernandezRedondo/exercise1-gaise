/**
 * stats.js - Statistics page with charts
 */

let histogramChart = null;
let changesChart = null;

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  document.getElementById('refreshBtn').addEventListener('click', loadStats);
});

async function loadStats() {
  const result = await apiFetch('/stats');
  if (result.success && result.data) {
    const data = result.data;
    updateKPIs(data);
    updatePriceStats(data.prices);
    updateCharts(data);
  }
}

function updateKPIs(data) {
  document.getElementById('totalListings').textContent = data.totalListings || 0;
  document.getElementById('newCount').textContent = data.changes24h.new || 0;
  document.getElementById('changedCount').textContent = data.changes24h.attributes_changed || 0;
  document.getElementById('removedCount').textContent = data.changes24h.removed || 0;
}

function updatePriceStats(prices) {
  const avgPrice = formatPrice(prices.average);
  const minPrice = formatPrice(prices.min);
  const maxPrice = formatPrice(prices.max);
  const spread = prices.max - prices.min;

  document.getElementById('avgPrice').textContent = avgPrice;
  document.getElementById('minPrice').textContent = minPrice;
  document.getElementById('maxPrice').textContent = maxPrice;
  document.getElementById('priceSpread').textContent = formatPrice(spread);
}

function updateCharts(data) {
  // Price Distribution Histogram
  if (data.priceHistogram && data.priceHistogram.length > 0) {
    updateHistogramChart(data.priceHistogram);
  }

  // Changes Chart
  updateChangesChart(data.changes24h);
}

function updateHistogramChart(histogram) {
  const ctx = document.getElementById('histogramChart').getContext('2d');
  
  const labels = histogram.map(h => h.bucket);
  const counts = histogram.map(h => h.count);

  if (histogramChart) {
    histogramChart.destroy();
  }

  histogramChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Listings',
        data: counts,
        backgroundColor: 'rgba(13, 110, 253, 0.6)',
        borderColor: 'rgba(13, 110, 253, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Listings'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Price Range'
          }
        }
      }
    }
  });
}

function updateChangesChart(changes24h) {
  const ctx = document.getElementById('changesChart').getContext('2d');
  
  const labels = ['New', 'Modified', 'Removed'];
  const data = [changes24h.new, changes24h.attributes_changed, changes24h.removed];
  const colors = ['#198754', '#ffc107', '#dc3545'];

  if (changesChart) {
    changesChart.destroy();
  }

  changesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}
