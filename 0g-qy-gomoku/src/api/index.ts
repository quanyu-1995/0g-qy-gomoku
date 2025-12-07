import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { get, post } from '@/utils/request'
// import { httpStream } from '@/utils/request/httpStream'
import { useModelStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}

// export function fetchChatAPIProcessRaw(params: {
//   prompt: string
//   options?: { conversationId?: string; parentMessageId?: string }
//   signal?: AbortSignal
//   onMessage: (msg: string) => void
//   onFinish?: () => void
//   onError?: (err: any) => void
// }) {
//   const settingStore = useSettingStore()
//   const modelStore = useModelStore()

//   const data = {
//     prompt: params.prompt,
//     options: params.options,
//     systemMessage: settingStore.systemMessage,
//     temperature: settingStore.temperature,
//     top_p: settingStore.top_p,
//     provider: modelStore.selectedModel?.provider,
//   }

//   return httpStream({
//     url: '/llm/ask',
//     data,
//     signal: params.signal,
//     onMessage: params.onMessage,
//     onFinish: params.onFinish,
//     onError: params.onError,
//   })
// }

export function fetchChatAPIProcess<T = any>(params: {
  prompt: string
  options?: { conversationId?: string; parentMessageId?: string }
  signal?: GenericAbortSignal
  onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void
}) {
  const settingStore = useSettingStore()
  const modelStore = useModelStore()

  const hash = window.location.hash // #/chat/1755670460056
  const parts = hash.split('/')
  // 从 URL 取 conversationId，如果 params.options.conversationId 已经传了，就优先用传入的
  const conversationId = parts.length > 2 ? parts[2] : null

  const data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
    systemMessage: settingStore.systemMessage,
    temperature: settingStore.temperature,
    top_p: settingStore.top_p,
    provider: modelStore.selectedModel?.provider,
    conversationId,
  }

  return post<T>({
    url: '/llm/ask',
    data,
    signal: params.signal,
    onDownloadProgress: (e: AxiosProgressEvent) => {
      // 💡 保留响应流给组件处理，不做解析！
      // console.log('111')
      // console.log(e)
      params.onDownloadProgress?.(e)
    },
  })
}

// export function fetchChatAPIProcess<T = any>(
//   params: {
//     prompt: string
//     options?: { conversationId?: string; parentMessageId?: string }
//     signal?: GenericAbortSignal
//     onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
// ) {
//   const settingStore = useSettingStore()
//   const authStore = useAuthStore()
//   const modelStore = useModelStore()

//   let data: Record<string, any> = {
//     prompt: params.prompt,
//     options: params.options,
//   }

//   // if (authStore.isChatGPTAPI) {
//   //   data = {
//   //     ...data,
//   //     systemMessage: settingStore.systemMessage,
//   //     temperature: settingStore.temperature,
//   //     top_p: settingStore.top_p,
//   //   }
//   // }

//   if (authStore.is0GCompute) {
//     data = {
//       ...data,
//       systemMessage: settingStore.systemMessage,
//       temperature: settingStore.temperature,
//       top_p: settingStore.top_p,
//       provider: modelStore.selectedModel?.provider,  // 追加provider字段
//     }
//   }

//   return post<T>({
//     url: '/llm/ask',
//     data,
//     signal: params.signal,
//     onDownloadProgress: (e) => {
//       const xhr = e.event?.target
//       const { responseText } = xhr
//       //console.log('💡 原始 responseText', responseText)

//       const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
//       let chunk = responseText
//       //console.log('📌 解析 chunk', chunk)
//       if (lastIndex !== -1)
//         chunk = responseText.substring(lastIndex)

//       try {
//         const res = JSON.parse(chunk)
//         //console.log('✅ 解析后数据', res)

//         // ✅ 转换后端返回为前端预期格式
//         const transformed = {
//           text: res?.data?.choices?.[0]?.message?.content ?? '',
//           conversationId: null, // 你可以根据实际情况补充
//           id: res?.data?.id ?? Date.now().toString(), // 保留原 ID 或生成新 ID
//           detail: {
//             choices: [
//               {
//                 finish_reason: res?.data?.choices?.[0]?.finish_reason ?? 'stop',
//               },
//             ],
//           },
//         }

//         // 调用前端原始的回调，伪造 responseText
//         params.onDownloadProgress?.({
//           ...e,
//           event: {
//             ...e.event,
//             target: {
//               responseText: JSON.stringify(transformed),
//             },
//           },
//         })
//       } catch (err) {
//         console.warn('响应格式解析失败', err)
//       }
//     },
//   })

// }

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

export function fetchModelsOptions<T>() {
  return get<T>({
    url: '/llm/models',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}
