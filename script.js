const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

let rawData = [];
let chart = null;
let currentChartType = 'bar';
let refreshTimer = null;

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
  
  // Chart type buttons
  document.querySelectorAll(".chart-type").forEach(btn => {
    btn.addEventListener("click", function() {
      currentChartType = this.dataset.type;
      updateDashboard();
      document.querySelectorAll(".chart-type").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
    });
  });
}

// Load data from Google Sheets
function loadData() {
  document.body.classList.add("refreshing");
  
  fetch(SHEET_URL)
    .then(res => res.text())
    .then(csv => {
      const parsed = Papa.parse(csv, { header: true });
      rawData = parsed.data.filter(r => r.District); // avoid empty rows
      
      updateLastUpdated();
      initializeFilters();
      updateDashboard();
      document.body.classList.remove("refreshing");
    })
    .catch(error => {
      console.error("Error loading data:", error);
      document.body.classList.remove("refreshing");
      alert("Failed to load data. Please try again later.");
    });
}

// Start auto-refresh timer
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
}

// Update last updated timestamp
function updateLastUpdated() {
  const now = new Date();
  document.getElementById("lastUpdated").textContent = 
    `Last updated: ${now.toLocaleString()}`;
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
  return [...new Set(data.map(item => item[key]).filter(Boolean))].sort();
}

// Populate a dropdown with values
function populateDropdown(id, values, enable = true) {
  const select = document.getElementById(id);
  select.innerHTML = values.length 
    ? '<option value="">All ' + id.replace('Filter', 's') + '</option>'
    : '<option value="">No options available</option>';
  
  values.forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val;
    select.appendChild(option);
  });
  select.disabled = !enable || values.length === 0;
}

// Reset all filters
function resetFilters() {
  document.getElementById("districtFilter").value = "";
  document.getElementById("mandalFilter").value = "";
  document.getElementById("secretariatFilter").value = "";
  onDistrictChange();
}

// Handle district filter change
function onDistrictChange() {
  const district = document.getElementById('districtFilter').value;
  const filteredData = district 
    ? rawData.filter(r => r.District === district)
    : rawData;
  
  const mandals = getUniqueSortedValues(filteredData, "Mandal");
  populateDropdown("mandalFilter", mandals);
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats);
  
  updateDashboard();
}

// Handle mandal filter change
function onMandalChange() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  
  const filteredData = rawData.filter(r =>
    (!district || r.District === district) &&
    (!mandal || r.Mandal === mandal)
  );
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats);
  
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
        backgroundColor: getChartColors(currentChartType, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: currentChartType === 'pie' ? 'right' : 'top',
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
        }
      }
    }
  };

  // Create chart based on selected type
  switch (currentChartType) {
    case 'pie':
      chart = new Chart(ctx, {
        type: 'pie',
        ...commonConfig
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
  if (type === 'pie') {
    return generateColors(count, 0.7, 0.8);
  } else if (type === 'line') {
    return '#4CAF50';
  } else { // bar
    return generateColors(count, 0.6, 0.9);
  }
}

// Generate an array of colors
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
  document.getElementById("totalApplications").textContent = data.length;
  
  const uniqueDistricts = new Set(data.map(item => item.District)).size;
  document.getElementById("uniqueDistricts").textContent = uniqueDistricts;
  
  const uniqueMandal = new Set(data.map(item => item.Mandal)).size;
  document.getElementById("uniqueMandal").textContent = uniqueMandal;
}

// Update recent applications table
function updateRecentTable(data) {
  const tbody = document.querySelector("#recentTable tbody");
  tbody.innerHTML = '';
  
  // Show last 5 applications (or all if less than 5)
  const recentData = data.slice(-5).reverse();
  
  if (recentData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No data available</td></tr>';
    return;
  }
  
  recentData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.ID || 'N/A'}</td>
      <td>${row.District || 'Unknown'}</td>
      <td>${row.Mandal || 'Unknown'}</td>
      <td>${row.Secretariat || 'Unknown'}</td>
    `;
    tbody.appendChild(tr);
  });
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
