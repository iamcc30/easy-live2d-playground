import { audioRecordingConfig } from '@/config/websocket'

/**
 * OPUS Audio Encoder using WebCodecs API
 *
 * This encoder uses the modern WebCodecs API for efficient OPUS encoding.
 * Fallback to PCM if WebCodecs is not available.
 *
 * Browser support:
 * - Chrome 94+
 * - Edge 94+
 * - Opera 80+
 * - Safari: WebCodecs support experimental
 */
export class OpusEncoder {
  private encoder: AudioEncoder | null = null
  private isSupported = false
  private onDataCallback: ((data: Uint8Array) => void) | null = null
  private pendingChunks: EncodedAudioChunk[] = []

  constructor() {
    this.checkSupport()
  }

  /**
   * Check if WebCodecs API is supported
   */
  private checkSupport(): void {
    this.isSupported = typeof AudioEncoder !== 'undefined'
      && 'isConfigSupported' in AudioEncoder

    if (!this.isSupported) {
      console.warn('⚠️ WebCodecs API not supported, will use PCM fallback')
    }
  }

  /**
   * Initialize OPUS encoder
   */
  async initialize(onData: (data: Uint8Array) => void): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Using PCM fallback mode')
      return false
    }

    this.onDataCallback = onData

    try {
      // Configure OPUS encoder
      const config: AudioEncoderConfig = {
        codec: 'opus',
        sampleRate: audioRecordingConfig.sampleRate,
        numberOfChannels: audioRecordingConfig.channels,
        bitrate: 24000, // 24 kbps for voice
        opus: {
          frameDuration: audioRecordingConfig.frameDuration * 1000, // Convert to microseconds
          complexity: 5, // 0-10, higher = better quality but slower
          packetlossperc: 0,
          usedtx: false, // Discontinuous transmission
          useinbandfec: true // Forward error correction
        }
      }

      // Check if configuration is supported
      const support = await AudioEncoder.isConfigSupported(config)
      if (!support.supported) {
        console.warn('⚠️ OPUS configuration not supported:', support)
        return false
      }

      // Create encoder
      this.encoder = new AudioEncoder({
        output: this.handleEncodedChunk.bind(this),
        error: this.handleError.bind(this)
      })

      this.encoder.configure(config)
      console.log('✅ OPUS encoder initialized')
      return true
    }
    catch (error) {
      console.error('Failed to initialize OPUS encoder:', error)
      return false
    }
  }

  /**
   * Encode audio data
   */
  encode(audioData: Float32Array, timestamp: number): void {
    if (!this.encoder || this.encoder.state !== 'configured') {
      console.warn('Encoder not initialized')
      return
    }

    try {
      // Create AudioData from Float32Array
      const audioDataChunk = new AudioData({
        format: 'f32-planar',
        sampleRate: audioRecordingConfig.sampleRate,
        numberOfFrames: audioData.length,
        numberOfChannels: audioRecordingConfig.channels,
        timestamp: timestamp * 1000, // Convert to microseconds
        data: audioData
      })

      this.encoder.encode(audioDataChunk)
      audioDataChunk.close()
    }
    catch (error) {
      console.error('Failed to encode audio:', error)
    }
  }

  /**
   * Handle encoded audio chunk
   */
  private handleEncodedChunk(chunk: EncodedAudioChunk): void {
    try {
      // Copy chunk data to Uint8Array
      const buffer = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buffer)

      // Send to callback
      if (this.onDataCallback) {
        this.onDataCallback(buffer)
      }
    }
    catch (error) {
      console.error('Failed to handle encoded chunk:', error)
    }
  }

  /**
   * Handle encoder error
   */
  private handleError(error: Error): void {
    console.error('OPUS encoder error:', error)
  }

  /**
   * Flush pending data
   */
  async flush(): Promise<void> {
    if (this.encoder && this.encoder.state === 'configured') {
      try {
        await this.encoder.flush()
      }
      catch (error) {
        console.error('Failed to flush encoder:', error)
      }
    }
  }

  /**
   * Close encoder and release resources
   */
  close(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state !== 'closed') {
          this.encoder.close()
        }
      }
      catch (error) {
        console.error('Failed to close encoder:', error)
      }
      this.encoder = null
    }
    this.onDataCallback = null
    this.pendingChunks = []
  }

  /**
   * Check if OPUS encoding is supported
   */
  isOpusSupported(): boolean {
    return this.isSupported
  }

  /**
   * Get encoder state
   */
  getState(): string {
    return this.encoder?.state || 'uninitialized'
  }
}
