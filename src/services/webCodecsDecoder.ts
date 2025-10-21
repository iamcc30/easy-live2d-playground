/**
 * WebCodecs AudioDecoder Service
 * Decodes OPUS audio using native WebCodecs API
 * https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
 */

interface DecodedAudioFrame {
  audioData: AudioData
  timestamp: number
}

export class WebCodecsAudioDecoder {
  private decoder: AudioDecoder | null = null
  private sampleRate: number
  private numberOfChannels: number
  private decodedFrames: AudioData[] = []
  private onFrameDecoded: ((frame: AudioData) => void) | null = null
  private onError: ((error: Error) => void) | null = null

  constructor(sampleRate = 16000, numberOfChannels = 1) {
    this.sampleRate = sampleRate
    this.numberOfChannels = numberOfChannels
  }

  /**
   * Initialize AudioDecoder
   */
  async initialize(): Promise<void> {
    try {
      // Check WebCodecs API support
      if (typeof AudioDecoder === 'undefined') {
        throw new Error('WebCodecs API not supported in this browser')
      }

      // Check OPUS codec support
      // NOTE: sampleRate in config is required by TypeScript but largely ignored by decoder
      // OPUS streams contain their own sample rate info, decoder outputs at original rate
      // Common OPUS rates: 8k, 12k, 16k, 24k, 48kHz
      const config: AudioDecoderConfig = {
        codec: 'opus',
        sampleRate: this.sampleRate,  // Placeholder - actual rate auto-detected from stream
        numberOfChannels: this.numberOfChannels
      }

      console.log('config',  config)

      const support = await AudioDecoder.isConfigSupported(config)
      if (!support.supported) {
        throw new Error('OPUS codec not supported by AudioDecoder')
      }

      console.log('✅ AudioDecoder OPUS support confirmed:', support)

      // Create decoder
      this.decoder = new AudioDecoder({
        output: (audioData: AudioData) => {
          this.handleDecodedFrame(audioData)
        },
        error: (error: DOMException) => {
          console.error('❌ AudioDecoder error:', error)
          this.onError?.(new Error(error.message))
        }
      })

      // Configure decoder
      this.decoder.configure(config)

      console.log('✅ WebCodecs AudioDecoder initialized')
      console.log('   Codec: OPUS')
      console.log('   Sample Rate: Auto-detect from stream')
      console.log('   Channels:', this.numberOfChannels)
    }
    catch (error) {
      console.error('❌ Failed to initialize AudioDecoder:', error)
      throw error
    }
  }

  /**
   * Decode OPUS audio chunk
   * @param opusData Raw OPUS frame data
   * @param timestamp Timestamp in microseconds
   */
  async decode(opusData: ArrayBuffer, timestamp: number = 0): Promise<void> {
    if (!this.decoder) {
      throw new Error('AudioDecoder not initialized')
    }

    if (this.decoder.state === 'closed') {
      throw new Error('AudioDecoder is closed')
    }

    try {
      // Create EncodedAudioChunk for OPUS data
      const chunk = new EncodedAudioChunk({
        type: 'key', // OPUS frames are typically key frames
        timestamp: timestamp,
        data: opusData
      })

      // Decode the chunk
      this.decoder.decode(chunk)

      console.log(`🔄 Decoding OPUS chunk: ${opusData.byteLength} bytes, timestamp: ${timestamp}`)
    }
    catch (error) {
      console.error('❌ Failed to decode OPUS chunk:', error)
      throw error
    }
  }

  /**
   * Handle decoded audio frame
   */
  private handleDecodedFrame(audioData: AudioData): void {
    console.log('✅ Frame decoded:', {
      format: audioData.format,
      sampleRate: audioData.sampleRate,
      numberOfFrames: audioData.numberOfFrames,
      numberOfChannels: audioData.numberOfChannels,
      duration: audioData.duration,
      timestamp: audioData.timestamp
    })

    // Store decoded frame
    this.decodedFrames.push(audioData)

    // Notify callback
    this.onFrameDecoded?.(audioData)
  }

