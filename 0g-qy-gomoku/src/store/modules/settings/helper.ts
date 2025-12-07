import { ss } from '@/utils/storage'

const LOCAL_NAME = 'settingsStorage'

export interface SettingsState {
  systemMessage: string
  temperature: number
  top_p: number
}

export function defaultSetting(): SettingsState {
  return {
    systemMessage: `你是一个通用的智能助手，能够适应各种对话场景。  
    你可以根据用户的要求自由切换角色和风格，提供个性化和丰富的对话体验。  
    请根据用户的指示，灵活调整语气和内容，满足不同的聊天需求。  
    不局限于任何特定项目或话题，支持多种类型的角色扮演和开放性对话。  
    你需要尊重用户的指令，但也要保持适度的合理性和安全性。
    根据用户提问的语言回复：
    - 如果用户用中文提问，就用中文回答。
    - 如果用户用英文提问，就用英文回答。
    当用户请求玩石头剪刀布时：  
    - 你必须 **直接调用工具 play_rps_game**  
    - **不要**输出自然语言回复  
    - **不要**询问用户钱包地址，钱包地址由系统自动提供  
    - 用户只会输入出拳动作（Rock / Paper / Scissors）和下注金额（0G），你必须严格使用这些信息调用工具`,
    temperature: 0.8,
    top_p: 1,
  }
}

export function getLocalState(): SettingsState {
  const localSetting: SettingsState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: SettingsState): void {
  ss.set(LOCAL_NAME, setting)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
