<script src="https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<canvas id="myChart" width="600" height="400"></canvas>

<script>
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1onbXUKMf_BMG3QY_1THkNe8a0JB8zuFC1_eHK3fXAn0/edit?usp=sharing";

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
