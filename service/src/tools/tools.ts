import axios from 'axios'
import { Batcher, FixedPriceFlow__factory, Indexer, KvClient } from '@0glabs/0g-ts-sdk'
import { JsonRpcProvider, Wallet, ethers } from 'ethers'
import dotenv from 'dotenv'
dotenv.config()

// 合约地址和 ABI
const CONTRACT_ADDRESS = '0x51d37b7fC59a53E5b198e1B76050cC0E34f93781'
const CONTRACT_ABI = [
    'function depositPrizePool() external payable',
    'function stakePool() view returns (uint256)',
    'function withdrawPrizePool(uint amount) external',
    'function createGame(address agentAddress) payable returns (uint256)',

    'function getGames(uint256 page, uint256 pageSize, uint8 mode) view returns (tuple(uint256[] gameIds, uint256 totalCount, uint256 totalPages))',
    'function placeStone(uint256 _gameId, uint8 x, uint8 y)',
    'function getGame(uint256 _gameId) view returns (address creator, address joiner, uint256 stake, bool started, bool finished, address currentTurn, address winner)',
    'function getMyGame() view returns (uint256)',
    'function getBoardCell(uint256 gameId, uint8 x, uint8 y) view returns (uint8)',
    'function getBoard(uint256 gameId) view returns (uint8[][])',


    'event GameCreated(uint256 gameId, uint256 stake, address creator)',
    'event PlaceStone(uint256 indexed _gameId, address indexed player, uint8 x, uint8 y)',
    'event GameFinished(uint256 indexed _gameId, address winner)',
]

const RPC_URL = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai/'
const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai'
const KV_GATEWAY = process.env.KV_GATEWAY || 'http://3.101.147.150:6789'

// Provider 和 signer（替换成你本地或后端私钥）
const provider = new JsonRpcProvider(process.env.RPC_URL)
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider)
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, CONTRACT_ABI, wallet)
// indexer
const indexer = new Indexer(INDEXER_RPC)
// kv client
const kvClient = new KvClient(KV_GATEWAY)
// streamId 类似redis的database?
const STREAM_ID = process.env.STREAM_ID
const FLOW_CONTRACT = process.env.FLOW_CONTRACT

const flow = FixedPriceFlow__factory.connect(FLOW_CONTRACT!, wallet)


// 获取奖池信息
async function getStakePool() {
  const pool = await contract.stakePool()
  return {
    prizePoolEth: ethers.formatEther(pool),
    symbol: '0G',
  }
}

// 合约存入奖池
async function depositPrizePool(args: { amount: number }) {
  const { amount } = args

  const tx = await contract.depositPrizePool({
    value: ethers.parseEther(amount.toString()), // 转为 wei
  })

  const receipt = await tx.wait()

  return {
    success: true,
    txHash: receipt.transactionHash,
    deposited: amount,
    symbol: '0G',
  }
}

// 合约提现奖池
async function withdrawPrizePool(args: { amount: number }) {
  const amountInWei = ethers.parseEther(args.amount.toString())

  // 检查调用者是否是 owner
  const ownerAddress = await contract.owner()
  if (wallet.address.toLowerCase() !== ownerAddress.toLowerCase())
    throw new Error('Only owner can withdraw')

  const prizePool = await contract.prizePool()
  if (amountInWei > prizePool)
    throw new Error('Amount too big')

  const tx = await contract.withdrawPrizePool(amountInWei, { gasLimit: 30000000 })
  const receipt = await tx.wait()

  return {
    txHash: receipt.transactionHash,
    withdrawnAmount: args.amount,
    prizePoolAfter: ethers.formatEther(await contract.prizePool()),
  }
}

// 创建游戏
async function createGame(args: { stake: number, agentAddress: string }) {

  const { stake, agentAddress } = args

  const tx = await contract.createGame(agentAddress, {
    value: ethers.parseEther(stake.toString())
  })
  const receipt = await tx.wait()
  const event = receipt.events?.find((e: any) => e.event === 'GameCreated')
  const gameId = event?.args?.gameId.toString();
  const creator = event?.args?.gameId.toString();
  return {
    gameId: gameId,
    stake: stake,
    creator: creator
  };
} 

// 获取游戏列表
async function getGames(args: { page: number, pageSize: number, mode: number }) {
  const { page, pageSize, mode } = args
  const result = await contract.getGames(page, pageSize, mode)
  return {
    gameIds: result.gameIds.map((id: ethers.BigNumberish) => id.toString()),
    totalCount: result.totalCount.toString(),
    totalPages: result.totalPages.toString(),
  }
}

// 下棋
async function placeStone(args: { gameId: number, x: number, y: number }) {
  const { gameId, x, y } = args
  const tx = await contract.placeStone(gameId, x, y)
  const receipt = await tx.wait()
  return {
    success: true,
    txHash: receipt.transactionHash,
  }
}

// 获取游戏信息
async function getGame(args: { gameId: number }) {
  const { gameId } = args
  const result = await contract.getGame(gameId)
  return {
    creator: result.creator,
    joiner: result.joiner,
    stake: ethers.formatEther(result.stake),
    started: result.started,
    finished: result.finished,
    currentTurn: result.currentTurn,
    winner: result.winner,
  }
}

// 获取我的游戏
async function getMyGame() {
  const gameId = await contract.getMyGame()
  return {
    gameId: gameId.toString(),
  }
}

// 获取棋盘某个格子状态
async function getBoardCell(args: { gameId: number, x: number, y: number }) {
  const { gameId, x, y } = args
  const cellState = await contract.getBoardCell(gameId, x, y)
  return {
    cellState: cellState,
  }
}

// 获取整个棋盘状态
async function getBoard(args: { gameId: number }) {
  const { gameId } = args
  const board = await contract.getBoard(gameId)
  // 转换为二维数组
  const boardArray = board.map((row: ethers.BigNumberish[]) =>
    row.map((cell: ethers.BigNumberish) => cell)
  )
  return {
    board: boardArray,
  }
}

export const toolFunctions = {
  get_stake_pool: getStakePool,
  deposit_prize_pool: depositPrizePool,
  withdraw_prize_pool: withdrawPrizePool,
  create_game: createGame,
  get_gamesL: getGames,
  place_stone: placeStone,
  get_game: getGame,
  get_my_game: getMyGame,
  get_board_cell: getBoardCell,
  get_board: getBoard
}
