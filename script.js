// Configuration - Replace with your Google Sheets URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Global variables
let rawData = [];
let previousData = [];
let mainChart = null;
let trendChart = null;
let fullscreenChart = null;
let currentChartType = 'bar';
let recentEntriesCount = 5;
let showTrendLine = true;
let showDataLabels = true;
let refreshTimer = null;
let dateRangeFilter = null;

// Initialize the dashboard
function initDashboard() {
  // Hide preloader when everything is loaded
  setTimeout(() => {
    document.querySelector('.preloader').style.opacity = '0';
    setTimeout(() => {
      document.querySelector('.preloader').style.display = 'none';
    }, 500);
  }, 1000);

  setupEventListeners();
  initializePlugins();
  loadData();
  startAutoRefresh();
}

// Initialize plugins
function initializePlugins() {
  // Initialize select2 for searchable dropdowns
  $('.searchable-select').select2({
    width: '100%',
    placeholder: $(this).data('placeholder'),
    allowClear: true
  });

  // Initialize date range picker
  dateRangeFilter = $('.date-range-picker').daterangepicker({
    opens: 'left',
    autoUpdateInput: false,
    locale: {
      cancelLabel: 'Clear'
    }
  });

  dateRangeFilter.on('apply.daterangepicker', function(ev, picker) {
    $(this).val(picker.startDate.format('MM/DD/YYYY') + ' - ' + picker.endDate.format('MM/DD/YYYY'));
    updateDashboard();
  });

  dateRangeFilter.on('cancel.daterangepicker', function(ev, picker) {
    $(this).val('');
    updateDashboard();
  });
}

// Set up all event listeners
function setupEventListeners() {
  // Filter dropdowns
  document.getElementById("districtFilter").addEventListener("change", onDistrictChange);
  document.getElementById("mandalFilter").addEventListener("change", onMandalChange);
  document.getElementById("secretariatFilter").addEventListener("change", updateDashboard);
  
  // Reset filters button
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  
  // Manual refresh button
  document.getElementById("refreshNow").addEventListener("click", loadData);
  
  // Export data button
  document.getElementById("exportData").addEventListener("click", exportData);
  
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
  
  // Clear date filter
  document.getElementById("clearDateFilter").addEventListener("click", function() {
    dateRangeFilter.val('').trigger('change');
  });
  
  // View options
  document.getElementById("toggleTrendLine").addEventListener("click", function(e) {
    e.preventDefault();
    showTrendLine = !showTrendLine;
    updateDashboard();
  });
  
  document.getElementById("toggleDataLabels").addEventListener("click", function(e) {
    e.preventDefault();
    showDataLabels = !showDataLabels;
    updateDashboard();
  });
  
  document.getElementById("fullscreenChart").addEventListener("click", function(e) {
    e.preventDefault();
    showFullscreenChart();
  });
  
  // Trend period buttons
  document.querySelectorAll(".trend-period").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".trend-period").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      updateTrendChart(this.dataset.period);
    });
  });
  
  // Theme toggle
  document.querySelector(".theme-toggle").addEventListener("click", toggleTheme);
  
  // Sidebar toggle for mobile
  document.querySelector(".sidebar-toggle").addEventListener("click", toggleSidebar);
  
  // Print button in modal
  document.getElementById("printDetails").addEventListener("click", printDetails);
  
  // Download chart button
  document.getElementById("downloadChart").addEventListener("click", downloadChart);
  
  // Map controls (placeholder functionality)
  document.getElementById("zoomInMap").addEventListener("click", () => showToast("Zoom in clicked", "info"));
  document.getElementById("zoomOutMap").addEventListener("click", () => showToast("Zoom out clicked", "info"));
  document.getElementById("resetMap").addEventListener("click", () => showToast("Map reset clicked", "info"));
}

// Load data from Google Sheets with fallback to mock data
function loadData() {
  document.body.classList.add("refreshing");
  
  // First try to load from Google Sheets
  fetch(SHEET_URL)
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.text();
    })
    .then(csv => {
      const parsed = Papa.parse(csv, { header: true });
      if (parsed.errors.length > 0) {
        throw new Error("Error parsing CSV data");
      }
      
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
      
      // Show success toast
      showToast('Data refreshed successfully from Google Sheets', 'success');
    })
    .catch(error => {
      console.error("Error loading data from Google Sheets:", error);
      
      // Fallback to mock data if Sheets fails
      useMockData();
      document.body.classList.remove("refreshing");
      showToast('Using mock data (Google Sheets unavailable)', 'warning');
    });
}

