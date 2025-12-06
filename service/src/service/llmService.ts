// src/llmService.ts
import { Readable } from 'stream'
import { JsonRpcProvider, Wallet } from 'ethers'
import dotenv from 'dotenv'
import type OpenAI from 'openai'
import { askLLM, fundBroker, getAvailableModels, getBrokerBalance } from '../utils/askLLM'
import { handleToolCalls } from '../tools/toolExecutor'
import { HttpsProxyAgent } from 'https-proxy-agent'
// import { ethers } from "ethers"
// import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

dotenv.config()

class LLMService {
  private wallet: Wallet

  constructor() {
    // const provider = new JsonRpcProvider(process.env.RPC_URL!)
    const provider = new JsonRpcProvider(process.env.RPC_URL, {
      // 显式设置网络参数（0G 测试网 chainId，需确认正确值）
      chainId: 16602, // 替换为 0G 测试网的实际 chainId，可通过 curl 获取：eth_chainId
      name: '0G-Testnet-Galileo',
    }, {
      // 禁用持久连接（部分 RPC 节点对持久连接支持不佳）
      batchMaxCount: 1,
    });
    this.wallet = new Wallet(process.env.PRIVATE_KEY!, provider)
  }

  getWallet() {
    return this.wallet
  }

  async listModels() { 
    return await getAvailableModels(this.wallet)
  }

  async ask(input: {
    provider: string
    prompt: string
    history: { role: 'user' | 'system' | 'assistant'; content: string }[]
  }) {
    try {
      const messages = [...input.history, { role: 'user', content: input.prompt }]

      const { stream } = await askLLM(this.wallet, input.provider, input.prompt, input.history)

      const streamIter = stream[Symbol.asyncIterator]()

      const peekedParts: any[] = []
      let hasToolCalls = false
      let peekLimit = 3

      while (peekLimit-- > 0) {
        const { value, done } = await streamIter.next()
        if (done || !value)
          break

        peekedParts.push(value)

        const delta = value.choices?.[0]?.delta
        // console.log('delta', delta)
        if (!delta)
          continue

        if (delta.tool_calls) {
          hasToolCalls = true

          break // 发现tool_calls，提前退出，交给handleFunctionCall处理
        }
      }
      // console.log('hasToolCalls', hasToolCalls)
      if (hasToolCalls)
        return await this.handleFunctionCall(messages, streamIter, peekedParts, input.provider)

      const restream = this.restream(peekedParts, streamIter)
      return { stream: restream }
    }
    catch (err) {
      console.error('❌ askLLM 出错:', err)

      return { stream: this.createErrorStream(err) }
    }
  }

  private async *restream(peeked: any[], iter: AsyncIterator<any>) {
    // for (const part of peeked) {
    //    //console.log('peeked part:', part);
    //   yield part
    // }
    // for await (const part of iter) {
    //    //console.log('iter part:', part);
    //   yield part
    // }

    let fullText = '' // 用来拼接完整内容

    for (const part of peeked) {
      const delta = part.choices?.[0]?.delta
      if (delta?.content)
        fullText += delta.content
      // console.log("peeked content:", delta.content, "| full:", fullText);

      yield part
    }

    for await (const part of iter) {
      const delta = part.choices?.[0]?.delta
      if (delta?.content)
        fullText += delta.content
      // console.log("iter content:", delta.content, "| full:", fullText);

      yield part
    }
  }

  private async handleFunctionCall(
    messages: any[],
    streamIter: AsyncIterator<any>,
    peekedParts: any[],
    provider: string,
  ) {
    let toolCalls: OpenAI.Chat.Completions.ChatCompletionToolCall[] | undefined

    // 先把已读取的 peekedParts 拼接 tool_calls
    for (const part of peekedParts) {
      const delta = part.choices?.[0]?.delta
      if (!delta || !delta.tool_calls)
        continue

      if (!toolCalls) {
        toolCalls = delta.tool_calls.map(tc => ({
          ...tc,
          function: {
            ...tc.function,
            arguments: tc.function?.arguments ?? '',
          },
        }))
      }
      else {
        for (let i = 0; i < delta.tool_calls.length; i++) {
          const incoming = delta.tool_calls[i]
          const existing = toolCalls[i]
          if (incoming.function?.arguments)
            existing.function.arguments += incoming.function.arguments
        }
      }
    }

    // 继续从流中读取，直到 toolCalls 拼接完整
    const maxPeek = 200
    let peekCount = 0

    // eslint-disable-next-line no-unmodified-loop-condition
    while (toolCalls && peekCount < maxPeek) {
      peekCount++
      const { value, done } = await streamIter.next()
      if (done || !value)
        break

      const delta = value.choices?.[0]?.delta
      if (!delta || !delta.tool_calls)
        continue

      for (let i = 0; i < delta.tool_calls.length; i++) {
        const incoming = delta.tool_calls[i]
        const existing = toolCalls[i]
        if (incoming.function?.arguments)
          existing.function.arguments += incoming.function.arguments
      }

      const allComplete = toolCalls.every((tc) => {
        try {
          return !!tc.function.name && !!JSON.parse(tc.function.arguments)
        }
        catch {
          return false
        }
      })

      if (allComplete)
        break
    }

    if (!toolCalls)
      throw new Error('handleFunctionCall: 未检测到 toolCalls')

    // console.log('handleToolCalls before')
    let toolMessages
    try {
      toolMessages = await handleToolCalls(toolCalls) // 这里内部 for 循环调用各个工具
    }
    catch (err: any) {
      // console.log('捕获到异常:', err.message);
      // 调用 createErrorStream
      return { stream: this.createErrorStream(err) }
    }
    // const toolMessages = await handleToolCalls(toolCalls)
    // console.log('handleToolCalls after')

    const fullMessages = [
      ...messages,
      {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls,
      },
      ...toolMessages,
    ]

    // console.log('fullMessages', fullMessages)

    // await askLLM(this.wallet, input.provider, input.prompt, input.history)
    const history = fullMessages.slice(0, -1) // 全部内容（包括 tool_call）前的内容
    const prompt = fullMessages.at(-1)?.content ?? '' // 最后一条消息的内容（一般是 tool 返回内容后模型生成回答）

    const { stream } = await askLLM(this.wallet, provider, prompt, history)

    // 这里可以用 restream 把之前 peekedParts 和后续流再合并
    // 但一般这里直接返回新的 stream 就行，调试时可以打印
    // for await (const part of stream) {
    //   console.log('function call stream part:', part)
    // }

    return { stream }
  }

  createErrorStream(err: Error): Readable {
    const errorStream = new Readable({ objectMode: true, read() {} })
    errorStream.push({
      id: `chatcmpl-error-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'error-tool',
      choices: [
        {
          index: 0,
          delta: { content: `[ERR] ${err.message}` },
          logprobs: null,
          finish_reason: 'error',
        },
      ],
    })

    errorStream.push(null)
    return errorStream
  }

  async balance() {
    return await getBrokerBalance(this.wallet)
  }

  async fund(amount: number) {
    return await fundBroker(this.wallet, amount)
  }

  async test() {
    // const broker = await createZGComputeNetworkBroker(this.wallet)
    // const account = await broker.ledger.getLedger();
    // console.log(`Total Balance: ${ethers.formatEther(account.totalBalance)} 0G`);
    // console.log(`Available: ${ethers.formatEther(account.availableBalance)} 0G`);
    return await this.balance();
  }
}

export const llmService = new LLMService()
