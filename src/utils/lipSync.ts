import type { Live2DSprite } from 'easy-live2d'

export interface LipSyncConfig {
  smoothness: number // 平滑度 (0-1)
  sensitivity: number // 敏感度 (0-1)
  updateInterval: number // 更新间隔 (ms)
}

export class LipSyncService {
  private live2DSprite: Live2DSprite | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private isActive = false
  private animationId: number | null = null
  private lastVolume = 0

  private config: LipSyncConfig = {
    smoothness: 0.8,
    sensitivity: 0.5,
    updateInterval: 16 // ~60fps
  }

  // 嘴型参数映射
  private readonly lipParameters = {
    mouthForm: 'ParamMouthForm', // 嘴型形状
    mouthOpenY: 'ParamMouthOpenY', // 嘴张开程度
    mouthWidth: 'ParamMouthWidth' // 嘴宽度
  }

  constructor(config?: Partial<LipSyncConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 初始化音频上下文
    this.initAudioContext()
  }

  // 初始化音频上下文
  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = this.config.smoothness

      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)
    } catch (error) {
      console.warn('无法初始化音频上下文:', error)
    }
  }

  // 设置Live2D精灵
  setLive2DSprite(sprite: Live2DSprite) {
    this.live2DSprite = sprite
  }

  // 开始嘴型同步
  startLipSync() {
    if (!this.isActive && this.audioContext && this.analyser && this.dataArray) {
      this.isActive = true
      this.startAnalyzing()
    }
  }

  // 停止嘴型同步
  stopLipSync() {
    this.isActive = false
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // 重置嘴型参数
    this.resetMouthParameters()
  }

  // 开始音频分析
  private startAnalyzing() {
    if (!this.isActive) return

    this.analyzeAudio()

    if (this.isActive) {
      this.animationId = requestAnimationFrame(() => this.startAnalyzing())
    }
  }

  // 分析音频数据
  private analyzeAudio() {
    if (!this.analyser || !this.dataArray || !this.live2DSprite) return

    this.analyser.getByteFrequencyData(this.dataArray)

    // 计算音量（使用低频部分）
    const lowFreqRange = Math.floor(this.dataArray.length * 0.1) // 使用前10%的低频
    let sum = 0
    for (let i = 0; i < lowFreqRange; i++) {
      sum += this.dataArray[i]
    }
    const avgVolume = sum / lowFreqRange
    const normalizedVolume = avgVolume / 255 // 归一化到0-1

    // 应用敏感度
    const volume = Math.pow(normalizedVolume, 1 / this.config.sensitivity)

    // 平滑处理
    const smoothedVolume = this.lastVolume * this.config.smoothness + volume * (1 - this.config.smoothness)
    this.lastVolume = smoothedVolume

    // 更新嘴型参数
    this.updateMouthParameters(smoothedVolume)
  }

  // 更新嘴型参数
  private updateMouthParameters(volume: number) {
    if (!this.live2DSprite) return

    try {
      // 嘴张开程度 (0-1)
      const mouthOpenY = Math.min(volume * 2, 1)

      // 嘴型形状 (0-1, 0=横向, 1=圆形)
      const mouthForm = volume > 0.3 ? 1 : 0

      // 嘴宽度 (0.8-1.2)
      const mouthWidth = 1 - volume * 0.2

      // 设置Live2D参数
      this.setParameterValue(this.lipParameters.mouthOpenY, mouthOpenY)
      this.setParameterValue(this.lipParameters.mouthForm, mouthForm)
      this.setParameterValue(this.lipParameters.mouthWidth, mouthWidth)
    } catch (error) {
      console.warn('更新嘴型参数失败:', error)
    }
  }

  // 设置Live2D参数值
  private setParameterValue(parameterName: string, value: number) {
    if (!this.live2DSprite) return

    try {
      // 使用Live2D模型的setParameterValueById方法
      const model = (this.live2DSprite as any)._model
      if (model && model.setParameterValueById) {
        model.setParameterValueById(parameterName, value)
      }
    } catch (error) {
      console.warn(`设置参数 ${parameterName} 失败:`, error)
    }
  }

  // 重置嘴型参数
  private resetMouthParameters() {
    if (!this.live2DSprite) return

    try {
      this.setParameterValue(this.lipParameters.mouthOpenY, 0)
      this.setParameterValue(this.lipParameters.mouthForm, 0)
      this.setParameterValue(this.lipParameters.mouthWidth, 1)
    } catch (error) {
      console.warn('重置嘴型参数失败:', error)
    }
  }

  // 从音频元素创建嘴型同步
  createLipSyncFromAudioElement(audioElement: HTMLAudioElement) {
    if (!this.audioContext || !this.analyser) {
      console.warn('音频上下文未初始化')
      return
    }

    try {
      // 创建媒体元素源
      const source = this.audioContext.createMediaElementSource(audioElement)
      source.connect(this.analyser)
      this.analyser.connect(this.audioContext.destination)

      this.startLipSync()
    } catch (error) {
      console.warn('创建音频元素嘴型同步失败:', error)
    }
  }

  // 从麦克风创建嘴型同步
  async createLipSyncFromMicrophone() {
    if (!this.audioContext || !this.analyser) {
      console.warn('音频上下文未初始化')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = this.audioContext.createMediaStreamSource(stream)
      source.connect(this.analyser)

      this.startLipSync()
      return stream
    } catch (error) {
      console.warn('创建麦克风嘴型同步失败:', error)
      return null
    }
  }

  // 更新配置
  updateConfig(config: Partial<LipSyncConfig>) {
    this.config = { ...this.config, ...config }

    if (this.analyser) {
      this.analyser.smoothingTimeConstant = this.config.smoothness
    }
  }

  // 获取当前状态
  getStatus() {
    return {
      isActive: this.isActive,
      volume: this.lastVolume,
      config: this.config
    }
  }
}

// 创建全局实例
export const lipSyncService = new LipSyncService()