// Use mock data when Google Sheets is unavailable
function useMockData() {
  // Generate mock data with realistic structure
  const districts = ['District A', 'District B', 'District C', 'District D'];
  const mandals = ['Mandal 1', 'Mandal 2', 'Mandal 3', 'Mandal 4', 'Mandal 5'];
  const secretariats = ['Secretariat X', 'Secretariat Y', 'Secretariat Z'];
  
  previousData = rawData;
  rawData = [];
  
  // Generate 100 mock records
  for (let i = 0; i < 100; i++) {
    const district = districts[Math.floor(Math.random() * districts.length)];
    const mandal = mandals[Math.floor(Math.random() * mandals.length)];
    const secretariat = secretariats[Math.floor(Math.random() * secretariats.length)];
    
    rawData.push({
      ID: i + 1,
      District: district,
      Mandal: mandal,
      Secretariat: secretariat,
      Status: ['Pending', 'Approved', 'Rejected'][Math.floor(Math.random() * 3)],
      Date: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      timestamp: new Date().getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
    });
  }
  
  updateLastUpdated();
  initializeFilters();
  updateDashboard();
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
       type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : 
       type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
       '<i class="fas fa-info-circle"></i>'}
    </div>
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });
}

// Export data to CSV or Excel
function exportData() {
  const filteredData = filterData();
  if (filteredData.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }
  
  // Create CSV content
  const headers = Object.keys(filteredData[0]);
  const csvRows = [
    headers.join(','),
    ...filteredData.map(row => 
      headers.map(fieldName => 
        JSON.stringify(row[fieldName] || '')
      .join(','))
  ];
  
  const csvContent = csvRows.join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `analytics-export-${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Data exported successfully', 'success');
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
    <i class="fas fa-clock"></i>
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
  
  // Trigger select2 update if it exists
  if ($(select).hasClass('select2-hidden-accessible')) {
    $(select).trigger('change');
  }
}

// Reset all filters
function resetFilters() {
  document.getElementById("districtFilter").value = "";
  document.getElementById("mandalFilter").value = "";
  document.getElementById("secretariatFilter").value = "";
  dateRangeFilter.val('').trigger('change');
  
  // Trigger select2 update if it exists
  $('.searchable-select').trigger('change');
  
  onDistrictChange();
  
  // Show confirmation toast
  showToast('All filters have been reset', 'success');
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
    $(document.getElementById("mandalFilter")).trigger('change');
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
    $(document.getElementById("secretariatFilter")).trigger('change');
  }
  
  updateDashboard();
}

// Filter data based on current filters
function filterData() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  const secretariat = document.getElementById('secretariatFilter').value;
  const dateRange = dateRangeFilter.val();

  let filteredData = [...rawData];

  // Apply filters
  if (district) {
    filteredData = filteredData.filter(row => row.District === district);
  }
  
  if (mandal) {
    filteredData = filteredData.filter(row => row.Mandal === mandal);
  }
  
  if (secretariat) {
    filteredData = filteredData.filter(row => row.Secretariat === secretariat);
  }
  
  // Apply date range filter if set
  if (dateRange) {
    const dates = dateRange.split(' - ');
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[1]);
    
    // Assuming we have a 'Date' field in the data
    filteredData = filteredData.filter(row => {
      const rowDate = row.Date ? new Date(row.Date) : new Date(row.timestamp);
      return rowDate >= startDate && rowDate <= endDate;
    });
  }

  return filteredData;
}

// Group data by key and count occurrences
function groupByCount(data, key) {
  return data.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

// Update the main chart with filtered data
function updateMainChart(data) {
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

  if (mainChart) mainChart.destroy();

  const ctx = document.getElementById("mainChart").getContext("2d");
  
  // Common chart configuration
  const commonConfig = {
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: counts,
        backgroundColor: getChartColors(currentChartType, labels.length),
        borderColor: '#fff',
        borderWidth: currentChartType === 'pie' || currentChartType === 'doughnut' || currentChartType === 'polarArea' ? 1 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: (currentChartType === 'pie' || currentChartType === 'doughnut' || currentChartType === 'polarArea') ? 'right' : 'top',
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
          display: showDataLabels && (currentChartType === 'pie' || currentChartType === 'doughnut' || currentChartType === 'polarArea'),
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return percentage > 5 ? `${percentage}%` : '';
          },
          color: '#fff',
          font: {
            weight: 'bold'
          }
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'xy',
          },
          pan: {
            enabled: true,
            mode: 'xy',
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
      mainChart = new Chart(ctx, {
        type: 'pie',
        ...commonConfig,
        plugins: [ChartDataLabels]
      });
      break;
    case 'doughnut':
      mainChart = new Chart(ctx, {
        type: 'doughnut',
        ...commonConfig,
        plugins: [ChartDataLabels],
        options: {
          ...commonConfig.options,
          cutout: '70%'
        }
      });
      break;
    case 'polarArea':
      mainChart = new Chart(ctx, {
        type: 'polarArea',
        ...commonConfig,
        plugins: [ChartDataLabels]
      });
      break;
    case 'line':
      mainChart = new Chart(ctx, {
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
      mainChart = new Chart(ctx, {
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

// Update trend chart
function updateTrendChart(period = '7d') {
  const days = parseInt(period);
  const filteredData = filterData();
  
  // Group data by date (this is simplified - you'd need actual date fields in your data)
  const dateGroups = filteredData.reduce((acc, item) => {
    // This assumes you have a date field - adjust as needed for your data
    const date = item.Date ? new Date(item.Date).toLocaleDateString() : new Date(item.timestamp).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  
  const labels = Object.keys(dateGroups).sort();
  const counts = labels.map(date => dateGroups[date]);
  
  if (trendChart) trendChart.destroy();
  
  const ctx = document.getElementById("trendChart").getContext("2d");
  
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Applications Trend',
        data: counts,
        backgroundColor: 'rgba(78, 115, 223, 0.05)',
        borderColor: 'rgba(78, 115, 223, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(78, 115, 223, 1)',
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

// Generate colors for chart based on type
function getChartColors(type, count) {
  if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
    return generateColors(count, 0.7, 0.6);
  } else if (type === 'line') {
    return ['rgba(78, 115, 223, 1)'];
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
    ? `<i class="fas fa-equals"></i> <span>0%</span> vs last period`
    : change > 0 
      ? `<i class="fas fa-arrow-up"></i> <span>${Math.abs(changeValue)}%</span> vs last period`
      : `<i class="fas fa-arrow-down"></i> <span>${Math.abs(changeValue)}%</span> vs last period`;
  
  element.className = "stat-change";
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
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No data available for current filters</td></tr>';
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
      <td class="text-end">${row.Date ? new Date(row.Date).toLocaleDateString() : 'N/A'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary view-details" data-id="${row.ID}">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetailsModal(btn.dataset.id);
    });
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
        <h6 class="section-title">Basic Information</h6>
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
        <h6 class="section-title">Additional Details</h6>
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
    <div class="row mt-3">
      <div class="col-12">
        <h6 class="section-title">Timeline</h6>
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-point"></div>
            <div class="timeline-content">
              <h6>Application Submitted</h6>
              <p>${record.Date ? new Date(record.Date).toLocaleString() : 'Date not available'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('detailModal'));
  modal.show();
}

// Show fullscreen chart
function showFullscreenChart() {
  if (!mainChart) return;
  
  // Set modal title based on current chart type
  let title = '';
  switch (currentChartType) {
    case 'pie': title = 'Pie Chart'; break;
    case 'doughnut': title = 'Doughnut Chart'; break;
    case 'polarArea': title = 'Polar Area Chart'; break;
    case 'line': title = 'Line Chart'; break;
    default: title = 'Bar Chart';
  }
  
  document.getElementById('fullscreenChartTitle').textContent = title;
  
  // Create a copy of the chart in the modal
  const canvas = document.getElementById('fullscreenChartCanvas');
  const ctx = canvas.getContext('2d');
  
  if (fullscreenChart) fullscreenChart.destroy();
  
  fullscreenChart = new Chart(ctx, {
    type: mainChart.config.type,
    data: JSON.parse(JSON.stringify(mainChart.config.data)),
    options: JSON.parse(JSON.stringify(mainChart.config.options))
  });
  
  // Adjust options for fullscreen
  fullscreenChart.options.maintainAspectRatio = false;
  fullscreenChart.options.plugins.legend.position = 'top';
  fullscreenChart.update();
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('fullscreenChartModal'));
  modal.show();
}

// Download chart as image
function downloadChart() {
  if (!fullscreenChart) return;
  
  const link = document.createElement('a');
  link.download = `chart-${new Date().toISOString().slice(0,10)}.png`;
  link.href = document.getElementById('fullscreenChartCanvas').toDataURL('image/png');
  link.click();
}

// Print details
function printDetails() {
  window.print();
}

// Toggle dark/light theme
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
  
  // Recreate charts to update their theme
  updateDashboard();
  updateTrendChart();
}

// Toggle sidebar for mobile
function toggleSidebar() {
  document.querySelector(".sidebar").classList.toggle("active");
}

// Main dashboard update function
function updateDashboard() {
  const filtered = filterData();
  
  updateMainChart(filtered);
  updateTrendChart();
  updateMetrics(filtered);
  updateRecentTable(filtered);
  
  // Set active chart type button
  document.querySelector(`.chart-type[data-type="${currentChartType}"]`).classList.add("active");
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check for saved theme preference
  if (localStorage.getItem("theme") === "dark" || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add("dark-mode");
  }
  
  initDashboard();
});
