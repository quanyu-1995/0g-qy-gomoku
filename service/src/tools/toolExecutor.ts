import { toolFunctions } from './tools'

export const handleToolCalls = async (toolCalls: any[]) => {
  const results = []
  console.log('Executing tool calls:', toolCalls);
  for (const toolCall of toolCalls) {
    const { id: tool_call_id, function: fn } = toolCall
    const fnName = fn.name

    console.log(`Processing tool call ID: ${tool_call_id}, Function: ${fnName}`);
    let args
    try {
      args = JSON.parse(fn.arguments)
    }
    catch (err) {
      console.error(`❌ JSON parse error for arguments: ${fn.arguments}`)
      throw err
    }
    const toolFn = toolFunctions[fnName]
    if (!toolFn) {
      console.error(`❌ Tool function ${fnName} not found`)
      throw new Error(`Tool function ${fnName} not found`)
    }
    console.log(`🔧 Executing tool function: ${fnName} with arguments`)
    const result = await toolFn(args)
    console.log(`✅ Tool function ${fnName} executed successfully with result:`, result);
    results.push({
      role: 'tool',
      tool_call_id,
      content: JSON.stringify(result),
    })
  }

  return results
}
