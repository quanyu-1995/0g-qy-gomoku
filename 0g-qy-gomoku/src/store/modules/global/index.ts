// store/modules/model/index.ts
import { defineStore } from 'pinia'
import { type Ref, ref } from 'vue'
import { mapModelsResponseToServiceStruct } from './helper'
import type { ModelsResponse, ServiceStructOutput } from './types'
import { fetchModelsOptions } from '@/api'

export const useModelStore = defineStore('model-store', () => {
  const modelList: Ref<ServiceStructOutput[]> = ref([])
  const selectedModel: Ref<ServiceStructOutput | null> = ref(null)
  const hasLoaded = ref(false)

  async function initModelList() {
    if (hasLoaded.value)
      return
    try {
      const res = await fetchModelsOptions() as ModelsResponse
      if (!Array.isArray(res.data))
        throw new Error('data 不是数组')

      modelList.value = mapModelsResponseToServiceStruct(res.data)
      selectedModel.value = modelList.value[0] ?? null
      hasLoaded.value = true
    }
    catch (err) {
      console.error('模型列表加载失败:', err)
    }
  }

  function setSelected(model: ServiceStructOutput) {
    selectedModel.value = model
  }

  return {
    modelList,
    selectedModel,
    initModelList,
    setSelected,
  }
})
