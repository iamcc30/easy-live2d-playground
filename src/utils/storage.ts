import type { ChatMessage } from '@/stores/chat'

const STORAGE_KEY = 'easy-live2d-chat-history'
const MAX_HISTORY_LENGTH = 100 // 最大保存消息数

export interface ChatHistory {
  messages: ChatMessage[]
  lastUpdated: string
}

export class ChatStorage {
  // 保存聊天历史
  static saveHistory(messages: ChatMessage[]): void {
    try {
      const history: ChatHistory = {
        messages: messages.slice(-MAX_HISTORY_LENGTH), // 只保留最新的消息
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.warn('保存聊天历史失败:', error)
    }
  }

  // 加载聊天历史
  static loadHistory(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const history: ChatHistory = JSON.parse(stored)
        // 恢复日期对象
        return history.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }
    } catch (error) {
      console.warn('加载聊天历史失败:', error)
    }
    return []
  }

  // 清空聊天历史
  static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('清空聊天历史失败:', error)
    }
  }

  // 导出聊天历史为JSON
  static exportHistory(messages: ChatMessage[]): string {
    try {
      const history: ChatHistory = {
        messages,
        lastUpdated: new Date().toISOString()
      }
      return JSON.stringify(history, null, 2)
    } catch (error) {
      console.warn('导出聊天历史失败:', error)
      return ''
    }
  }

  // 从JSON导入聊天历史
  static importHistory(jsonString: string): ChatMessage[] {
    try {
      const history: ChatHistory = JSON.parse(jsonString)
      if (history.messages && Array.isArray(history.messages)) {
        return history.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }
    } catch (error) {
      console.warn('导入聊天历史失败:', error)
    }
    return []
  }

  // 获取历史统计信息
  static getHistoryStats(messages: ChatMessage[]): {
    totalCount: number
    userMessageCount: number
    aiMessageCount: number
    dateRange: { start: Date | null; end: Date | null }
  } {
    if (messages.length === 0) {
      return {
        totalCount: 0,
        userMessageCount: 0,
        aiMessageCount: 0,
        dateRange: { start: null, end: null }
      }
    }

    const userMessageCount = messages.filter(msg => msg.isUser).length
    const aiMessageCount = messages.filter(msg => !msg.isUser).length

    const timestamps = messages.map(msg => msg.timestamp.getTime())
    const startDate = new Date(Math.min(...timestamps))
    const endDate = new Date(Math.max(...timestamps))

    return {
      totalCount: messages.length,
      userMessageCount,
      aiMessageCount,
      dateRange: { start: startDate, end: endDate }
    }
  }

  // 检查存储空间是否可用
  static isStorageAvailable(): boolean {
    try {
      const testKey = '__test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (error) {
      return false
    }
  }

  // 获取存储使用情况
  static getStorageUsage(): { used: number; remaining: number; total: number } {
    if (!this.isStorageAvailable()) {
      return { used: 0, remaining: 0, total: 0 }
    }

    try {
      let totalLength = 0
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalLength += localStorage[key].length + key.length
        }
      }

      // 估算剩余空间 (大多数浏览器约5-10MB)
      const estimatedTotal = 5 * 1024 * 1024 // 5MB
      const used = totalLength * 2 // UTF-16编码，每个字符2字节
      const remaining = Math.max(0, estimatedTotal - used)

      return {
        used,
        remaining,
        total: estimatedTotal
      }
    } catch (error) {
      console.warn('获取存储使用情况失败:', error)
      return { used: 0, remaining: 0, total: 0 }
    }
  }
}