const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SF/pub?output=csv';

let fullData = [];

fetch(sheetURL)
  .then(response => response.text())
  .then(csv => {
    const parsed = Papa.parse(csv, { header: true });
    fullData = parsed.data;
    populateFilters(fullData);
    updateCharts(fullData);
    updateTable(fullData);
    updateSummary(fullData);
  });

function populateFilters(data) {
  const districtSet = new Set();
  const mandalSet = new Set();
  const secretariatSet = new Set();
  const statusSet = new Set();

  data.forEach(row => {
    districtSet.add(row["District"]);
    mandalSet.add(row["Mandal"]);
    secretariatSet.add(row["Secretariat"]);
    statusSet.add(row["Status"]);
  });

  setOptions("districtFilter", [...districtSet]);
  setOptions("mandalFilter", [...mandalSet]);
  setOptions("secretariatFilter", [...secretariatSet]);
  setOptions("statusFilter", [...statusSet]);
}

function setOptions(id, options) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">All</option>';
  options.sort().forEach(val => {
    if (val) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      select.appendChild(opt);
    }
  });
  select.addEventListener("change", applyFilters);
}

function applyFilters() {
  let data = [...fullData];
  const filters = {
    District: document.getElementById("districtFilter").value,
    Mandal: document.getElementById("mandalFilter").value,
    Secretariat: document.getElementById("secretariatFilter").value,
    Status: document.getElementById("statusFilter").value
  };

  Object.entries(filters).forEach(([key, val]) => {
    if (val) data = data.filter(row => row[key] === val);
  });

  updateCharts(data);
  updateTable(data);
  updateSummary(data);
}

function updateSummary(data) {
  const total = data.length;
  const pending = data.filter(row => row["Status"] === "Pending").length;
  const avgSLA = Math.round(data.reduce((sum, r) => sum + (parseInt(r["SLA Days"]) || 0), 0) / total);

  document.getElementById("summaryBox").innerHTML = `
    <p>🗃️ Total Applications: <strong>${total}</strong></p>
    <p>⏳ Pending: <strong>${pending}</strong></p>
    <p>📅 Avg SLA Days: <strong>${avgSLA || 0}</strong></p>
  `;
}

function updateCharts(data) {
  const mandalCount = {};
  const statusCount = {};
  const dateSeries = {};

  data.forEach(row => {
    const m = row["Mandal"];
    const s = row["Status"];
    const date = row["Raised Date"];

    mandalCount[m] = (mandalCount[m] || 0) + 1;
    statusCount[s] = (statusCount[s] || 0) + 1;
    dateSeries[date] = (dateSeries[date] || 0) + 1;
  });

  renderChart("barChart", "Applications by Mandal", Object.keys(mandalCount), Object.values(mandalCount), 'bar');
  renderChart("pieChart", "Status Breakdown", Object.keys(statusCount), Object.values(statusCount), 'pie');
  renderChart("lineChart", "Applications Over Time", Object.keys(dateSeries), Object.values(dateSeries), 'line');
}

function renderChart(id, label, labels, data, type) {
  const ctx = document.getElementById(id).getContext("2d");
  if (window[id]) window[id].destroy();
  window[id] = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function updateTable(data) {
  const thead = document.querySelector("#dataTable thead");
  const tbody = document.querySelector("#dataTable tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!data.length) return;

  const headers = Object.keys(data[0]);
  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

  data.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = row[h];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

document.getElementById("searchInput").addEventListener("keyup", function () {
  const q = this.value.toLowerCase();
  const rows = document.querySelectorAll("#dataTable tbody tr");
  rows.forEach(row => {
    const txt = row.innerText.toLowerCase();
    row.style.display = txt.includes(q) ? "" : "none";
  });
});

function exportCSV() {
  let csv = Papa.unparse(fullData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "dashboard_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
