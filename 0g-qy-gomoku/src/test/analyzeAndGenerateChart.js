const fs = require('fs')
const path = require('path')

function readCSVNoDeps(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  return lines.map(line => ({ follower_count: line.trim() }))
}

function analyzeFollowers(data) {
  const followers = data
    .map(d => parseInt(d.follower_count))
    .filter(n => !isNaN(n))

  const max = Math.max(...followers)
  const min = Math.min(...followers)
  // 统计小于3000粉丝的人数
  const lessThan3000Count = followers.filter(f => f < 3000).length

  const fixedRanges = [
    { name: '0-1000', min: 0, max: 1000, count: 0 },
    { name: '1000-2000', min: 1000, max: 2000, count: 0 },
    { name: '2000-3000', min: 2000, max: 3000, count: 0 },
    { name: '3000-5000', min: 3000, max: 5000, count: 0 },
    { name: '5000-10000', min: 5000, max: 10000, count: 0 },
    { name: '10000-20000', min: 10000, max: 20000, count: 0 },
    { name: '20000-50000', min: 20000, max: 50000, count: 0 },
    { name: '>50000', min: 50000, max: Infinity, count: 0 },
  ]

  followers.forEach((f) => {
    for (const r of fixedRanges) {
      if (f >= r.min && f < r.max) {
        r.count++
        break
      }
    }
  })

  const total = followers.length
  fixedRanges.forEach((r) => {
    r.percent = total === 0 ? 0 : ((r.count / total) * 100).toFixed(2)
  })

  // 这里柱状图直接用 fixedRanges 的区间和 count，避免动态区间不匹配问题
  const histogram = fixedRanges.map(r => ({ range: r.name, count: r.count }))

  return { max, min, lessThan3000Count, ranges: fixedRanges, histogram }
}

function generateHTML(stats3m, stats7d, stats30d) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>粉丝数分布对比</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1080px; margin: 20px auto; }
    h1 { text-align: center; margin-bottom: 0px; }

    .chart-group {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px 10px;
      margin-bottom: 20px;
    }

    .chart-container {
      flex: 1 1 48%;
      box-sizing: border-box;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 6px;
      background: #fafafa;
    }

    .charts-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    canvas {
      display: block;
      margin: 0 auto;
    }

    .pie-chart {
      width: 250px !important;
      height: 250px !important;
    }

    .bar-chart {
      width: 350px !important;
      height: 180px !important;
    }
  </style>
</head>
<body>
  <h1>粉丝数分布对比（3个月 vs 7天 vs 30天）</h1>

  <div class="chart-group">
  ${['7天', '30天', '3个月'].map((label, i) => {
    const stats = [stats3m, stats7d, stats30d][i]
    return `
    <div class="chart-container">
      <h2>0G ${label}榜占比 (最少粉丝数: ${stats.min}，粉丝数小于3000人数: ${stats.lessThan3000Count})</h2>
      <div class="charts-row">
        <canvas id="pieChart${i}" class="pie-chart"></canvas>
        <canvas id="barChart${i}" class="bar-chart"></canvas>
      </div>
    </div>`
  }).join('')}
  </div>

<script>
  const statsArr = ${JSON.stringify([stats3m, stats7d, stats30d])};

  statsArr.forEach((stats, idx) => {
    const pieCtx = document.getElementById('pieChart' + idx).getContext('2d');
    const barCtx = document.getElementById('barChart' + idx).getContext('2d');

    new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: stats.ranges.map(r => r.name),
        datasets: [{
          label: '占比 (%)',
          data: stats.ranges.map(r => r.percent),
          backgroundColor: ['#e6194b', 
          '#3cb44b',
          '#ffe119',
          '#4363d8', 
          '#f58231', 
          '#911eb4', 
          '#46f0f0', 
          '#f032e6' ]
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            position: 'right',
            align: 'center',
            labels: {
              boxWidth: 12,
              padding: 6,
              usePointStyle: true,
            }
          }
        }
      }
    });

    new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: stats.histogram.map(h => h.range),
          datasets: [{
            label: '数量',
            data: stats.histogram.map(h => h.count),
            backgroundColor: '#36A2EB'
          }]
        },
        options: {
          responsive: false,
          scales: { y: { beginAtZero: true } },
          plugins: {
            datalabels: {
              anchor: 'end', // 标签位置：柱顶端
              align: 'top',  // 标签对齐方式：顶部
              font: {
                weight: 'bold',
                size: 12
              },
              color: '#000',
              formatter: function(value) {
                return value;  // 显示数据值
              }
            }
          }
        },
        plugins: [ChartDataLabels]  // 引用插件
      });
  });
</script>
</body>
</html>
  `
}

function main() {
  const basePath = __dirname

  const data3m = readCSVNoDeps(path.join(basePath, 'data_3m.csv'))
  const data7d = readCSVNoDeps(path.join(basePath, 'data_7d.csv'))
  const data30d = readCSVNoDeps(path.join(basePath, 'data_30d.csv'))

  const stats7d = analyzeFollowers(data7d)
  const stats30d = analyzeFollowers(data30d)
  const stats3m = analyzeFollowers(data3m)

  const html = generateHTML(stats7d, stats30d, stats3m)
  const outputPath = path.join(basePath, 'chart.html')
  fs.writeFileSync(outputPath, html, 'utf-8')
  // console.log(`图表生成成功，打开 ${outputPath} 查看结果！`);
}

main()
