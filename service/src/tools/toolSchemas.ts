import type { OpenAI } from 'openai'

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'place_stone',
      description: '在五子棋游戏中落子',
      parameters: {
        type: 'object',
        properties: {
          gameId: {
            type: 'number',
            description: '游戏的ID',
          },
          x: {
            type: 'number',
            description: '棋子放置的横坐标(0-14)',
          },
          y: {
            type: 'number',
            description: '棋子放置的纵坐标(0-14)',
          },
        },
        required: ['gameId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_game',
      description: '获取指定ID的五子棋游戏详情',
      parameters: {
        type: 'object',
        properties: {
          gameId: {
            type: 'number',
            description: '游戏的ID',
          },
        },
        required: ['gameId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_game',
      description: '获取当前用户参与的五子棋游戏详情',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_board_cell',
      description: '获取五子棋游戏中指定格子的状态',
      parameters: {
        type: 'object',
        properties: {
          gameId: {
            type: 'number',
            description: '游戏的ID',
          },
          x: {
            type: 'number',
            description: '格子的横坐标（0-14）',
          },
          y: {
            type: 'number',
            description: '格子的纵坐标（0-14）',
          },
        },
        required: ['gameId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_board',
      description: '获取五子棋游戏的整个棋盘状态',
      parameters: {
        type: 'object',
        properties: {
          gameId: {
            type: 'number',
            description: '游戏的ID',
          },
        },
        required: ['gameId'],
      },
    },
  },
]
