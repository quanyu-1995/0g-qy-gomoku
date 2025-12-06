import fs from 'fs'
import path from 'path'

// 合约编译后的 JSON 文件路径
const artifactPath = path.resolve(
  'artifacts/contracts/QyGomoku.sol/QyGomoku.json',
)

// 读取 JSON 文件
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))

// 将 ABI 写入到 abi.json
fs.writeFileSync('abi.json', JSON.stringify(artifact.abi, null, 2))

// console.log("ABI 已生成到 abi.json");
