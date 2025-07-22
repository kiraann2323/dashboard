**script.js**
    javascript
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SF/pub?output=csv";

let rawData = [];

async function fetchData() {
    const response = await fetch(SHEET_URL);
    const data = await response.text();
    const rows = data.split("\n").map(r => r.split(","));
    const headers = rows[0];
    rawData = rows.slice(1).map(row => Object.fromEntries(row.map((val, i) => [headers[i], val])));
    populateFilters();
    renderAll();
}

function populateFilters() {
    populateDropdown("districtFilter", [...new Set(rawData.map(r => r["District"]))]);
    populateDropdown("mandalFilter", [...new Set(rawData.map(r => r["Mandal"]))]);
    populateDropdown("secretariatFilter", [...new Set(rawData.map(r => r["Secretariat"]))]);
    populateDropdown("statusFilter", [...new Set(rawData.map(r => r["Status"]))]);
}

function populateDropdown(id, options) {
    const dropdown = document.getElementById(id);
    options.sort().forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.text = opt;
        dropdown.appendChild(option);
    });
}

function getFilteredData() {
    const district = document.getElementById("districtFilter").value;
    const mandal = document.getElementById("mandalFilter").value;
    const secretariat = document.getElementById("secretariatFilter").value;
    const status = document.getElementById("statusFilter").value;
    return rawData.filter(r =>
        (!district || r["District"] === district) &&
        (!mandal || r["Mandal"] === mandal) &&
        (!secretariat || r["Secretariat"] === secretariat) &&
        (!status || r["Status"] === status)
    );
}

function renderAll() {
    const data = getFilteredData();
    renderSummary(data);
    renderCharts(data);
    renderTable(data);
}

function renderSummary(data) {
    const total = data.length;
    const pending = data.filter(r => r["Status"].includes("Pending")).length;
    const avgSLA = Math.round(data.reduce((acc, r) => acc + (parseInt(r["SLA Days"]) || 0), 0) / total || 0);
    document.getElementById("summary").innerText = `Total: ${total} | Pending: ${pending} | Avg SLA: ${avgSLA}`;
}

function renderCharts(data) {
    renderBarChart(data);
    renderLineChart(data);
    renderPieChart(data);
}

function renderBarChart(data) {
    const ctx = document.getElementById('barChart').getContext('2d');
    const counts = countBy(data, "Mandal");
    new Chart(ctx, { type: 'bar', data: { labels: Object.keys(counts), datasets: [{ label: "By Mandal", data: Object.values(counts), backgroundColor: "#4CAF50" }] } });
}

function renderLineChart(data) {
    const ctx = document.getElementById('lineChart').getContext('2d');
    const counts = countBy(data, "Raised Date");
    const sortedKeys = Object.keys(counts).sort();
    new Chart(ctx, { type: 'line', data: { labels: sortedKeys, datasets: [{ label: "Applications Over Time", data: sortedKeys.map(k => counts[k]), borderColor: "#2196F3", fill: false }] } });
}

function renderPieChart(data) {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const counts = countBy(data, "Status");
    new Chart(ctx, { type: 'pie', data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#F44336", "#FFC107", "#4CAF50"] }] } });
}

function countBy(data, key) {
    return data.reduce((acc, r) => {
        acc[r[key]] = (acc[r[key]] || 0) + 1;
        return acc;
    }, {});
}

function renderTable(data) {
    const table = document.getElementById("dataTable");
    const headers = Object.keys(data[0] || {});
    table.querySelector("thead").innerHTML = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    table.querySelector("tbody").innerHTML = data.map(row => "<tr>" + headers.map(h => `<td>${row[h]}</td>`).join("") + "</tr>").join("");
}

function exportTableToCSV() {
    const rows = [...document.querySelectorAll("#dataTable tr")];
    const csv = rows.map(row => [...row.children].map(cell => `"${cell.innerText}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dashboard_data.csv";
    link.click();
}

function resetFilters() {
    ["districtFilter", "mandalFilter", "secretariatFilter", "statusFilter"].forEach(id => document.getElementById(id).value = "");
    renderAll();
}

// Re-render on filter change
["districtFilter", "mandalFilter", "secretariatFilter", "statusFilter"].forEach(id => document.getElementById(id).addEventListener("change", renderAll));
document.getElementById("searchInput").addEventListener("keyup", function () {
    const value = this.value.toLowerCase();
    const rows = document.querySelectorAll("#dataTable tbody tr");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(value) ? "" : "none";
    });
});

fetchData();

