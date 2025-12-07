import { JsonRpcProvider, Wallet, ethers, parseEther } from 'ethers'
// @ts-expect-error xxx
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import { tools } from '../tools/toolSchemas'

export const getWalletFromEnv = (): Wallet => {
  const provider = new JsonRpcProvider(process.env.RPC_URL!)
  const wallet = new Wallet(process.env.PRIVATE_KEY!, provider)
  return wallet
}

// 管理帐户
// 在使用提供商的服务之前，您需要为所选提供商创建一个专属账户。提供商会在响应请求之前检查账户余额。如果余额不足，请求将被拒绝。
// 1. 创建账户
export const fundBroker = async (signer: Wallet, amountOG: number) => {
  const broker = await createZGComputeNetworkBroker(signer)
  await broker.ledger.addLedger(amountOG) // 输入多少个0g就行 //addLedger：在合约中创建一个新的账户并存入。 depositFund：往已有账户存入
  // console.log(`💸 已存入 : ${amountOG} OG`);
}

export const getBrokerBalance = async (signer: Wallet): Promise<string> => {
  const broker = await createZGComputeNetworkBroker(signer)
  try {
    const account = await broker.ledger.getLedger()
    // console.log('account', account)
    const [balance, locked] = account;
    console.log(`
      Balance: ${ethers.formatEther(balance)} OG
      Locked: ${ethers.formatEther(locked)} OG
    `);
    return ethers.formatEther(balance?.[0] ?? 0)
  }
  catch (e: any) {
    const reason = e?.revert?.name || e?.error?.data || e?.shortMessage
    if (reason?.includes('LedgerNotExists')) {
      // console.warn('💰 账户不存在')
      return '0'
    }
    throw e
  }
}

/**
 * 'listService' retrieves a list of services from the contract.
 *
 * @returns {Promise<ServiceStructOutput[]>} A promise that resolves to an array of ServiceStructOutput objects.
 * @throws An error if the service list cannot be retrieved.
 *
 * type ServiceStructOutput = {
 *   provider: string;  // 提供服务的地址,Address of the provider
 *   serviceType: string;
 *   url: string;
 *   inputPrice: bigint;
 *   outputPrice: bigint;
 *   updatedAt: bigint;
 *   model: string;
 *   verifiability: string; // 结果是否可以验证，例如 'TeeML' 表示用可信执行环境（TEE）验证，空字符串表示没有验证
 *   additionalInfo: string // 额外信息，目前是用来存储提供者的加密密钥，也可以扩展其他信息
 * };
 */

export const getAvailableModels = async (signer: Wallet) => {
  console.log('Fetching available models from 0G Compute Network...', signer)
  const broker = await createZGComputeNetworkBroker(signer)
  try {
    const services = await broker.inference.listService()
    console.log('Fetched services:', services)
    return services
  }
  catch (e) {
    console.error('Error fetching broker ledger account:', e)
  }
}

// inputParam  是提示词（是和ai对话输入的内容）模型是无状态的,所以要带上history也就是是上下文
export const askLLM = async (
  signer: Wallet,
  providerAddress: string,
  inputParam: string,
  history: { role: 'system' | 'user' | 'assistant'; content: string }[] = [],
) => {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [...history, { role: 'user', content: inputParam }]
  const broker = await createZGComputeNetworkBroker(signer)
  const account = await broker.ledger.getLedger()
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
  await broker.inference.acknowledgeProviderSigner(providerAddress)
  const jsonString = JSON.stringify(messages)
  const paddedJsonString = jsonString.repeat(3) // 字符串变大 3 倍
  const headers = await broker.inference.getRequestHeaders(providerAddress, jsonString)
  // console.log('headers', headers)
  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: '',
  })
  console.log('--------------------------------------------------')
  console.log('tools', tools)
  console.log('providerAddress', providerAddress)
  console.log('history:', history)
  console.log('messages', messages)
  console.log('--------------------------------------------------')
  const stream = await openai.chat.completions.create(
    {
      messages,
      model,
      stream: true,
      tool_choice: 'auto',
      tools,
      temperature: 0.1,
      top_p: 1,
    },
    {
      headers: {
        ...headers,
      },
    },
  )
  // //console.log('completion', completion)
  // const chatID = completion.id;
  // const content = completion.choices?.[0]?.message?.content ?? '';
  // const verified = await broker.inference.processResponse(providerAddress, content, chatID);
  // //console.log('json', completion)
  // return {
  //   ...completion,
  //   text: content,
  //   verified,
  //   history: [...messages, { role: 'assistant', content }],
  // };
  // console.log('stream', stream)
  return { stream, broker, providerAddress }
}

export const askLLM2 = async (
  signer: Wallet,
  providerAddress: string,
  inputParam: string,
  history: { role: 'system' | 'user' | 'assistant'; content: string }[] = [],
) => {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [...history, { role: 'user', content: inputParam }]
  const broker = await createZGComputeNetworkBroker(signer)

  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
  await broker.inference.acknowledgeProviderSigner(providerAddress)
  const headers = await broker.inference.getRequestHeaders(providerAddress, JSON.stringify(messages))

  // console.log('headers', headers)

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  })

  const json = await res.json() as {
    id?: string
    choices?: { message?: { content?: string } }[]
  }
  // console.log('json', json)
  const content = json.choices?.[0]?.message?.content ?? ''
  const chatID = json.id
  const verified = await broker.inference.processResponse(providerAddress, content, chatID)

  return {
    output: content,
    verified,
    history: [...messages, { role: 'assistant', content }],
  }
}

// 还转给provider子账户
export const transferFund = async (
  signer: Wallet,
  providerAddress: string,
  fundAmount: bigint | number | string,
) => {
  try {
    const broker = await createZGComputeNetworkBroker(signer)
    const amount = parseEther(fundAmount.toString())
    // console.log('amount (wei):', amount); // bigint 数字，如 100000000000000000n
    // console.log('amount (0g):', formatEther(amount)); // '0.1'
    await broker.ledger.transferFund(providerAddress, 'inference', amount)
    // console.log(`Transfer of ${amount} to ${providerAddress} successful.`);
  }
  catch (error) {
    console.error(`Transfer to ${providerAddress} failed:`, error)
    throw error // 可根据需求选择是否抛出
  }
}

// 还转给provider子账户
export const depositFund = async (
  signer: Wallet,
  fundAmount: number,
) => {
  try {
    const broker = await createZGComputeNetworkBroker(signer)
    const amount = parseEther(fundAmount.toString())
    // console.log('amount (0g):', fundAmount); // '0.1'
    await broker.ledger.depositFund(fundAmount)
    // console.log(`Transfer successful.`);
  }
  catch (error) {
    console.error('Transfer failed:', error)
    throw error // 可根据需求选择是否抛出
  }
}
