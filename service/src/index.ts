import express from "express";
import dotenv from "dotenv";
import { auth } from './middleware/auth'
import { llmService } from './service/llmService'

dotenv.config();

const app = express();
const router = express.Router()
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.static('public'))
app.use(express.json())

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
const messageStore = new Map<string, ChatMessage[]>()

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/", (_req, res) => {
  res.send("0g-qy-gomoku service is running");
});

router.get("/test", async (_req, res) => {
    const testResult = await llmService.test();
     res.send(`LLMService test result: ${testResult}`);
});

router.post('/llm/ask', auth, async (req, res) => {
  try {
    const { provider, prompt, history = [], options = {}, systemMessage, conversationId } = req.body

    if (!provider || !prompt)
      return res.status(400).json({ status: 'Fail', message: 'provider 和 prompt 不能为空' })

    // 构造对话历史
    let finalHistory: ChatMessage[] = []

    if (systemMessage)
      finalHistory.push({ role: 'system', content: systemMessage })

    if (conversationId && messageStore.has(conversationId)) {
      const old = messageStore.get(conversationId)!
      finalHistory = [...finalHistory, ...old.filter(m => m.role !== 'system')]
    }

    // 设置 response 为 SSE（Server-Sent Events）模式
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // 执行 LLM 调用
    const { stream } = await llmService.ask({
      provider,
      prompt,
      history: [...finalHistory],
    })
    let content = ''

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || ''
      content += delta
      const jsonStr = JSON.stringify(chunk)
      // console.log('[Stream Chunk]', jsonStr);

      res.write(`data: ${jsonStr}\n\n`)
    }

    // const verified = await broker.inference.processResponse(providerAddress, content, id);

    res.write('data: [DONE]\n\n')
    res.end()

    // console.log('prompt', prompt)
    // console.log('assistant', content)
    // 保存历史
    const newHistory: ChatMessage[] = [
      ...finalHistory,
      { role: 'user', content: prompt },
      { role: 'assistant', content },
    ]
    // console.log('newHistory', newHistory)
    messageStore.set(conversationId, newHistory)
  }
  catch (error: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || '内部错误' })}\n\n`)
    res.end()
  }
})


router.get('/llm/models', auth, async (_, res) => {
  try {
    console.log('Fetching available models from LLMService...');
    const models = await llmService.listModels()
    const modelsSafe = convertBigIntToString(models)
    res.json({ status: 'Success', data: modelsSafe })
  }
  catch (error: any) {
    res.status(500).json({ status: 'Fail', message: error.message })
  }
})

router.get('/llm/balance', auth, async (_, res) => {
  try {
    const balance = await llmService.balance()
    res.json({ status: 'Success', data: balance })
  }
  catch (error: any) {
    res.status(500).json({ status: 'Fail', message: error.message })
  }
})

router.post('/llm/fund', auth, async (req, res) => {
  try {
    const { amount } = req.body
    if (typeof amount !== 'number')
      return res.status(400).json({ status: 'Fail', message: 'amount 必须为数字' })

    const tx = await llmService.fund(amount)
    res.json({ status: 'Success', data: tx })
  }
  catch (error: any) {
    res.status(500).json({ status: 'Fail', message: error.message })
  }
})



app.use('', router)
app.use('/api', router)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Service listening on port ${port}`);
});


function convertBigIntToString(obj: any) {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  ))
}