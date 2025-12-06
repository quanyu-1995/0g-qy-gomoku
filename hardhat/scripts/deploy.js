import hardhat from 'hardhat'
const { ethers } = hardhat

async function main() {
  process.stdout.write('Start deploying contract...' + '\n')

  const QyGomoku = await ethers.getContractFactory('QyGomoku')
  const rps = await QyGomoku.deploy()
  await rps.deployed()

  process.stdout.write(`Contract deployed to: ${rps.address}\n`)
  // console.log("Contract deployed to:", rps.address);
}

main()
  .then(() => process.stdout.write('Deployment finished' + '\n'))
  .catch((error) => {
    process.stdout.write(`Deployment failed: ${error.message}\n`)
    process.exit(1)
  })
