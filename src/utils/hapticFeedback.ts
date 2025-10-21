/**
 * 移动端触觉反馈工具
 * 提供各种场景的振动反馈
 */

type VibrationPattern = number | number[]

interface HapticFeedback {
  // 轻触反馈
  light: () => void
  // 中等反馈
  medium: () => void
  // 重度反馈
  heavy: () => void
  // 成功反馈
  success: () => void
  // 警告反馈
  warning: () => void
  // 错误反馈
  error: () => void
  // 自定义振动
  custom: (pattern: VibrationPattern) => void
  // 检查是否支持
  isSupported: () => boolean
}

class HapticFeedbackService implements HapticFeedback {
  private vibrationAPI: 'vibrate' | 'webkitVibrate' | null = null

  constructor() {
    this.detectVibrationAPI()
  }

  /**
   * 检测振动API支持
   */
  private detectVibrationAPI() {
    if ('vibrate' in navigator) {
      this.vibrationAPI = 'vibrate'
    } else if ('webkitVibrate' in navigator) {
      this.vibrationAPI = 'webkitVibrate'
    }
  }

  /**
   * 检查是否支持振动
   */
  isSupported(): boolean {
    return this.vibrationAPI !== null
  }

  /**
   * 执行振动
   */
  private vibrate(pattern: VibrationPattern): void {
    if (!this.vibrationAPI) {
      console.warn('触觉反馈不支持')
      return
    }

    try {
      if (this.vibrationAPI === 'vibrate') {
        navigator.vibrate(pattern)
      } else if (this.vibrationAPI === 'webkitVibrate') {
        // @ts-ignore
        navigator.webkitVibrate(pattern)
      }
    } catch (error) {
      console.error('触觉反馈执行失败:', error)
    }
  }

  /**
   * 轻触反馈 - 用于按钮点击、选择等
   */
  light(): void {
    this.vibrate(10)
  }

  /**
   * 中等反馈 - 用于重要操作确认
   */
  medium(): void {
    this.vibrate(20)
  }

  /**
   * 重度反馈 - 用于关键操作
   */
  heavy(): void {
    this.vibrate(30)
  }

  /**
   * 成功反馈 - 短-长-短
   */
  success(): void {
    this.vibrate([10, 50, 10, 50, 30])
  }

  /**
   * 警告反馈 - 两次中等振动
   */
  warning(): void {
    this.vibrate([20, 100, 20])
  }

  /**
   * 错误反馈 - 三次短促振动
   */
  error(): void {
    this.vibrate([15, 50, 15, 50, 15])
  }

  /**
   * 自定义振动模式
   * @param pattern 振动模式（毫秒）
   */
  custom(pattern: VibrationPattern): void {
    this.vibrate(pattern)
  }

  /**
   * 停止所有振动
   */
  stop(): void {
    this.vibrate(0)
  }
}

// 导出单例
export const hapticFeedback = new HapticFeedbackService()

// 语音交互专用反馈
export const voiceHaptics = {
  /**
   * 开始录音反馈
   */
  startRecording: () => {
    hapticFeedback.medium()
  },

  /**
   * 停止录音反馈
   */
  stopRecording: () => {
    hapticFeedback.light()
  },

  /**
   * 识别成功反馈
   */
  recognitionSuccess: () => {
    hapticFeedback.success()
  },

  /**
   * 识别失败反馈
   */
  recognitionError: () => {
    hapticFeedback.error()
  },

  /**
   * 开始播放反馈
   */
  startSpeaking: () => {
    hapticFeedback.light()
  },

  /**
   * 连接成功反馈
   */
  connectionSuccess: () => {
    hapticFeedback.success()
  },

  /**
   * 连接失败反馈
   */
  connectionError: () => {
    hapticFeedback.error()
  },

  /**
   * 模式切换反馈
   */
  modeSwitch: () => {
    hapticFeedback.light()
  },

  /**
   * 按钮点击反馈
   */
  buttonTap: () => {
    hapticFeedback.light()
  }
}
