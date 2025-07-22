<script src="https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<canvas id="myChart" width="600" height="400"></canvas>

<script>
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pub?gid=0&single=true&output=csv";

fetch(SHEET_URL)
  .then(response => response.text())
  .then(csvText => {
    const parsed = Papa.parse(csvText, { header: true });
    const data = parsed.data;

    const labels = [];
    const values = [];

    data.forEach(row => {
      if(row['District'] && row['SLA Days']) {  // Adjust field names as per your CSV header
        labels.push(row['District']);
        values.push(Number(row['SLA Days']) || 0);
      }
    });

    new Chart(document.getElementById('myChart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'SLA Days by District',
          data: values,
          backgroundColor: '#4CAF50'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  });
</script>
