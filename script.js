const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let rawData = [];
let previousData = [];
let mainChart = null;
let trendChart = null;
let currentChartType = 'bar';
let refreshTimer = null;

// Initialize the dashboard
function initDashboard() {
  console.log("Initializing dashboard...");
  setupEventListeners();
  loadData();
  startAutoRefresh();
}

// Set up event listeners
function setupEventListeners() {
  console.log("Setting up event listeners...");
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

// Load data from Google Sheets with multiple fallback methods
async function loadData() {
  try {
    console.log("Attempting to load data...");
    document.body.classList.add("refreshing");
    
    // Method 1: Direct fetch
    let response = await fetch(SHEET_URL);
    console.log("Direct fetch status:", response.status);
    
    // Method 2: If direct fetch fails, try with no-cors mode
    if (!response.ok) {
      console.log("Trying no-cors mode...");
      response = await fetch(SHEET_URL, { mode: 'no-cors' });
    }
    
    // Method 3: If still failing, try through CORS proxy
    if (!response.ok) {
      console.log("Trying CORS proxy...");
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_URL)}`;
      response = await fetch(proxyUrl);
      
      if (response.ok) {
        const proxyData = await response.json();
        if (proxyData.contents) {
          response = new Response(proxyData.contents);
        }
      }
    }
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const csv = await response.text();
    console.log("Received CSV data length:", csv.length);
    
    // Parse CSV with error handling
    let parsed;
    try {
      parsed = Papa.parse(csv, { 
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim()
      });
    } catch (parseError) {
      console.error("CSV parsing error:", parseError);
      throw new Error("Failed to parse CSV data");
    }
    
    console.log("Parsed data rows:", parsed.data.length);
    
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('No valid data received from sheet');
    }
    
    // Process and validate data
    previousData = rawData;
    rawData = parsed.data
      .filter(r => r.District && r.Mandal) // Filter empty rows
      .map((item, index) => {
        // Validate and clean each field
        const cleanItem = {};
        for (const key in item) {
          cleanItem[key] = item[key] ? item[key].toString().trim() : '';
        }
        return {
          ...cleanItem,
          ID: index + 1,
          timestamp: new Date().getTime()
        };
      });
    
    console.log("Processed data rows:", rawData.length);
    
    if (rawData.length === 0) {
      throw new Error('No valid data after processing');
    }
    
    updateLastUpdated();
    initializeFilters();
    updateDashboard();
    
    showToast(`Successfully loaded ${rawData.length} records`, 'success');
  } catch (error) {
    console.error("Data loading failed:", error);
    showToast(`Data load failed: ${error.message}`, 'error');
    
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
  console.log("Auto-refresh timer started");
}

// Update last updated timestamp
function updateLastUpdated() {
  const now = new Date();
  const lastUpdatedElement = document.getElementById("lastUpdated");
  if (lastUpdatedElement) {
    lastUpdatedElement.innerHTML = `
      <i class="bi bi-clock-history me-1"></i>
      <span>Last updated: ${now.toLocaleTimeString()} - ${now.toLocaleDateString()}</span>
    `;
  }
}

// Initialize filters with data
function initializeFilters() {
  console.log("Initializing filters with", rawData.length, "records");
  
  try {
    const districts = getUniqueSortedValues(rawData, "District");
    populateDropdown("districtFilter", districts);
    populateDropdown("mandalFilter", [], false);
    populateDropdown("secretariatFilter", [], false);
  } catch (error) {
    console.error("Filter initialization failed:", error);
    showToast('Failed to initialize filters', 'error');
  }
}

// Get unique sorted values with validation
function getUniqueSortedValues(data, key) {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid data passed to getUniqueSortedValues");
    return [];
  }
  
  try {
    const values = data.map(item => item[key]).filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error("Error in getUniqueSortedValues:", error);
    return [];
  }
}

// Populate dropdown with validation
function populateDropdown(id, values, enable = true) {
  const select = document.getElementById(id);
  if (!select) {
    console.error(`Dropdown element with ID ${id} not found`);
    return;
  }
  
  const currentValue = select.value;
  
  select.innerHTML = values.length 
    ? `<option value="">All ${id.replace('Filter', 's')}</option>`
    : `<option value="">No options available</option>`;
  
  values.forEach(val => {
    try {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    } catch (error) {
      console.error("Error creating option element:", error);
    }
  });
  
  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
  
  select.disabled = !enable || values.length === 0;
}

// Reset all filters
function resetFilters() {
  console.log("Resetting filters...");
  document.getElementById("districtFilter").value = "";
  document.getElementById("mandalFilter").value = "";
  document.getElementById("secretariatFilter").value = "";
  onDistrictChange();
  showToast('Filters reset successfully', 'success');
}

// Handle district filter change
function onDistrictChange() {
  console.log("District filter changed");
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
  console.log("Mandal filter changed");
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
  try {
    const district = document.getElementById('districtFilter').value;
    const mandal = document.getElementById('mandalFilter').value;
    const secretariat = document.getElementById('secretariatFilter').value;

    return rawData.filter(row =>
      (!district || row.District === district) &&
      (!mandal || row.Mandal === mandal) &&
      (!secretariat || row.Secretariat === secretariat)
    );
  } catch (error) {
    console.error("Error in filterData:", error);
    return [];
  }
}

// Update the main chart with error handling
function updateMainChart(data) {
  console.log("Updating main chart with", data.length, "records");
  
  try {
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

    if (mainChart) {
      mainChart.destroy();
      mainChart = null;
    }

    const ctx = document.getElementById("chart");
    if (!ctx) {
      console.error("Chart canvas element not found");
      return;
    }

    mainChart = new Chart(ctx.getContext("2d"), {
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
                const percent = total > 0 ? Math.round(context.raw / total * 100) : 0;
                return `${context.label}: ${context.raw} (${percent}%)`;
              }
            }
          }
        },
        scales: currentChartType === 'bar' ? {
          y: { 
            beginAtZero: true, 
            ticks: { 
              precision: 0,
              callback: function(value) {
                if (value % 1 === 0) return value;
              }
            } 
          }
        } : {}
      }
    });
  } catch (error) {
    console.error("Error updating main chart:", error);
    showToast('Failed to update chart', 'error');
  }
}

// Generate chart colors with validation
function getChartColors(type, count) {
  try {
    if (type === 'pie' || type === 'doughnut') {
      const colors = [];
      for (let i = 0; i < count; i++) {
        colors.push(`hsl(${(i * 360 / Math.max(1, count))}, 70%, 60%)`);
      }
      return colors;
    }
    return ['#4e73df'];
  } catch (error) {
    console.error("Error generating chart colors:", error);
    return ['#4e73df'];
  }
}

// Update metrics with validation
function updateMetrics(data) {
  try {
    const totalElement = document.getElementById("totalApplications");
    if (totalElement) {
      totalElement.textContent = data.length.toLocaleString();
    }
    
    const uniqueDistricts = new Set(data.map(item => item.District)).size;
    const districtsElement = document.getElementById("uniqueDistricts");
    if (districtsElement) {
      districtsElement.textContent = uniqueDistricts.toLocaleString();
    }
    
    const uniqueMandal = new Set(data.map(item => item.Mandal)).size;
    const mandalElement = document.getElementById("uniqueMandal");
    if (mandalElement) {
      mandalElement.textContent = uniqueMandal.toLocaleString();
    }
    
    if (previousData.length > 0) {
      const prevTotal = previousData.length;
      const totalChange = prevTotal > 0 ? Math.round((data.length - prevTotal) / prevTotal * 100) : 0;
      const changeElement = document.getElementById("appChange");
      if (changeElement) {
        changeElement.textContent = `${totalChange >= 0 ? '+' : ''}${totalChange}%`;
        changeElement.className = totalChange >= 0 ? 'positive' : 'negative';
      }
    }
  } catch (error) {
    console.error("Error updating metrics:", error);
  }
}

// Update recent table with validation
function updateRecentTable(data) {
  try {
    const tbody = document.querySelector("#recentTable tbody");
    if (!tbody) {
      console.error("Recent table body not found");
      return;
    }
    
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
  } catch (error) {
    console.error("Error updating recent table:", error);
  }
}

// Main dashboard update with validation
function updateDashboard() {
  console.log("Updating dashboard...");
  try {
    const filtered = filterData();
    console.log("Filtered data count:", filtered.length);
    
    updateMainChart(filtered);
    updateMetrics(filtered);
    updateRecentTable(filtered);
  } catch (error) {
    console.error("Dashboard update failed:", error);
    showToast('Dashboard update failed', 'error');
  }
}

// Load sample data if real data fails
function loadSampleData() {
  console.log("Loading sample data...");
  const sampleData = [
    { District: "District1", Mandal: "Mandal1", Secretariat: "Secretariat1" },
    { District: "District1", Mandal: "Mandal1", Secretariat: "Secretariat2" },
    { District: "District1", Mandal: "Mandal2", Secretariat: "Secretariat3" },
    { District: "District2", Mandal: "Mandal3", Secretariat: "Secretariat4" },
    { District: "District2", Mandal: "Mandal4", Secretariat: "Secretariat5" },
    { District: "District3", Mandal: "Mandal5", Secretariat: "Secretariat6" }
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
