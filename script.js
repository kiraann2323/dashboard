const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

let rawData = [];
let previousData = [];
let chart = null;
let currentChartType = 'bar';
let refreshTimer = null;
let recentEntriesCount = 5;

// Initialize the dashboard
function initDashboard() {
  setupEventListeners();
  loadData();
  startAutoRefresh();
}

// Set up all event listeners
function setupEventListeners() {
  document.getElementById("districtFilter").addEventListener("change", onDistrictChange);
  document.getElementById("mandalFilter").addEventListener("change", onMandalChange);
  document.getElementById("secretariatFilter").addEventListener("change", updateDashboard);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("refreshNow").addEventListener("click", loadData);
  
  // Chart type buttons
  document.querySelectorAll(".chart-type").forEach(btn => {
    btn.addEventListener("click", function() {
      currentChartType = this.dataset.type;
      updateDashboard();
      document.querySelectorAll(".chart-type").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
    });
  });
  
  // Recent entries filter
  document.querySelectorAll(".recent-filter").forEach(item => {
    item.addEventListener("click", function(e) {
      e.preventDefault();
      recentEntriesCount = parseInt(this.dataset.value);
      document.getElementById("recentDropdown").textContent = this.textContent;
      updateRecentTable(filterData());
    });
  });
  
  // Table row click for details
  document.querySelector("#recentTable tbody").addEventListener("click", function(e) {
    const row = e.target.closest("tr");
    if (row && row.dataset.id) {
      showDetailsModal(row.dataset.id);
    }
  });
}

// Load data from Google Sheets
function loadData() {
  document.body.classList.add("refreshing");
  
  fetch(SHEET_URL)
    .then(res => res.text())
    .then(csv => {
      const parsed = Papa.parse(csv, { header: true });
      previousData = rawData;
      rawData = parsed.data
        .filter(r => r.District && r.Mandal) // avoid empty rows
        .map((item, index) => ({
          ...item,
          ID: index + 1, // Add sequential ID if not present
          timestamp: new Date().getTime() // Add timestamp for sorting
        }));
      
      updateLastUpdated();
      initializeFilters();
      updateDashboard();
      document.body.classList.remove("refreshing");
      
      // Add fade-in animation to cards
      document.querySelectorAll(".card").forEach(card => {
        card.classList.add("fade-in");
      });
    })
    .catch(error => {
      console.error("Error loading data:", error);
      document.body.classList.remove("refreshing");
      showErrorToast("Failed to load data. Please try again later.");
    });
}

// Show error toast notification
function showErrorToast(message) {
  const toast = document.createElement("div");
  toast.className = "position-fixed bottom-0 end-0 p-3";
  toast.style.zIndex = "11";
  toast.innerHTML = `
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header bg-danger text-white">
        <strong class="me-auto">Error</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Start auto-refresh timer
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
}

// Update last updated timestamp
function updateLastUpdated() {
  const now = new Date();
  document.getElementById("lastUpdated").innerHTML = `
    <i class="bi bi-clock-history me-1"></i>
    <span>Last updated: ${now.toLocaleTimeString()} - ${now.toLocaleDateString()}</span>
  `;
}

// Initialize filters with data
function initializeFilters() {
  const districts = getUniqueSortedValues(rawData, "District");
  populateDropdown("districtFilter", districts);
  
  // Initialize other filters as disabled
  populateDropdown("mandalFilter", [], false);
  populateDropdown("secretariatFilter", [], false);
}

// Get unique sorted values from data for a given key
function getUniqueSortedValues(data, key) {
  return [...new Set(data.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Populate a dropdown with values
function populateDropdown(id, values, enable = true) {
  const select = document.getElementById(id);
  const currentValue = select.value;
  
  select.innerHTML = values.length 
    ? `<option value="">All ${id.replace('Filter', 's')}</option>`
    : `<option value="">No options available</option>`;
  
  values.forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val;
    select.appendChild(option);
  });
  
  // Restore previous selection if still available
  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
  
  select.disabled = !enable || values.length === 0;
}

// Reset all filters
function resetFilters() {
  document.getElementById("districtFilter").value = "";
  document.getElementById("mandalFilter").value = "";
  document.getElementById("secretariatFilter").value = "";
  onDistrictChange();
  
  // Show confirmation toast
  const toast = document.createElement("div");
  toast.className = "position-fixed bottom-0 end-0 p-3";
  toast.style.zIndex = "11";
  toast.innerHTML = `
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header bg-success text-white">
        <strong class="me-auto">Filters Reset</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        All filters have been reset to default values.
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Handle district filter change
function onDistrictChange() {
  const district = document.getElementById('districtFilter').value;
  let filteredData = rawData;
  
  if (district) {
    filteredData = rawData.filter(r => r.District === district);
  }
  
  const mandals = getUniqueSortedValues(filteredData, "Mandal");
  populateDropdown("mandalFilter", mandals, !!district);
  
  // If only one mandal, select it automatically
  if (mandals.length === 1) {
    document.getElementById("mandalFilter").value = mandals[0];
  }
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats, false);
  
  updateDashboard();
}

