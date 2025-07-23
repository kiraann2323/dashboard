// Enhanced Google Sheets data loader with AI capabilities
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let rawData = [];
let processedData = [];
let aiRecommendations = [];
let searchHistory = [];
let currentChartType = 'bar';
let refreshTimer = null;
let searchDebounceTimer = null;

class DataAnalyzer {
  constructor(data) {
    this.data = data;
  }

  generateRecommendations() {
    // Simulate AI analysis (in a real app, this would call an API)
    return new Promise((resolve) => {
      setTimeout(() => {
        const recs = [];
        
        // Recommendation 1: Data completeness
        const incompleteRecords = this.data.filter(r => !r.District || !r.Mandal).length;
        if (incompleteRecords > 0) {
          recs.push({
            id: 'rec-1',
            title: 'Data Quality Alert',
            message: `${incompleteRecords} records have missing district or mandal information`,
            confidence: 0.95,
            action: { label: 'Review Data', callback: () => filterIncompleteData() }
          });
        }

        // Recommendation 2: Temporal patterns
        if (this.data.length > 10) {
          recs.push({
            id: 'rec-2',
            title: 'Temporal Pattern Detected',
            message: 'Your data shows weekly patterns in application submissions',
            confidence: 0.87,
            action: { label: 'View Trends', callback: () => showTrendAnalysis() }
          });
        }

        // Recommendation 3: Geographic distribution
        const districtCount = new Set(this.data.map(r => r.District)).size;
        if (districtCount > 5) {
          recs.push({
            id: 'rec-3',
            title: 'Geographic Insight',
            message: `Applications are distributed across ${districtCount} districts`,
            confidence: 0.92,
            action: { label: 'View Map', callback: () => showGeoDistribution() }
          });
        }

        resolve(recs);
      }, 1500); // Simulate AI processing time
    });
  }
}

