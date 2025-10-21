import { audioRecordingConfig } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'
import { OpusEncoder } from './opusEncoder'

/**
 * Audio Recording Service with OPUS encoding support
 *
 * Features:
 * - WebCodecs API for raw OPUS frames (no container) - RECOMMENDED
 * - MediaRecorder API for Opus in OGG container (fallback)
 * - PCM fallback for unsupported browsers
 * - Automatic format detection and switching
 */
export class AudioRecordingService {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isRecording = false
  private onDataCallback: ((data: ArrayBuffer) => void) | null = null
  private useMediaRecorder = false
  private opusEncoder: OpusEncoder | null = null
  private useWebCodecs = false

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

      // Priority 1: Try WebCodecs OPUS encoder (raw OPUS frames, no container)
      this.opusEncoder = new OpusEncoder()
      if (this.opusEncoder.isOpusSupported()) {
        console.log('✅ WebCodecs OPUS encoder available - will use raw OPUS frames')
        this.useWebCodecs = true
      }

      // Priority 2: Fallback to MediaRecorder if WebCodecs not available
      if (!this.useWebCodecs) {
        this.useMediaRecorder = this.checkOpusSupport()
      }

      // Priority 3: Setup PCM recording if neither WebCodecs nor MediaRecorder available
      if (!this.useWebCodecs && !this.useMediaRecorder) {
        console.log('⚠️ WebCodecs and MediaRecorder OPUS not available, using PCM fallback')
      }

      // Always setup AudioContext for PCM capture (needed for WebCodecs encoding)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: audioRecordingConfig.sampleRate
      })

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream)

      const bufferSize = Math.pow(2, Math.ceil(Math.log2(
        audioRecordingConfig.sampleRate * audioRecordingConfig.frameDuration / 1000
      )))

      this.scriptProcessor = this.audioContext.createScriptProcessor(
        bufferSize,
        audioRecordingConfig.channels,
        audioRecordingConfig.channels
      )

      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.isRecording) {
          this.processAudioData(event.inputBuffer)
        }
      }

      this.mediaStreamSource.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      const mode = this.useWebCodecs
        ? 'WebCodecs (Raw OPUS frames)'
        : this.useMediaRecorder
          ? 'MediaRecorder (OPUS/OGG container)'
          : 'AudioContext (PCM)'

      console.log('✅ Audio recording initialized:', mode)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorHandler.showErrorMessage('无法初始化音频录制', errorMessage)
      throw error
    }
  }

  /**
   * Check if MediaRecorder supports Opus in OGG container
   */
  private checkOpusSupport(): boolean {
    if (typeof MediaRecorder === 'undefined') {
      console.warn('⚠️ MediaRecorder API not supported')
      return false
    }

    // Check for audio/ogg;codecs=opus support
    const mimeTypes = [
      'audio/ogg;codecs=opus',
      'audio/webm;codecs=opus',
      'audio/opus'
    ]

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log('✅ Supported MIME type:', mimeType)
        return true
      }
    }

    console.warn('⚠️ No Opus MIME types supported, falling back to PCM')
    return false
  }

  /**
   * Start recording
   */
  async startRecording(onData: (data: ArrayBuffer) => void): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording')
      return
    }

    this.onDataCallback = onData
    this.isRecording = true

    // Priority 1: Use WebCodecs OPUS encoder (raw OPUS frames)
    if (this.useWebCodecs && this.opusEncoder) {
      const encoderReady = await this.opusEncoder.initialize((data: Uint8Array) => {
        console.log(`🎵 Raw OPUS frame: ${data.byteLength} bytes`)
        if (this.onDataCallback) {
          // Convert Uint8Array to ArrayBuffer
          this.onDataCallback(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
        }
      })

      if (!encoderReady) {
        console.warn('⚠️ WebCodecs encoder failed to initialize, falling back')
        this.useWebCodecs = false
      }
      else {
        console.log('🎤 Recording started with WebCodecs OPUS encoder (Raw OPUS frames)')

        // Start AudioContext if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }
        return
      }
    }

    // Priority 2: Use MediaRecorder for Opus in OGG container (fallback)
    if (this.useMediaRecorder && this.mediaStream) {
      const mimeType = this.getSupportedMimeType()
      console.log('🎵 Using MediaRecorder with MIME type:', mimeType)

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 16000 // 16 kbps for voice
      })

      // Collect audio data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert Blob to ArrayBuffer
          event.data.arrayBuffer().then((buffer) => {
            console.log(`🎵 Opus/OGG chunk: ${buffer.byteLength} bytes`)
            console.warn('⚠️ Sending OPUS in container format - server may have decode issues!')
            if (this.onDataCallback) {
              this.onDataCallback(buffer)
            }
          })
        }
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event)
      }

      // Start recording with small time slices (60ms)
      this.mediaRecorder.start(audioRecordingConfig.frameDuration)
      console.log('🎤 Recording started with MediaRecorder (Opus/OGG container)')
    }
    // Priority 3: Use AudioContext for PCM (final fallback)
    else {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      console.log('🎤 Recording started with AudioContext (PCM)')
    }
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/ogg;codecs=opus',
      'audio/webm;codecs=opus',
      'audio/opus'
    ]

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }

    throw new Error('No supported MIME type found')
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return
    }

    this.isRecording = false

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.mediaRecorder = null
    }

    this.onDataCallback = null
    console.log('🛑 Recording stopped')
  }

  /**
   * Process audio data (used for both WebCodecs encoding and PCM fallback)
   */
  private processAudioData(buffer: AudioBuffer): void {
    if (!this.onDataCallback) {
      return
    }

    try {
      const channelData = buffer.getChannelData(0)

      // Priority 1: Use WebCodecs OPUS encoder
      if (this.useWebCodecs && this.opusEncoder) {
        // Encode PCM data to OPUS
        const timestamp = performance.now()
        this.opusEncoder.encode(channelData, timestamp)
        // Encoded data will be sent via the callback set in startRecording
        return
      }

      // Priority 2: Send raw PCM data (fallback)
      const pcmData = this.float32ToInt16(channelData)
      console.log(`📊 Sending PCM data: ${pcmData.byteLength} bytes`)
      this.onDataCallback(pcmData.buffer)
    }
    catch (error) {
      console.error('❌ Failed to process audio data:', error)
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

    if (this.opusEncoder) {
      this.opusEncoder.close()
      this.opusEncoder = null
    }

    if (this.mediaRecorder) {
      this.mediaRecorder = null
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
   * Check if using Opus encoding
   */
  isUsingOpus(): boolean {
    return this.useWebCodecs || this.useMediaRecorder
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
    const format = this.useWebCodecs
      ? 'webcodecs-opus (raw frames)'
      : this.useMediaRecorder
        ? 'mediarecorder-opus (container)'
        : 'pcm'

    return {
      supported: this.useWebCodecs || this.useMediaRecorder,
      state: this.isRecording ? 'recording' : 'inactive',
      format
    }
  }
}

// Create singleton instance
export const audioRecordingService = new AudioRecordingService()