// Handle mandal filter change
function onMandalChange() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  
  let filteredData = rawData;
  
  if (district) {
    filteredData = filteredData.filter(r => r.District === district);
  }
  
  if (mandal) {
    filteredData = filteredData.filter(r => r.Mandal === mandal);
  }
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats, !!mandal);
  
  // If only one secretariat, select it automatically
  if (secretariats.length === 1) {
    document.getElementById("secretariatFilter").value = secretariats[0];
  }
  
  updateDashboard();
}

// Filter data based on current filters
function filterData() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  const secretariat = document.getElementById('secretariatFilter').value;

  return rawData.filter(row =>
    (!district || row.District === district) &&
    (!mandal || row.Mandal === mandal) &&
    (!secretariat || row.Secretariat === secretariat)
  );
}

// Group data by key and count occurrences
function groupByCount(data, key) {
  return data.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

// Update the chart with filtered data
function updateChart(data) {
  const secretariatSelected = document.getElementById('secretariatFilter').value;
  const mandalSelected = document.getElementById('mandalFilter').value;

  let groupKey, chartLabel;
  
  if (secretariatSelected) {
    groupKey = "Secretariat";
    chartLabel = "Applications by Secretariat";
  } else if (mandalSelected) {
    groupKey = "Mandal";
    chartLabel = "Applications by Mandal";
  } else {
    groupKey = "District";
    chartLabel = "Applications by District";
  }

  const grouped = groupByCount(data, groupKey);
  const labels = Object.keys(grouped);
  const counts = Object.values(grouped);

  if (chart) chart.destroy();

  const ctx = document.getElementById("chart").getContext("2d");
  
  // Common chart configuration
  const commonConfig = {
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: counts,
        backgroundColor: getChartColors(currentChartType, labels.length),
        borderColor: '#fff',
        borderWidth: currentChartType === 'pie' || currentChartType === 'doughnut' ? 1 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: (currentChartType === 'pie' || currentChartType === 'doughnut') ? 'right' : 'top',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        },
        datalabels: {
          display: currentChartType === 'pie' || currentChartType === 'doughnut',
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${percentage}%`;
          },
          color: '#fff',
          font: {
            weight: 'bold'
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  };

  // Create chart based on selected type
  switch (currentChartType) {
    case 'pie':
      chart = new Chart(ctx, {
        type: 'pie',
        ...commonConfig,
        plugins: [ChartDataLabels]
      });
      break;
    case 'doughnut':
      chart = new Chart(ctx, {
        type: 'doughnut',
        ...commonConfig,
        plugins: [ChartDataLabels],
        options: {
          ...commonConfig.options,
          cutout: '70%'
        }
      });
      break;
    case 'line':
      chart = new Chart(ctx, {
        type: 'line',
        ...commonConfig,
        options: {
          ...commonConfig.options,
          scales: { 
            y: { 
              beginAtZero: true,
              ticks: { precision: 0 }
            } 
          }
        }
      });
      break;
    default: // bar
      chart = new Chart(ctx, {
        type: 'bar',
        ...commonConfig,
        options: {
          ...commonConfig.options,
          scales: { 
            y: { 
              beginAtZero: true,
              ticks: { precision: 0 }
            } 
          }
        }
      });
  }
}

// Generate colors for chart based on type
function getChartColors(type, count) {
  if (type === 'pie' || type === 'doughnut') {
    return generateColors(count, 0.7, 0.6);
  } else if (type === 'line') {
    return ['#4e73df'];
  } else { // bar
    return generateColors(count, 0.6, 0.8);
  }
}

// Generate an array of HSL colors
function generateColors(count, saturation, lightness) {
  const colors = [];
  const hueStep = 360 / count;
  
  for (let i = 0; i < count; i++) {
    const hue = i * hueStep;
    colors.push(`hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`);
  }
  
  return colors;
}

// Update summary metrics
function updateMetrics(data) {
  const total = data.length;
  document.getElementById("totalApplications").textContent = total.toLocaleString();
  
  const uniqueDistricts = new Set(data.map(item => item.District)).size;
  document.getElementById("uniqueDistricts").textContent = uniqueDistricts.toLocaleString();
  
  const uniqueMandal = new Set(data.map(item => item.Mandal)).size;
  document.getElementById("uniqueMandal").textContent = uniqueMandal.toLocaleString();
  
  const uniqueSecretariat = new Set(data.map(item => item.Secretariat)).size;
  document.getElementById("uniqueSecretariat").textContent = uniqueSecretariat.toLocaleString();
  
  // Calculate changes from previous data if available
  if (previousData.length > 0) {
    const prevTotal = previousData.length;
    const totalChange = calculateChange(prevTotal, total);
    updateChangeIndicator('appChange', totalChange);
    
    const prevDistricts = new Set(previousData.map(item => item.District)).size;
    const districtChange = calculateChange(prevDistricts, uniqueDistricts);
    updateChangeIndicator('districtChange', districtChange);
    
    const prevMandal = new Set(previousData.map(item => item.Mandal)).size;
    const mandalChange = calculateChange(prevMandal, uniqueMandal);
    updateChangeIndicator('mandalChange', mandalChange);
    
    const prevSecretariat = new Set(previousData.map(item => item.Secretariat)).size;
    const secretariatChange = calculateChange(prevSecretariat, uniqueSecretariat);
    updateChangeIndicator('secretariatChange', secretariatChange);
  }
}

// Calculate percentage change
function calculateChange(previous, current) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Update change indicator element
function updateChangeIndicator(elementId, change) {
  const element = document.getElementById(elementId);
  const changeValue = Math.round(change);
  
  element.innerHTML = change === 0 
    ? `<i class="bi bi-dash-circle"></i> <span>0%</span>`
    : change > 0 
      ? `<i class="bi bi-arrow-up-circle"></i> <span>${Math.abs(changeValue)}%</span>`
      : `<i class="bi bi-arrow-down-circle"></i> <span>${Math.abs(changeValue)}%</span>`;
  
  element.className = "metric-change";
  if (change > 0) {
    element.classList.add("positive");
  } else if (change < 0) {
    element.classList.add("negative");
  }
}

// Update recent applications table
function updateRecentTable(data) {
  const tbody = document.querySelector("#recentTable tbody");
  
  // Sort by timestamp (newest first) and take the most recent entries
  const recentData = [...data]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, recentEntriesCount);
  
  if (recentData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No data available for current filters</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  recentData.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.ID;
    tr.innerHTML = `
      <td>${row.ID || 'N/A'}</td>
      <td>${row.District || 'Unknown'}</td>
      <td>${row.Mandal || 'Unknown'}</td>
      <td>${row.Secretariat || 'Unknown'}</td>
      <td class="text-end">${new Date(row.timestamp).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Show details modal
function showDetailsModal(id) {
  const record = rawData.find(item => item.ID == id);
  if (!record) return;
  
  const modalContent = document.getElementById("modalContent");
  modalContent.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <h6>Basic Information</h6>
        <dl class="row">
          <dt class="col-sm-4">ID</dt>
          <dd class="col-sm-8">${record.ID || 'N/A'}</dd>
          
          <dt class="col-sm-4">District</dt>
          <dd class="col-sm-8">${record.District || 'Unknown'}</dd>
          
          <dt class="col-sm-4">Mandal</dt>
          <dd class="col-sm-8">${record.Mandal || 'Unknown'}</dd>
          
          <dt class="col-sm-4">Secretariat</dt>
          <dd class="col-sm-8">${record.Secretariat || 'Unknown'}</dd>
        </dl>
      </div>
      <div class="col-md-6">
        <h6>Additional Details</h6>
        <dl class="row">
          ${Object.entries(record)
            .filter(([key]) => !['ID', 'District', 'Mandal', 'Secretariat', 'timestamp'].includes(key))
            .map(([key, value]) => `
              <dt class="col-sm-4">${key}</dt>
              <dd class="col-sm-8">${value || 'N/A'}</dd>
            `).join('')}
        </dl>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('detailModal'));
  modal.show();
}

// Main dashboard update function
function updateDashboard() {
  const filtered = filterData();
  
  updateChart(filtered);
  updateMetrics(filtered);
  updateRecentTable(filtered);
  
  // Set active chart type button
  document.querySelector(`.chart-type[data-type="${currentChartType}"]`).classList.add("active");
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