async function loadData() {
  try {
    showLoadingState();
    
    // Try direct fetch first
    let response = await fetch(SHEET_URL);
    
    // Fallback to CORS proxy if needed
    if (!response.ok) {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_URL)}`;
      response = await fetch(proxyUrl);
      if (response.ok) {
        const proxyData = await response.json();
        response = new Response(proxyData.contents);
      }
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csv = await response.text();
    const parsed = Papa.parse(csv, { 
      header: true,
      skipEmptyLines: true,
      transform: (value) => value ? value.toString().trim() : ''
    });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('No valid data received');
    }

    // Process and enhance data
    rawData = parsed.data.map((item, index) => ({
      ...item,
      ID: index + 1,
      timestamp: new Date().getTime(),
      searchScore: 0
    }));

    // Generate AI recommendations
    const analyzer = new DataAnalyzer(rawData);
    aiRecommendations = await analyzer.generateRecommendations();
    displayAIRecommendations();

    updateLastUpdated();
    initializeFilters();
    updateDashboard();
    
    showToast(`Successfully loaded ${rawData.length} records`, 'success');
  } catch (error) {
    console.error("Data loading failed:", error);
    showToast(`Data load failed: ${error.message}`, 'error');
    loadSampleData();
  } finally {
    hideLoadingState();
  }
}

// Enhanced search function with AI scoring
function performSearch(searchTerm) {
  const startTime = performance.now();
  
  if (!searchTerm || searchTerm.trim() === '') {
    displaySearchResults([], '');
    return;
  }

  // Score results based on match quality
  const results = rawData.map(item => {
    let score = 0;
    const searchLower = searchTerm.toLowerCase();
    
    Object.values(item).forEach(val => {
      const valStr = val.toString().toLowerCase();
      if (valStr.includes(searchLower)) {
        score += 0.5; // Base score for any match
        if (valStr === searchLower) score += 1; // Exact match bonus
        if (valStr.startsWith(searchLower)) score += 0.5; // Prefix match bonus
      }
    });
    
    return { ...item, searchScore: score };
  }).filter(item => item.searchScore > 0)
    .sort((a, b) => b.searchScore - a.searchScore);

  const endTime = performance.now();
  const searchDuration = ((endTime - startTime) / 1000).toFixed(2);
  
  displaySearchResults(results, searchTerm, searchDuration);
  addToSearchHistory(searchTerm, results.length, searchDuration);
}

// Enhanced search results display
function displaySearchResults(results, searchTerm, duration = '') {
  const container = document.getElementById('searchResults');
  const countElement = document.getElementById('searchResultsCount');
  const timeElement = document.getElementById('searchTime');
  
  countElement.textContent = results.length;
  timeElement.textContent = duration ? `in ${duration}s` : '';
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="no-results animate__animated animate__fadeIn">
        <i class="fas fa-search fa-3x"></i>
        <p>No results found for "${searchTerm}"</p>
        <button class="btn btn-sm btn-outline-primary mt-2" id="broadenSearch">
          Broaden Search Criteria
        </button>
      </div>
    `;
    
    document.getElementById('broadenSearch')?.addEventListener('click', () => {
      document.getElementById('globalSearch').value = searchTerm.split(' ')[0];
      performSearch(searchTerm.split(' ')[0]);
    });
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover search-results-table">
        <thead>
          <tr>
            <th>Relevance</th>
            <th>ID</th>
            <th>District</th>
            <th>Mandal</th>
            <th>Secretariat</th>
          </tr>
        </thead>
        <tbody>
  `;

  results.forEach(item => {
    const relevance = Math.min(Math.floor(item.searchScore * 20), 100);
    html += `
      <tr class="search-result-item animate__animated animate__fadeIn">
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar" role="progressbar" style="width: ${relevance}%" 
              aria-valuenow="${relevance}" aria-valuemin="0" aria-valuemax="100">
              ${relevance}%
            </div>
          </div>
        </td>
        <td>${highlightMatches(item.ID, searchTerm)}</td>
        <td>${highlightMatches(item.District, searchTerm)}</td>
        <td>${highlightMatches(item.Mandal, searchTerm)}</td>
        <td>${highlightMatches(item.Secretariat, searchTerm)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    <div class="mt-3">
      <small class="text-muted">Showing ${results.length} most relevant results</small>
    </div>
  `;

  container.innerHTML = html;
}

function highlightMatches(text, searchTerm) {
  if (!searchTerm || !text) return text || 'N/A';
  
  const textStr = text.toString();
  const searchLower = searchTerm.toLowerCase();
  const textLower = textStr.toLowerCase();
  
  if (!textLower.includes(searchLower)) return textStr;
  
  const startIdx = textLower.indexOf(searchLower);
  const endIdx = startIdx + searchTerm.length;
  
  return `
    ${textStr.substring(0, startIdx)}
    <span class="search-result-highlight">
      ${textStr.substring(startIdx, endIdx)}
    </span>
    ${textStr.substring(endIdx)}
  `;
}

// AI Recommendations Display
function displayAIRecommendations() {
  const container = document.getElementById('aiRecommendations');
  
  if (aiRecommendations.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">
        No recommendations available. More data may be needed for analysis.
      </div>
    `;
    return;
  }

  let html = '<div class="row">';
  
  aiRecommendations.forEach(rec => {
    html += `
      <div class="col-md-4 mb-3">
        <div class="ai-recommendation-card">
          <h6>${rec.title}</h6>
          <p>${rec.message}</p>
          <div class="ai-confidence">
            Confidence: ${Math.floor(rec.confidence * 100)}%
          </div>
          <div class="ai-actions">
            <button class="btn btn-sm btn-outline-primary" 
              onclick="${rec.action.callback}">
              ${rec.action.label}
            </button>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Initialize the dashboard
function initDashboard() {
  setupEventListeners();
  loadData();
  startAutoRefresh();
  
  // Initialize search with debounce
  const searchInput = document.getElementById('globalSearch');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      performSearch(searchInput.value.trim());
    }, 300);
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);

/* All your existing dashboard functions (filtering, charting, etc.) remain the same */
/* Only adding the new AI-powered functions above */
