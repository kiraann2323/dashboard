<script>
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SF/pub?output=csv';

let rawData = [];
let filteredData = [];

fetch(SHEET_CSV_URL)
  .then(res => res.text())
  .then(csv => {
    Papa.parse(csv, {
      header: true,
      complete: (results) => {
        rawData = results.data;
        populateFilters();
        applyFilters();
      }
    });
  });

function populateFilters() {
  populateSelect('districtFilter', getUnique('District'));
  populateSelect('mandalFilter', getUnique('Mandal'));
  populateSelect('secretariatFilter', getUnique('Secretariat'));
  populateSelect('statusFilter', getUnique('Status'));
}

function populateSelect(id, items) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">All</option>' + items.map(v => `<option>${v}</option>`).join('');
}

function getUnique(field) {
  return [...new Set(rawData.map(row => row[field]).filter(Boolean))];
}

function applyFilters() {
  const district = document.getElementById('districtFilter').value;
  const mandal = document.getElementById('mandalFilter').value;
  const sec = document.getElementById('secretariatFilter').value;
  const status = document.getElementById('statusFilter').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;

  filteredData = rawData.filter(row => {
    if (district && row.District !== district) return false;
    if (mandal && row.Mandal !== mandal) return false;
    if (sec && row.Secretariat !== sec) return false;
    if (status && row.Status !== status) return false;
    if (fromDate && row['Raised Date'] < fromDate) return false;
    if (toDate && row['Raised Date'] > toDate) return false;
    return true;
  });

  updateSummary();
  drawCharts();
  populateTable();
}

function updateSummary() {
  const total = filteredData.length;
  const pending = filteredData.filter(r => r.Status === 'Pending').length;
  const avgSLA = Math.round(filteredData.reduce((a, b) => a + Number(b['SLA Days'] || 0), 0) / total || 0);
  document.getElementById('summary').textContent = `Total: ${total} | Pending: ${pending} | Avg SLA Days: ${avgSLA}`;
}

function drawCharts() {
  const statusCount = countBy(filteredData, 'Status');
  const mandalCount = countBy(filteredData, 'Mandal');

  drawChart('statusChart', 'Status Breakdown', Object.keys(statusCount), Object.values(statusCount));
  drawChart('mandalChart', 'Applications per Mandal', Object.keys(mandalCount), Object.values(mandalCount));
}

function drawChart(canvasId, title, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (window[canvasId]) window[canvasId].destroy();
  window[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: title, data, backgroundColor: 'steelblue' }] },
    options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: title } } }
  });
}

function countBy(data, field) {
  return data.reduce((acc, row) => {
    acc[row[field]] = (acc[row[field]] || 0) + 1;
    return acc;
  }, {});
}

function populateTable() {
  const table = document.getElementById('dataTable');
  const fields = Object.keys(filteredData[0] || {});
  table.querySelector('thead').innerHTML = '<tr>' + fields.map(f => `<th>${f}</th>`).join('') + '</tr>';
  table.querySelector('tbody').innerHTML = filteredData.map(row => '<tr>' + fields.map(f => `<td>${row[f]}</td>`).join('') + '</tr>').join('');
}

function resetFilters() {
  document.querySelectorAll('#controls select, #controls input').forEach(el => el.value = '');
  applyFilters();
}

function exportTableToCSV() {
  const csv = Papa.unparse(filteredData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'dashboard_data.csv';
  link.click();
}

// Re-filter on change
['districtFilter','mandalFilter','secretariatFilter','statusFilter','fromDate','toDate']
  .forEach(id => document.getElementById(id).addEventListener('change', applyFilters));
</script>
