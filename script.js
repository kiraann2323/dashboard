fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQSE1BJj7v8U_RGXkX69arUql0J4SBlA5xyxW7uv17QeNmbuUmbpMtN8ZRTk8SFbdTpEFmzPWbgt_E1/pubhtml?gid=0&single=true')
  .then(res => res.text())
  .then(csv => {
    const rows = csv.split('\n').map(r => r.split(','));
    console.log(rows); // Use this to build charts or tables
  });
