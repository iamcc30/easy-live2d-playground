import { audioRecordingConfig } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'
import { OpusEncoder } from './opusEncoder'

/**
 * Audio Recording Service with OPUS encoding support
 *
 * Features:
 * - WebCodecs API OPUS encoding (Chrome 94+, Edge 94+)
 * - PCM fallback for unsupported browsers
 * - Automatic format detection and switching
 */
export class AudioRecordingService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isRecording = false
  private onDataCallback: ((data: ArrayBuffer) => void) | null = null
  private opusEncoder: OpusEncoder | null = null
  private useOpusEncoding = false
  private audioTimestamp = 0

  /**
   * Initialize audio recording
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioRecordingConfig.sampleRate,
          channelCount: audioRecordingConfig.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: audioRecordingConfig.sampleRate
      })

      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create script processor for audio data
      // Buffer size calculation: sampleRate * frameDuration / 1000
      const bufferSize = Math.pow(2, Math.ceil(Math.log2(
        audioRecordingConfig.sampleRate * audioRecordingConfig.frameDuration / 1000
      )))

      this.scriptProcessor = this.audioContext.createScriptProcessor(
        bufferSize,
        audioRecordingConfig.channels,
        audioRecordingConfig.channels
      )

      // Setup audio processing
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.isRecording) {
          this.processAudioData(event.inputBuffer)
        }
      }

      // Connect nodes
      this.mediaStreamSource.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      // Try to initialize OPUS encoder
      this.opusEncoder = new OpusEncoder()
      this.useOpusEncoding = false // Will be set when starting recording

      console.log('✅ Audio recording initialized')
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorHandler.showErrorMessage('无法初始化音频录制', errorMessage)
      throw error
    }
  }

  /**
   * Start recording
   */
  async startRecording(onData: (data: ArrayBuffer) => void): Promise<void> {
    if (!this.audioContext || !this.scriptProcessor) {
      throw new Error('Audio recording not initialized')
    }

    if (this.isRecording) {
      console.warn('Already recording')
      return
    }

    this.onDataCallback = onData
    this.audioTimestamp = 0

    // Try to initialize OPUS encoding
    if (this.opusEncoder) {
      this.useOpusEncoding = await this.opusEncoder.initialize((opusData) => {
        if (this.onDataCallback) {
          this.onDataCallback(opusData.buffer)
        }
      })

      if (this.useOpusEncoding) {
        console.log('🎵 Using OPUS encoding')
      }
      else {
        console.log('📊 Using PCM fallback')
      }
    }

    this.isRecording = true

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    console.log('🎤 Recording started')
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return
    }

    this.isRecording = false

    // Flush OPUS encoder
    if (this.useOpusEncoding && this.opusEncoder) {
      await this.opusEncoder.flush()
    }

    this.onDataCallback = null
    this.audioTimestamp = 0

    console.log('🛑 Recording stopped')
  }

  /**
   * Process audio data and encode to OPUS or PCM
   */
  private processAudioData(buffer: AudioBuffer): void {
    if (!this.onDataCallback) return

    try {
      // Get audio data from first channel
      const channelData = buffer.getChannelData(0)

      // Use OPUS encoding if available
      if (this.useOpusEncoding && this.opusEncoder) {
        this.opusEncoder.encode(channelData, this.audioTimestamp)
        this.audioTimestamp += buffer.duration
      }
      else {
        // Fallback to PCM
        const pcmData = this.float32ToInt16(channelData)
        this.onDataCallback(pcmData.buffer)
      }
    }
    catch (error) {
      console.error('Failed to process audio data:', error)
    }
  }

  /**
   * Convert Float32Array to Int16Array (PCM)
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16Array
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopRecording()

    // Close OPUS encoder
    if (this.opusEncoder) {
      this.opusEncoder.close()
      this.opusEncoder = null
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect()
      this.mediaStreamSource = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('🧹 Audio recording resources disposed')
  }

  /**
   * Check if recording
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * Check if using OPUS encoding
   */
  isUsingOpus(): boolean {
    return this.useOpusEncoding
  }

  /**
   * Get audio context state
   */
  getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state || null
  }

  /**
   * Get encoder status
   */
  getEncoderStatus(): { supported: boolean, state: string, format: string } {
    return {
      supported: this.opusEncoder?.isOpusSupported() || false,
      state: this.opusEncoder?.getState() || 'uninitialized',
      format: this.useOpusEncoding ? 'opus' : 'pcm'
    }
  }
}

// Create singleton instance
export const audioRecordingService = new AudioRecordingService()
