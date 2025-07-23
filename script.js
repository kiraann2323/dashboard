const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let rawData = [];
let chart = null;
let searchTimeout = null;

// Initialize dashboard
function initDashboard() {
  setupEventListeners();
  loadData();
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById("districtFilter").addEventListener("change", onDistrictChange);
  document.getElementById("mandalFilter").addEventListener("change", onMandalChange);
  document.getElementById("secretariatFilter").addEventListener("change", updateDashboard);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  
  // Search input with debounce
  document.getElementById("searchInput").addEventListener("input", function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch(e.target.value.trim());
    }, 300);
  });

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
async function loadData() {
  try {
    showLoading();
    
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const csv = await response.text();
    const parsed = Papa.parse(csv, { 
      header: true,
      skipEmptyLines: true,
      transform: (value) => value?.toString().trim() || ''
    });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('No valid data received');
    }

    rawData = parsed.data.map((item, index) => ({
      ...item,
      ID: index + 1,
      timestamp: new Date().getTime()
    }));

    updateLastUpdated();
    initializeFilters();
    updateDashboard();
    
  } catch (error) {
    console.error("Data loading failed:", error);
    showError("Failed to load data. Using sample data.");
    loadSampleData();
  } finally {
    hideLoading();
  }
}

// Handle search functionality
function handleSearch(searchTerm) {
  const resultsContainer = document.getElementById("searchResults");
  
  // Show loading state
  resultsContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;

  // Process in small chunks to prevent UI freeze
  setTimeout(() => {
    try {
      if (!searchTerm) {
        showSearchPlaceholder();
        return;
      }

      const results = rawData.filter(item => 
        Object.values(item).some(val => 
          val.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );

      displaySearchResults(results, searchTerm);
      
    } catch (error) {
      console.error("Search error:", error);
      resultsContainer.innerHTML = `
        <div class="alert alert-danger">
          Search failed: ${error.message}
        </div>
      `;
    }
  }, 50); // Small delay to allow UI to update
}

// Display search results
function displaySearchResults(results, searchTerm) {
  const resultsContainer = document.getElementById("searchResults");
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        <i class="bi bi-search"></i>
        <p>No results found for "${searchTerm}"</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>ID</th>
            <th>District</th>
            <th>Mandal</th>
            <th>Secretariat</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Limit to 100 results for performance
  results.slice(0, 100).forEach(item => {
    html += `
      <tr>
        <td>${item.ID || 'N/A'}</td>
        <td>${highlightMatch(item.District, searchTerm)}</td>
        <td>${highlightMatch(item.Mandal, searchTerm)}</td>
        <td>${highlightMatch(item.Secretariat, searchTerm)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      ${results.length > 100 ? `<p>Showing 100 of ${results.length} results</p>` : ''}
    </div>
  `;

  resultsContainer.innerHTML = html;
}

// Highlight search matches
function highlightMatch(text, searchTerm) {
  if (!text || !searchTerm) return text || 'N/A';
  
  const textStr = text.toString();
  const lowerText = textStr.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  
  const matchStart = lowerText.indexOf(lowerSearch);
  if (matchStart === -1) return textStr;
  
  const matchEnd = matchStart + searchTerm.length;
  
  return `
    ${textStr.substring(0, matchStart)}
    <span class="highlight">${textStr.substring(matchStart, matchEnd)}</span>
    ${textStr.substring(matchEnd)}
  `;
}

// Show loading state
function showLoading() {
  document.body.classList.add("loading");
}

// Hide loading state
function hideLoading() {
  document.body.classList.remove("loading");
}

// Show error message
function showError(message) {
  const alert = document.createElement("div");
  alert.className = "alert alert-danger position-fixed top-0 end-0 m-3";
  alert.style.zIndex = "1000";
  alert.textContent = message;
  document.body.appendChild(alert);
  
  setTimeout(() => alert.remove(), 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);

/* All your existing filter and chart functions remain the same */
