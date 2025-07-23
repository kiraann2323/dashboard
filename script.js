const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let rawData = [];
let chart = null;
let searchTimeout = null;

function getUniqueSortedValues(data, key) {
  return [...new Set(data.map(item => item[key]).filter(Boolean))].sort();
}

function populateDropdown(id, values, enable = true) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">All</option>';
  values.forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val;
    select.appendChild(option);
  });
  select.disabled = !enable;
}

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

function groupByCount(data, key) {
  return data.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function updateChart(data) {
  const secretariatSelected = document.getElementById('secretariatFilter').value;
  const mandalSelected = document.getElementById('mandalFilter').value;

  const groupKey = secretariatSelected ? "Secretariat" : "Mandal";

  const grouped = groupByCount(data, groupKey);
  const labels = Object.keys(grouped);
  const counts = Object.values(grouped);

  if (chart) chart.destroy();

  const ctx = document.getElementById("chart").getContext("2d");
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: `Applications by ${groupKey}`,
        data: counts,
        backgroundColor: "#4CAF50"
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `Applications: ${context.raw}`
          }
        }
      }
    }
  });
}

function updateDashboard() {
  const filtered = filterData();
  updateChart(filtered);
  document.getElementById("summary").textContent = `Total Applications: ${filtered.length}`;
}

function onDistrictChange() {
  const district = document.getElementById('districtFilter').value;
  const mandals = getUniqueSortedValues(
    rawData.filter(r => !district || r.District === district),
    "Mandal"
  );
  populateDropdown("mandalFilter", mandals);

  const secretariats = getUniqueSortedValues(
    rawData.filter(r => !district || r.District === district),
    "Secretariat"
  );
  populateDropdown("secretariatFilter", secretariats);

  updateDashboard();
}

function onMandalChange() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;

  const secretariats = getUniqueSortedValues(
    rawData.filter(r =>
      (!district || r.District === district) &&
      (!mandal || r.Mandal === mandal)
    ),
    "Secretariat"
  );
  populateDropdown("secretariatFilter", secretariats);

  updateDashboard();
}

function handleSearch(searchTerm) {
  // Clear previous timeout if exists
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Show loading state
  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Searching for "${searchTerm}"...</p>
    </div>
  `;

  // Delay search to avoid too many requests
  searchTimeout = setTimeout(() => {
    try {
      if (!searchTerm || searchTerm.trim() === '') {
        searchResults.innerHTML = `
          <div class="search-placeholder">
            <i class="bi bi-search"></i>
            <p>Enter a search term to begin</p>
          </div>
        `;
        return;
      }

      const results = rawData.filter(item => 
        Object.values(item).some(val => 
          val.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      if (results.length > 0) {
        const tableHtml = `
          <table class="table table-hover search-results-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>District</th>
                <th>Mandal</th>
                <th>Secretariat</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(item => `
                <tr>
                  <td>${item.ID || 'N/A'}</td>
                  <td>${item.District || 'Unknown'}</td>
                  <td>${item.Mandal || 'Unknown'}</td>
                  <td>${item.Secretariat || 'Unknown'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        searchResults.innerHTML = tableHtml;
      } else {
        searchResults.innerHTML = `
          <div class="no-results">
            <i class="bi bi-search"></i>
            <p>No results found for "${searchTerm}"</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("Search error:", error);
      searchResults.innerHTML = `
        <div class="alert alert-danger">
          Error performing search. Please try again.
        </div>
      `;
    }
  }, 500); // 500ms delay for better UX
}

document.getElementById("districtFilter").addEventListener("change", onDistrictChange);
document.getElementById("mandalFilter").addEventListener("change", onMandalChange);
document.getElementById("secretariatFilter").addEventListener("change", updateDashboard);
document.getElementById("resetFilters").addEventListener("click", function() {
  document.getElementById("districtFilter").value = "";
  document.getElementById("mandalFilter").value = "";
  document.getElementById("secretariatFilter").value = "";
  onDistrictChange();
});

// Initialize search functionality
document.getElementById("searchInput").addEventListener("input", function(e) {
  handleSearch(e.target.value);
});

fetch(SHEET_URL)
  .then(res => res.text())
  .then(csv => {
    const parsed = Papa.parse(csv, { header: true });
    rawData = parsed.data
      .filter(r => r.District) // avoid empty rows
      .map((item, index) => ({
        ...item,
        ID: index + 1 // Add sequential ID
      }));
    
    const districts = getUniqueSortedValues(rawData, "District");
    populateDropdown("districtFilter", districts);

    updateDashboard();
  })
  .catch(error => {
    console.error("Error loading data:", error);
    document.getElementById("searchResults").innerHTML = `
      <div class="alert alert-danger">
        Failed to load data. Please refresh the page.
      </div>
    `;
  });
