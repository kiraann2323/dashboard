const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SF/pub?gid=0&single=true&output=csv";

let data = [];
let charts = {};

async function fetchData() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const rows = text.trim().split("\n").map(row => row.split(","));
  const headers = rows.shift();
  data = rows.map(row => Object.fromEntries(row.map((val, i) => [headers[i], val])));
  populateFilters();
  updateDashboard();
}

function populateFilters() {
  const filters = ["District", "Mandal", "Secretariat", "Status"];
  filters.forEach(filter => {
    const select = document.getElementById(filter.toLowerCase() + "Filter");
    const values = [...new Set(data.map(item => item[filter]).filter(Boolean))].sort();
    values.forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    });
    select.addEventListener("change", updateDashboard);
  });
  document.getElementById("searchInput").addEventListener("input", updateDashboard);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
}

function filterData() {
  const filters = ["district", "mandal", "secretariat", "status"];
  return data.filter(row => {
    return filters.every(f => {
      const val = document.getElementById(f + "Filter").value;
      return !val || row[f.charAt(0).toUpperCase() + f.slice(1)] === val;
    });
  });
}

function updateDashboard() {
  const filtered = filterData();
  updateSummary(filtered);
  updateTable(filtered);
  updateCharts(filtered);
}

function updateSummary(filtered) {
  document.getElementById("totalCount").textContent = filtered.length;
  const pending = filtered.filter(r => r.Status === "Pending").length;
  document.getElementById("pendingCount").textContent = pending;
  const sla = filtered.map(r => parseInt(r["SLA Days"])).filter(n => !isNaN(n));
  const avg = sla.length ? (sla.reduce((a, b) => a + b) / sla.length).toFixed(1) : 0;
  document.getElementById("avgSLA").textContent = avg;
}

function updateTable(filtered) {
  const tbody = document.querySelector("#dataTable tbody");
  const search = document.getElementById("searchInput").value.toLowerCase();
  tbody.innerHTML = "";
  filtered
    .filter(r => r["Application No"].toLowerCase().includes(search))
    .forEach(row => {
      const tr = document.createElement("tr");
      ["Application No", "District", "Mandal", "Secretariat", "Status", "Department", "SLA Days", "Raised Date"].forEach(col => {
        const td = document.createElement("td");
        td.textContent = row[col];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
}

function updateCharts(filtered) {
  const barData = {};
  const pieData = {};
  const lineData = {};

  filtered.forEach(row => {
    barData[row.Mandal] = (barData[row.Mandal] || 0) + 1;
    pieData[row.Status] = (pieData[row.Status] || 0) + 1;
    const date = row["Raised Date"];
    lineData[date] = (lineData[date] || 0) + 1;
  });

  drawChart("barChart", "bar", barData);
  drawChart("pieChart", "pie", pieData);
  drawChart("lineChart", "line", lineData);
}

function drawChart(id, type, dataMap) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext("2d");
  charts[id] = new Chart(ctx, {
    type: type,
    data: {
      labels: Object.keys(dataMap),
      datasets: [{
        label: id,
        data: Object.values(dataMap),
        backgroundColor: type === "pie" ? generateColors(dataMap) : "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
        fill: type === "line" ? false : true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: type === "pie" } },
      scales: type === "bar" || type === "line" ? { y: { beginAtZero: true } } : {}
    }
  });
}

function generateColors(dataMap) {
  return Object.keys(dataMap).map((_, i) => `hsl(${i * 40 % 360}, 70%, 60%)`);
}

function exportCSV() {
  const rows = [["Application No", "District", "Mandal", "Secretariat", "Status", "Department", "SLA Days", "Raised Date"]];
  const filtered = filterData();
  filtered.forEach(row => {
    rows.push([
      row["Application No"], row["District"], row["Mandal"], row["Secretariat"],
      row["Status"], row["Department"], row["SLA Days"], row["Raised Date"]
    ]);
  });
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dashboard_data.csv";
  a.click();
}

fetchData();
