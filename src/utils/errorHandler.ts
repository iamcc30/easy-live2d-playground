export interface ErrorMessage {
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorCallbacks: Array<(error: ErrorMessage) => void> = []

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // 注册错误回调
  onError(callback: (error: ErrorMessage) => void) {
    this.errorCallbacks.push(callback)
  }

  // 显示错误
  private showError(error: ErrorMessage) {
    this.errorCallbacks.forEach(callback => callback(error))
  }

  // 处理语音识别错误
  handleSpeechRecognitionError(error: string) {
    const errorMessages: Record<string, ErrorMessage> = {
      'no-speech': {
        type: 'warning',
        title: '未检测到语音',
        message: '请确保麦克风正常工作并尝试说话',
        duration: 3000
      },
      'audio-capture': {
        type: 'error',
        title: '音频捕获失败',
        message: '无法访问麦克风，请检查权限设置',
        duration: 5000
      },
      'network': {
        type: 'error',
        title: '网络错误',
        message: '语音识别需要网络连接，请检查网络状态',
        duration: 5000
      },
      'not-allowed': {
        type: 'error',
        title: '权限被拒绝',
        message: '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问',
        duration: 5000
      },
      'recognition-unsupported': {
        type: 'warning',
        title: '语音识别不支持',
        message: '当前浏览器不支持语音识别功能，建议使用Chrome或Edge',
        duration: 4000
      }
    }

    const errorMessage = errorMessages[error] || {
      type: 'error',
      title: '语音识别错误',
      message: error,
      duration: 4000
    }

    this.showError(errorMessage)
  }

  // 处理语音合成错误
  handleSpeechSynthesisError(error: string) {
    const errorMessages: Record<string, ErrorMessage> = {
      'voice-unavailable': {
        type: 'warning',
        title: '语音合成不可用',
        message: '无法加载语音合成引擎，请检查浏览器设置',
        duration: 4000
      },
      'synthesis-failed': {
        type: 'error',
        title: '语音合成失败',
        message: '无法合成语音，请尝试其他文本内容',
        duration: 3000
      }
    }

    const errorMessage = errorMessages[error] || {
      type: 'error',
      title: '语音合成错误',
      message: error,
      duration: 3000
    }

    this.showError(errorMessage)
  }

  // 处理Live2D错误
  handleLive2DError(error: string) {
    const errorMessages: Record<string, ErrorMessage> = {
      'model-load-failed': {
        type: 'error',
        title: '模型加载失败',
        message: '无法加载Live2D模型，请检查模型文件是否完整',
        duration: 5000
      },
      'parameter-not-found': {
        type: 'warning',
        title: '嘴型同步警告',
        message: '模型不支持嘴型同步功能，部分功能可能受限',
        duration: 4000
      }
    }

    const errorMessage = errorMessages[error] || {
      type: 'error',
      title: 'Live2D错误',
      message: error,
      duration: 4000
    }

    this.showError(errorMessage)
  }

  // 处理通用错误
  handleGenericError(error: string, context?: string) {
    const message = context ? `${context}: ${error}` : error
    this.showError({
      type: 'error',
      title: '系统错误',
      message,
      duration: 4000
    })
  }

  // 显示成功信息
  showSuccess(title: string, message: string, duration = 3000) {
    this.showError({
      type: 'info',
      title,
      message,
      duration
    })
  }

  // 显示警告信息
  showWarning(title: string, message: string, duration = 4000) {
    this.showError({
      type: 'warning',
      title,
      message,
      duration
    })
  }

  // 显示错误信息 (公开方法)
  showErrorMessage(title: string, message: string, duration = 4000) {
    this.showError({
      type: 'error',
      title,
      message,
      duration
    })
  }
}

// 创建全局实例
export const errorHandler = ErrorHandler.getInstance()