  /**
   * Convert AudioData to AudioBuffer for Web Audio API playback
   */
  async audioDataToAudioBuffer(
    audioData: AudioData,
    audioContext: AudioContext
  ): Promise<AudioBuffer> {
    try {
      const numberOfFrames = audioData.numberOfFrames
      const numberOfChannels = audioData.numberOfChannels
      const sampleRate = audioData.sampleRate

      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        numberOfChannels,
        numberOfFrames,
        sampleRate
      )

      // Copy audio data to buffer
      // AudioData uses planar format, need to copy each channel
      const copyOptions: AudioDataCopyToOptions = {
        planeIndex: 0,
        format: audioData.format as AudioSampleFormat
      }

      for (let channel = 0; channel < numberOfChannels; channel++) {
        copyOptions.planeIndex = channel

        // Allocate buffer for this channel
        const byteLength = audioData.allocationSize(copyOptions)
        const buffer = new ArrayBuffer(byteLength)

        // Copy data
        audioData.copyTo(buffer, copyOptions)

        // Convert to Float32Array for AudioBuffer
        const float32Data = this.convertToFloat32(buffer, audioData.format)
        audioBuffer.copyToChannel(float32Data, channel)
      }

      console.log(`✅ Converted AudioData to AudioBuffer: ${numberOfFrames} frames, ${sampleRate}Hz`)

      return audioBuffer
    }
    catch (error) {
      console.error('❌ Failed to convert AudioData to AudioBuffer:', error)
      throw error
    }
  }

  /**
   * Convert various audio formats to Float32Array
   */
  private convertToFloat32(buffer: ArrayBuffer, format: string): Float32Array {
    switch (format) {
      case 'f32':
      case 'f32-planar':
        return new Float32Array(buffer)

      case 's16':
      case 's16-planar': {
        const int16 = new Int16Array(buffer)
        const float32 = new Float32Array(int16.length)
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0 // Convert to [-1, 1] range
        }
        return float32
      }

      case 's32':
      case 's32-planar': {
        const int32 = new Int32Array(buffer)
        const float32 = new Float32Array(int32.length)
        for (let i = 0; i < int32.length; i++) {
          float32[i] = int32[i] / 2147483648.0 // Convert to [-1, 1] range
        }
        return float32
      }

      case 'u8':
      case 'u8-planar': {
        const uint8 = new Uint8Array(buffer)
        const float32 = new Float32Array(uint8.length)
        for (let i = 0; i < uint8.length; i++) {
          float32[i] = (uint8[i] - 128) / 128.0 // Convert to [-1, 1] range
        }
        return float32
      }

      default:
        throw new Error(`Unsupported audio format: ${format}`)
    }
  }

  /**
   * Flush decoder and wait for all pending frames
   */
  async flush(): Promise<void> {
    if (!this.decoder) {
      return
    }

    try {
      await this.decoder.flush()
      console.log('✅ AudioDecoder flushed')
    }
    catch (error) {
      console.error('❌ Failed to flush AudioDecoder:', error)
      throw error
    }
  }

  /**
   * Get all decoded frames and clear buffer
   */
  getDecodedFrames(): AudioData[] {
    const frames = [...this.decodedFrames]
    this.decodedFrames = []
    return frames
  }

  /**
   * Set callback for decoded frames
   */
  setOnFrameDecoded(callback: (frame: AudioData) => void): void {
    this.onFrameDecoded = callback
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback
  }

  /**
   * Get decoder state
   */
  getState(): string {
    return this.decoder?.state || 'uninitialized'
  }

  /**
   * Close decoder and release resources
   */
  close(): void {
    if (this.decoder && this.decoder.state !== 'closed') {
      // Close all pending AudioData frames
      this.decodedFrames.forEach(frame => frame.close())
      this.decodedFrames = []

      this.decoder.close()
      this.decoder = null

      console.log('🔒 AudioDecoder closed')
    }
  }
}

// Create singleton instance
export const webCodecsDecoder = new WebCodecsAudioDecoder()
