// install: npm install fs
const fs = require('fs')
const path = require('path')

function jsonToCsv(jsonArray) {
  const header = ['follower_count']
  const rows = jsonArray.map(item => [
    item.follower_count,
  ])
  return [...rows].join('\n')
}

function convertFile(jsonFile, csvFile) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  const csv = jsonToCsv(data)
  fs.writeFileSync(csvFile, csv, 'utf8')
  // console.log(`✅ 已生成: ${csvFile}`);
}

// 需要转换的文件列表
const files = [
  { json: 'data_7d.json', csv: 'data_7d.csv' },
  { json: 'data_30d.json', csv: 'data_30d.csv' },
  { json: 'data_3m.json', csv: 'data_3m.csv' },
]

files.forEach(({ json, csv }) => {
  if (fs.existsSync(json))
    convertFile(json, csv)
  else
    console.warn(`⚠️ 文件不存在: ${json}`)
})
