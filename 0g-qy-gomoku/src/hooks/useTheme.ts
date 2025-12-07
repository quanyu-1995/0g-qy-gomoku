import type { GlobalThemeOverrides } from 'naive-ui'
import { computed, watch } from 'vue'
import { darkTheme, useOsTheme } from 'naive-ui'
import { useAppStore } from '@/store'

export function useTheme() {
  const appStore = useAppStore()

  const OsTheme = useOsTheme()

  const isDark = computed(() => {
    if (appStore.theme === 'auto')
      return OsTheme.value === 'dark'
    else
      return appStore.theme === 'dark'
  })

  const theme = computed(() => {
    return isDark.value ? darkTheme : undefined
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    if (isDark.value) {
      return {
        common: {},
      }
    }
    return {
      common: {
        primaryColor: '#E3C1FF',
        primaryColorHover: '#CB8AFF', // 鼠标悬浮状态
        primaryColorPressed: '#B75FFF', // 按下状态
      },
      Input: {
        caretColor: '#E3C1FF', // 默认边框颜色

        borderColor: '#E3C1FF', // 默认边框颜色
        borderHoverColor: '#E3C1FF', // 鼠标悬浮时边框颜色
        borderFocusColor: '#E3C1FF', // 选中（聚焦）时边框颜色

        boxShadowFocus: '0 0 0 2px rgba(227, 193, 255, 0.3)', // 关键点：聚焦时的 box-shadow 效果（必须设置，否则仍会显示默认绿色外阴影）
      },
      Select: {
        textColor: '#B75FFF', // ✅ 控制已选项文字颜色
        placeholderColor: '#aaa',
        optionTextColor: '#333',
        optionTextColorActive: '#B75FFF',
        optionTextColorSelected: '#B75FFF',
        optionColorSelected: 'rgba(227, 193, 255, 0.2)',
        optionColorPending: 'rgba(227, 193, 255, 0.1)',
        optionColorActive: '#B75FFF',
      },
    }
  })

  watch(
    () => isDark.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('dark')
      else
        document.documentElement.classList.remove('dark')
    },
    { immediate: true },
  )

  return { theme, themeOverrides }
}
