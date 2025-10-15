import { audioPlaybackConfig } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'
import { lipSyncService } from '@/utils/lipSync'

/**
 * Audio Playback Service for TTS
 * Handles OPUS-encoded audio playback from server
 */
export class AudioPlaybackService {
  private audioContext: AudioContext | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null
  private onPlayCallback: (() => void) | null = null
  private onEndCallback: (() => void) | null = null

  /**
   * Initialize audio playback
   */
  async initialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: audioPlaybackConfig.sampleRate
      })

      console.log('✅ Audio playback initialized')
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorHandler.showErrorMessage('无法初始化音频播放', errorMessage)
      throw error
    }
  }

  /**
   * Add audio data to playback queue
   */
  async addAudioData(data: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      console.warn('Audio context not initialized')
      return
    }

    try {
      // Add to queue
      this.audioQueue.push(data)

      // Start playback if not already playing
      if (!this.isPlaying) {
        await this.playNext()
      }
    }
    catch (error) {
      console.error('Failed to add audio data:', error)
    }
  }

  /**
   * Play next audio buffer from queue
   */
  private async playNext(): Promise<void> {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false
      this.onEndCallback?.()
      return
    }

    this.isPlaying = true

    try {
      const audioData = this.audioQueue.shift()!

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Decode audio data
      // Note: Browser expects the server to send OPUS data in a container format
      // (like WebM or OGG) that browsers can decode, or raw PCM data
      let audioBuffer: AudioBuffer

      try {
        // Try to decode as encoded audio (OPUS in WebM/OGG container)
        audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0))
      }
      catch (decodeError) {
        // If decoding fails, try to use as raw PCM data
        console.warn('Failed to decode as encoded audio, trying PCM')
        audioBuffer = await this.decodePCMAudio(audioData)
      }

      // Create audio source
      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer

      // Connect to lip sync analyzer
      const analyser = this.audioContext.createAnalyser()
      this.currentSource.connect(analyser)
      analyser.connect(this.audioContext.destination)

      // Setup lip sync with analyser
      this.setupLipSyncForPlayback(analyser)

      // Setup playback end handler
      this.currentSource.onended = () => {
        this.currentSource = null
        this.playNext()
      }

      // Start playback
      this.currentSource.start()
      this.onPlayCallback?.()

      console.log('🔊 Playing audio buffer')
    }
    catch (error) {
      console.error('Failed to play audio:', error)
      this.isPlaying = false
      this.onEndCallback?.()
    }
  }

  /**
   * Decode raw PCM audio data
   */
  private async decodePCMAudio(data: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized')
    }

    // Convert ArrayBuffer to Int16Array (assuming PCM 16-bit)
    const pcmData = new Int16Array(data)

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      audioPlaybackConfig.channels,
      pcmData.length,
      audioPlaybackConfig.sampleRate
    )

    // Convert PCM Int16 to Float32 and fill buffer
    const channelData = audioBuffer.getChannelData(0)
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0 // Normalize to -1.0 to 1.0
    }

    return audioBuffer
  }

  /**
   * Setup lip sync for audio playback
   */
  private setupLipSyncForPlayback(analyser: AnalyserNode): void {
    // Configure lip sync service to use this analyser
    // Note: This requires modifying lipSync service to accept external analyser
    // For now, we'll trigger lip sync start/stop
    lipSyncService.startLipSync()
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
        this.currentSource = null
      }
      catch (error) {
        console.warn('Error stopping audio source:', error)
      }
    }

    // Clear queue
    this.audioQueue = []
    this.isPlaying = false

    // Stop lip sync
    lipSyncService.stopLipSync()

    console.log('🛑 Playback stopped')
  }

  /**
   * Clear audio queue
   */
  clearQueue(): void {
    this.audioQueue = []
    console.log('🧹 Audio queue cleared')
  }

  /**
   * Set playback callbacks
   */
  setCallbacks(onPlay?: () => void, onEnd?: () => void): void {
    this.onPlayCallback = onPlay || null
    this.onEndCallback = onEnd || null
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop()

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('🧹 Audio playback resources disposed')
  }

  /**
   * Check if playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.audioQueue.length
  }

  /**
   * Get audio context state
   */
  getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state || null
  }
}

// Create singleton instance
export const audioPlaybackService = new AudioPlaybackService()
