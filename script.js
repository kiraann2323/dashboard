const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?output=csv";
const PROXY_URL = "https://api.allorigins.win/raw?url="; // CORS proxy
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let rawData = [];
let previousData = [];
let mainChart = null;
let trendChart = null;
let currentChartType = 'bar';
let refreshTimer = null;

// Initialize the dashboard
function initDashboard() {
  setupEventListeners();
  loadData();
  startAutoRefresh();
}

// Set up event listeners
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

// Load data from Google Sheets with CORS proxy fallback
async function loadData() {
  try {
    document.body.classList.add("refreshing");
    
    // First try direct access
    let response;
    try {
      response = await fetch(SHEET_URL);
      if (!response.ok) throw new Error('Direct fetch failed');
    } catch (e) {
      // If direct access fails, use proxy
      response = await fetch(PROXY_URL + encodeURIComponent(SHEET_URL));
      if (!response.ok) throw new Error('Proxy fetch failed');
    }

    const csv = await response.text();
    const parsed = Papa.parse(csv, { header: true });
    
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('No data received from sheet');
    }
    
    previousData = rawData;
    rawData = parsed.data
      .filter(r => r.District && r.Mandal) // Filter empty rows
      .map((item, index) => ({
        ...item,
        ID: index + 1,
        timestamp: new Date().getTime()
      }));
    
    updateLastUpdated();
    initializeFilters();
    updateDashboard();
    
    showToast('Data loaded successfully', 'success');
  } catch (error) {
    console.error("Error loading data:", error);
    showToast('Failed to load data. Please try again later.', 'error');
    
    // Load sample data if real data fails
    if (rawData.length === 0) {
      loadSampleData();
    }
  } finally {
    document.body.classList.remove("refreshing");
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
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
  document.getElementById("lastUpdated").innerHTML = `
    <i class="bi bi-clock-history me-1"></i>
    <span>Last updated: ${now.toLocaleTimeString()} - ${now.toLocaleDateString()}</span>
  `;
}

// Initialize filters with data
function initializeFilters() {
  const districts = getUniqueSortedValues(rawData, "District");
  populateDropdown("districtFilter", districts);
  populateDropdown("mandalFilter", [], false);
  populateDropdown("secretariatFilter", [], false);
}

// Get unique sorted values
function getUniqueSortedValues(data, key) {
  return [...new Set(data.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Populate dropdown
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
  showToast('Filters reset successfully', 'success');
}

// Handle district filter change
function onDistrictChange() {
  const district = document.getElementById('districtFilter').value;
  const filteredData = district ? rawData.filter(r => r.District === district) : rawData;
  
  const mandals = getUniqueSortedValues(filteredData, "Mandal");
  populateDropdown("mandalFilter", mandals, !!district);
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats, false);
  
  updateDashboard();
}

// Handle mandal filter change
function onMandalChange() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  
  let filteredData = rawData;
  if (district) filteredData = filteredData.filter(r => r.District === district);
  if (mandal) filteredData = filteredData.filter(r => r.Mandal === mandal);
  
  const secretariats = getUniqueSortedValues(filteredData, "Secretariat");
  populateDropdown("secretariatFilter", secretariats, !!mandal);
  
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

// Update the main chart
function updateMainChart(data) {
  const secretariatSelected = document.getElementById('secretariatFilter').value;
  const mandalSelected = document.getElementById('mandalFilter').value;

  let groupKey = secretariatSelected ? "Secretariat" : 
                mandalSelected ? "Mandal" : "District";
  let chartLabel = `Applications by ${groupKey}`;

  const grouped = data.reduce((acc, row) => {
    const value = row[groupKey] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const counts = Object.values(grouped);

  if (mainChart) mainChart.destroy();

  const ctx = document.getElementById("chart").getContext("2d");
  mainChart = new Chart(ctx, {
    type: currentChartType,
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: counts,
        backgroundColor: getChartColors(currentChartType, labels.length),
        borderColor: '#fff',
        borderWidth: ['pie', 'doughnut'].includes(currentChartType) ? 1 : 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: ['pie', 'doughnut'].includes(currentChartType) ? 'right' : 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = Math.round(context.raw / total * 100);
              return `${context.label}: ${context.raw} (${percent}%)`;
            }
          }
        }
      },
      scales: currentChartType === 'bar' ? {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      } : {}
    }
  });
}

// Generate chart colors
function getChartColors(type, count) {
  if (type === 'pie' || type === 'doughnut') {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(`hsl(${(i * 360 / count)}, 70%, 60%)`);
    }
    return colors;
  }
  return ['#4e73df'];
}

// Update metrics
function updateMetrics(data) {
  document.getElementById("totalApplications").textContent = data.length;
  
  const uniqueDistricts = new Set(data.map(item => item.District)).size;
  document.getElementById("uniqueDistricts").textContent = uniqueDistricts;
  
  const uniqueMandal = new Set(data.map(item => item.Mandal)).size;
  document.getElementById("uniqueMandal").textContent = uniqueMandal;
  
  if (previousData.length > 0) {
    const prevTotal = previousData.length;
    const totalChange = Math.round((data.length - prevTotal) / prevTotal * 100);
    document.getElementById("appChange").textContent = 
      `${totalChange >= 0 ? '+' : ''}${totalChange}%`;
  }
}

// Update recent table
function updateRecentTable(data) {
  const tbody = document.querySelector("#recentTable tbody");
  tbody.innerHTML = '';
  
  const recentData = data.slice(-5).reverse();
  
  if (recentData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No data available</td></tr>';
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

// Main dashboard update
function updateDashboard() {
  const filtered = filterData();
  updateMainChart(filtered);
  updateMetrics(filtered);
  updateRecentTable(filtered);
}

// Load sample data if real data fails
function loadSampleData() {
  const sampleData = [
    { District: "District1", Mandal: "Mandal1", Secretariat: "Secretariat1" },
    { District: "District1", Mandal: "Mandal1", Secretariat: "Secretariat2" },
    { District: "District1", Mandal: "Mandal2", Secretariat: "Secretariat3" },
    { District: "District2", Mandal: "Mandal3", Secretariat: "Secretariat4" }
  ];
  
  rawData = sampleData.map((item, index) => ({
    ...item,
    ID: index + 1,
    timestamp: new Date().getTime()
  }));
  
  updateLastUpdated();
  initializeFilters();
  updateDashboard();
  showToast('Using sample data - real data load failed', 'warning');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
