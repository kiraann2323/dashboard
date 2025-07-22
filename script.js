// Your Google Sheets CSV export link
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";

fetch(SHEET_URL)
  .then(response => response.text())
  .then(csv => {
    const rows = csv.split("\n").map(r => r.split(","));
    const labels = [];
    const values = [];

    // Assuming first row is header, skip it
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] && row[1]) {
        labels.push(row[0]);
        values.push(Number(row[1]));
      }
    }

    new Chart(document.getElementById("myChart"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Sample Data",
          data: values,
          backgroundColor: "#4CAF50"
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  });
