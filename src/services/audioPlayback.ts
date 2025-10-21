import {audioPlaybackConfig} from '@/config/websocket'
import {errorHandler} from '@/utils/errorHandler'
import {lipSyncService} from '@/utils/lipSync'
import {WebCodecsAudioDecoder} from './webCodecsDecoder'

/**
 * Audio Playback Service for TTS
 * Handles OPUS-encoded audio playback from server
 * Supports both container formats (OGG/WebM) and raw OPUS frames
 *
 * Architecture: Dual-Queue with Async Decode Pipeline
 * - Encoded Queue: Raw OPUS data from server
 * - Decoded Queue: PCM AudioBuffer ready for playback
 * - Background decoder: Continuously decodes from encoded to decoded queue
 */
export class AudioPlaybackService {
    private audioContext: AudioContext | null = null

    // Dual-queue architecture
    private encodedQueue: ArrayBuffer[] = []        // Raw OPUS data
    private decodedQueue: AudioBuffer[] = []        // Ready-to-play concatenated audio chunks

    private isPlaying = false
    private currentSource: AudioBufferSourceNode | null = null
    private onPlayCallback: (() => void) | null = null
    private onEndCallback: (() => void) | null = null

    // WebCodecs decoder for OPUS frames
    private webCodecsDecoder: WebCodecsAudioDecoder | null = null

    // Async decode pipeline control
    private isDecoding = false                      // Decode pipeline active
    private shouldStopDecoding = false              // Signal to stop decode pipeline

    // Audio scheduling for seamless playback
    private nextStartTime = 0  // Next audio chunk start time in AudioContext time
    private scheduleAheadTime = 0.1  // Schedule 100ms ahead for balance between responsiveness and stability

    // Buffering configuration (Optimized for smooth streaming)
    // Key: Large concatenation for smooth playback + deep buffer for continuous decode
    private bufferConfig = {
        // Encoded queue thresholds
        encodedMinChunks: 15,       // Moderate threshold to start decoding
        encodedMaxChunks: 100,      // Larger capacity for incoming data

        // Decoded queue thresholds (stores large concatenated chunks)
        decodedMinChunks: 2,        // Start quickly with just 2 ready chunks
        decodedMaxChunks: 8,        // Moderate capacity (each chunk is large)

        minBytes: 12288,            // 12 KB minimum buffer
        timeoutMs: 600,             // Quick start timeout
        rebufferThreshold: 1,       // Trigger decode pipeline early

        // Concatenation settings - LARGE batches for fewer playback switches
        chunksPerConcatenation: 25  // Large batch = smoother playback
    }
    private bufferTimeout: ReturnType<typeof setTimeout> | null = null
    private isBuffering = false

    // Playback statistics
    private playbackStats = {
        totalEncodedChunks: 0,
        totalDecodedChunks: 0,
        successfulDecodes: 0,
        failedDecodes: 0,
        totalBytes: 0,
        totalDuration: 0,
        // NEW: Performance monitoring
        stutterCount: 0,              // Number of times playback paused for rebuffering
        lastStutterTime: 0,           // Timestamp of last stutter
        avgDecodeTime: 0,             // Average decode time per chunk
        avgConcatCount: 0,            // Average buffers concatenated per playback
        totalPlaybackCalls: 0         // Total number of playNext calls
    }

    /**
     * Initialize audio playback
     */
    async initialize(): Promise<void> {
        try {
            // Create audio context
            // NOTE: Don't specify sampleRate - let AudioContext use hardware's native rate
            // This allows it to handle any sample rate from the decoder (16k, 24k, 48kHz, etc.)
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

            const sampleRate = this.audioContext.sampleRate
            console.log(`✅ AudioContext created with sample rate: ${sampleRate}Hz`)

            // Dynamic buffer adjustment based on sample rate
            // Strategy: Larger concatenation batches for smoother playback
            if (sampleRate >= 48000) {
                // 48kHz - Use default optimized config
                console.log('📊 Using 48kHz-optimized buffer configuration')
            } else if (sampleRate >= 24000) {
                // 24kHz - Medium adjustments
                this.bufferConfig.decodedMinChunks = 2
                this.bufferConfig.decodedMaxChunks = 6
                this.bufferConfig.rebufferThreshold = 1
                this.bufferConfig.chunksPerConcatenation = 20
                console.log('📊 Adjusted buffer configuration for 24kHz playback')
            } else {
                // 16kHz - Smaller batches acceptable
                this.bufferConfig.decodedMinChunks = 2
                this.bufferConfig.decodedMaxChunks = 5
                this.bufferConfig.rebufferThreshold = 1
                this.bufferConfig.chunksPerConcatenation = 15
                console.log('📊 Adjusted buffer configuration for 16kHz playback')
            }

            console.log('🔧 Active buffer config:', {
                decodedMinChunks: this.bufferConfig.decodedMinChunks,
                decodedMaxChunks: this.bufferConfig.decodedMaxChunks,
                rebufferThreshold: this.bufferConfig.rebufferThreshold
            })

            // Initialize WebCodecs decoder
            // Pass expected sampleRate for reference, but decoder will auto-detect from stream
            this.webCodecsDecoder = new WebCodecsAudioDecoder(
                audioPlaybackConfig.sampleRate,
                1 // mono
            )
            await this.webCodecsDecoder.initialize()
            console.log('✅ WebCodecs AudioDecoder initialized')

            console.log('✅ Audio playback initialized')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            errorHandler.showErrorMessage('无法初始化音频播放', errorMessage)
            throw error
        }
    }

    /**
     * Add audio data to encoded queue
     * Triggers async decode pipeline if needed
     */
    async addAudioData(data: ArrayBuffer): Promise<void> {
        if (!this.audioContext) {
            console.warn('Audio context not initialized')
            return
        }

        try {
            // Check max buffer size to prevent memory overflow
            if (this.encodedQueue.length >= this.bufferConfig.encodedMaxChunks) {
                console.warn(`⚠️ Encoded buffer overflow: queue has ${this.encodedQueue.length} chunks (max: ${this.bufferConfig.encodedMaxChunks}), dropping oldest chunk`)
                this.encodedQueue.shift() // Remove oldest chunk
            }

            // Add to encoded queue
            this.encodedQueue.push(data)
            this.playbackStats.totalEncodedChunks++
            this.playbackStats.totalBytes += data.byteLength
            console.log(`📥 Encoded chunk queued: ${data.byteLength} bytes, encoded queue: ${this.encodedQueue.length}, decoded queue: ${this.decodedQueue.length}`)

            // Start async decode pipeline if not already running
            if (!this.isDecoding && this.encodedQueue.length >= this.bufferConfig.encodedMinChunks) {
                console.log('🔄 Starting async decode pipeline...')
                this.startDecodePipeline()
            }

            // Check if we should start playback
            if (!this.isPlaying) {
                if (this.bufferTimeout) {
                    clearTimeout(this.bufferTimeout)
                }

                this.bufferTimeout = setTimeout(() => {
                    console.log(`⏰ Buffer timeout (${this.bufferConfig.timeoutMs}ms), starting playback with ${this.decodedQueue.length} decoded buffers`)
                    this.isBuffering = false
                    this.playNext()
                }, this.bufferConfig.timeoutMs)

            } else {
                // Already playing, check if need to re-buffer
                // IMPROVED: Only warn when queue is low, don't pause playback
                // The playNext() logic will handle low buffers more gracefully
                if (this.decodedQueue.length <= this.bufferConfig.rebufferThreshold && !this.isBuffering) {
                    console.log(`⚠️ Decoded queue low (${this.decodedQueue.length} buffers), decode pipeline should catch up...`)
                }
            }
        } catch (error) {
            console.error('Failed to add audio data:', error)
        }
    }

    /**
     * Async decode pipeline - runs in background
     * Decodes AND concatenates chunks before adding to decoded queue
     * This simplifies playback logic - just take one chunk and play
     */
    private async startDecodePipeline(): Promise<void> {
        if (this.isDecoding) {
            return
        }

        this.isDecoding = true
        this.shouldStopDecoding = false

        console.log('🎬 Decode pipeline started')

        while (!this.shouldStopDecoding) {
            // Check if decoded queue is full - if so, wait briefly
            if (this.decodedQueue.length >= this.bufferConfig.decodedMaxChunks) {
                console.log(`⏸️ Decoded queue full (${this.decodedQueue.length}/${this.bufferConfig.decodedMaxChunks}), waiting...`)
                await new Promise(resolve => setTimeout(resolve, 50))
                continue
            }

            // Check if we have encoded data to process
            if (this.encodedQueue.length === 0) {
                // No encoded data, wait briefly before checking again
                await new Promise(resolve => setTimeout(resolve, 20))
                continue
            }

            // Batch decode and concatenate multiple chunks
            const chunksToProcess = Math.min(
                this.bufferConfig.chunksPerConcatenation,
                this.encodedQueue.length
            )

            console.log(`🔄 Batch processing ${chunksToProcess} encoded chunks...`)

            const decodedBuffers: AudioBuffer[] = []

            // Decode all chunks in the batch
            for (let i = 0; i < chunksToProcess; i++) {
                const encodedData = this.encodedQueue.shift()
                if (!encodedData) break

                try {
                    const audioBuffer = await this.decodeWithWebCodecs(encodedData)
                    decodedBuffers.push(audioBuffer)
                    this.playbackStats.successfulDecodes++
                } catch (decodeError) {
                    console.error('❌ WebCodecs decode failed:', decodeError)
                    this.playbackStats.failedDecodes++
                }
            }

            if (decodedBuffers.length === 0) {
                console.warn('⚠️ No buffers decoded in batch, continuing...')
                continue
            }

            // Concatenate all decoded buffers into one seamless chunk
            const concatenatedBuffer = this.concatenateAudioBuffers(decodedBuffers)

            if (concatenatedBuffer) {
                // Add concatenated buffer to decoded queue (ready to play)
                this.decodedQueue.push(concatenatedBuffer)
                this.playbackStats.totalDecodedChunks++
                this.playbackStats.totalDuration += concatenatedBuffer.duration

                console.log(`✅ Batch decoded and concatenated: ${decodedBuffers.length} chunks → ${concatenatedBuffer.duration.toFixed(3)}s, decoded queue: ${this.decodedQueue.length}`)

                // If playback is waiting, trigger it
                if (!this.isPlaying && this.decodedQueue.length >= this.bufferConfig.decodedMinChunks) {
                    console.log('🎵 Ready-to-play buffer available, triggering playback')
                    this.isBuffering = false
                    if (this.bufferTimeout) {
                        clearTimeout(this.bufferTimeout)
                        this.bufferTimeout = null
                    }
                    this.playNext()
                }
            }

            // Small yield to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 0))
        }

        this.isDecoding = false
        console.log('🛑 Decode pipeline stopped')
    }

    /**
     * Concatenate multiple AudioBuffers into a single AudioBuffer
     * This creates a seamless audio stream from individual chunks
     */
    private concatenateAudioBuffers(buffers: AudioBuffer[]): AudioBuffer | null {
        if (!this.audioContext || buffers.length === 0) {
            return null
        }

        // All buffers should have the same sample rate and number of channels
        const sampleRate = buffers[0].sampleRate
        const numberOfChannels = buffers[0].numberOfChannels

        // Calculate total length
        const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)

        // Create new buffer with total length
        const concatenated = this.audioContext.createBuffer(
            numberOfChannels,
            totalLength,
            sampleRate
        )

        // Copy data from each buffer
        let offset = 0
        for (const buffer of buffers) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const channelData = buffer.getChannelData(channel)
                concatenated.getChannelData(channel).set(channelData, offset)
            }
            offset += buffer.length
        }

        const totalDuration = totalLength / sampleRate
        console.log(`🔗 Concatenated ${buffers.length} buffers into ${totalDuration.toFixed(3)}s audio`)

        return concatenated
    }

    /**
     * Play next audio buffer from decoded queue
     * Uses setTimeout to schedule next chunk BEFORE current ends (avoiding onended delay)
     */
    private async playNext(): Promise<void> {
        if (!this.audioContext) {
            this.isPlaying = false
            this.onEndCallback?.()
            return
        }

        // Check if we have audio to play
        if (this.decodedQueue.length === 0) {
            console.log('📭 Decoded queue empty, waiting for more data or ending...')

            // Wait a bit to see if finishStream() or decode pipeline adds more data
            setTimeout(() => {
                if (this.decodedQueue.length > 0 && this.isPlaying) {
                    console.log('🔄 New data arrived, resuming playback')
                    this.playNext()
                } else {
                    console.log('🛑 No more data, stopping playback')
                    this.isPlaying = false
                    this.nextStartTime = 0
                    this.onEndCallback?.()
                }
            }, 50)
            return
        }

        this.isPlaying = true
        this.playbackStats.totalPlaybackCalls++

        try {
            // Take one ready-to-play chunk (already concatenated in decode pipeline)
            const audioBuffer = this.decodedQueue.shift()!

            console.log(`🎵 Playing chunk: ${audioBuffer.duration.toFixed(3)}s, ${this.decodedQueue.length} remaining`)

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume()
            }

            // Create audio source
            this.currentSource = this.audioContext.createBufferSource()
            this.currentSource.buffer = audioBuffer

            // Connect to lip sync analyzer
            const analyser = this.audioContext.createAnalyser()
            this.currentSource.connect(analyser)
            analyser.connect(this.audioContext.destination)

            // Setup lip sync
            this.setupLipSyncForPlayback(analyser)

            // Calculate start time for seamless playback
            const currentTime = this.audioContext.currentTime

            // If this is the first chunk or playback has stopped, start immediately
            if (this.nextStartTime === 0 || this.nextStartTime < currentTime) {
                this.nextStartTime = currentTime + this.scheduleAheadTime
            }

            // Calculate when to schedule next chunk (before current chunk ends)
            const chunkDuration = audioBuffer.duration
            const scheduleNextDelay = Math.max(0, (chunkDuration - this.scheduleAheadTime) * 1000)

            // Schedule next playNext() call BEFORE current chunk ends
            const scheduleTimer = setTimeout(() => {
                console.log('⏰ Pre-scheduling triggered, checking queue...')

                // Check if data is available
                if (this.decodedQueue.length > 0) {
                    console.log('✅ Data ready, calling playNext()')
                    this.playNext()
                } else if (this.encodedQueue.length > 0 || this.isDecoding) {
                    // Data might be coming, wait a bit longer
                    console.log('⏳ Waiting for decode pipeline to catch up...')
                    setTimeout(() => {
                        if (this.decodedQueue.length > 0) {
                            console.log('✅ Data arrived after waiting, calling playNext()')
                            this.playNext()
                        } else {
                            console.log('🛑 No more data after waiting, stopping')
                            this.isPlaying = false
                            this.nextStartTime = 0
                            this.onEndCallback?.()
                        }
                    }, 100)
                } else {
                    console.log('🏁 Stream complete, stopping')
                    this.isPlaying = false
                    this.nextStartTime = 0
                    this.onEndCallback?.()
                }
            }, scheduleNextDelay)

            // Cleanup on end (but DON'T call playNext here to avoid race)
            this.currentSource.addEventListener('ended', () => {
                clearTimeout(scheduleTimer)
                this.currentSource = null
                console.log('✅ Chunk finished and cleaned up')
            }, { once: true })

            // Start playback at scheduled time
            this.currentSource.start(this.nextStartTime)
            this.onPlayCallback?.()

            // Update next start time for the NEXT chunk
            this.nextStartTime += audioBuffer.duration

            console.log(`🔊 Started at ${(this.nextStartTime - audioBuffer.duration).toFixed(3)}s, next at ${this.nextStartTime.toFixed(3)}s, will call playNext() in ${scheduleNextDelay.toFixed(0)}ms`)
        } catch (error) {
            console.error('❌ Error in playNext:', error)
            // Wait a bit and try again
            setTimeout(() => {
                if (this.decodedQueue.length > 0) {
                    this.playNext()
                }
            }, 50)
        }
    }

    /**
     * Decode audio using WebCodecs AudioDecoder (for raw OPUS frames)
     */
    private async decodeWithWebCodecs(audioData: ArrayBuffer): Promise<AudioBuffer> {
        if (!this.webCodecsDecoder || !this.audioContext) {
            throw new Error('WebCodecs decoder or AudioContext not available')
        }

        return new Promise((resolve, reject) => {
            let resolved = false
            const timestamp = performance.now() * 1000 // Convert to microseconds

            // Set up one-time frame handler
            this.webCodecsDecoder!.setOnFrameDecoded(async (audioDataFrame: AudioData) => {
                if (resolved) {
                    audioDataFrame.close()
                    return
                }

                try {
                    // Convert AudioData to AudioBuffer
                    const audioBuffer = await this.webCodecsDecoder!.audioDataToAudioBuffer(
                        audioDataFrame,
                        this.audioContext!
                    )

                    // Close the frame to free memory
                    audioDataFrame.close()

                    resolved = true
                    resolve(audioBuffer)
                } catch (error) {
                    audioDataFrame.close()
                    if (!resolved) {
                        resolved = true
                        reject(error)
                    }
                }
            })

            // Set up error handler
            this.webCodecsDecoder!.setOnError((error: Error) => {
                if (!resolved) {
                    resolved = true
                    reject(error)
                }
            })

            // Start decoding
            this.webCodecsDecoder!.decode(audioData, timestamp)
                .catch(error => {
                    if (!resolved) {
                        resolved = true
                        reject(error)
                    }
                })

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!resolved) {
                    resolved = true
                    reject(new Error('WebCodecs decode timeout after 5s'))
                }
            }, 5000)
        })
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
     * Stop playback and decode pipeline
     */
    stop(): void {
        // Stop decode pipeline
        this.shouldStopDecoding = true

        if (this.currentSource) {
            try {
                this.currentSource.stop()
                this.currentSource = null
            } catch (error) {
                console.warn('Error stopping audio source:', error)
            }
        }

        // Clear buffer timeout
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout)
            this.bufferTimeout = null
        }

        // Clear queues and reset timing
        this.encodedQueue = []
        this.decodedQueue = []
        this.isPlaying = false
        this.isDecoding = false
        this.nextStartTime = 0  // Reset timing for next playback session

        // Stop lip sync
        lipSyncService.stopLipSync()

        console.log('🛑 Playback and decode pipeline stopped')
    }

    /**
     * Clear both audio queues
     */
    clearQueue(): void {
        this.encodedQueue = []
        this.decodedQueue = []
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout)
            this.bufferTimeout = null
        }
        console.log('🧹 Audio queues cleared (encoded + decoded)')
    }

    /**
     * Finish audio stream - process any remaining encoded chunks
     * Call this when the audio stream has ended to ensure all data is decoded and played
     */
    async finishStream(): Promise<void> {
        console.log(`🏁 Finishing stream with ${this.encodedQueue.length} remaining encoded chunks`)

        // If there are remaining encoded chunks, process them
        if (this.encodedQueue.length > 0) {
            console.log(`🔄 Processing ${this.encodedQueue.length} remaining chunks...`)

            const decodedBuffers: AudioBuffer[] = []

            // Decode all remaining chunks
            while (this.encodedQueue.length > 0) {
                const encodedData = this.encodedQueue.shift()
                if (!encodedData) break

                try {
                    const audioBuffer = await this.decodeWithWebCodecs(encodedData)
                    decodedBuffers.push(audioBuffer)
                    this.playbackStats.successfulDecodes++
                } catch (decodeError) {
                    console.error('❌ Failed to decode remaining chunk:', decodeError)
                    this.playbackStats.failedDecodes++
                }
            }

            // If we decoded anything, concatenate and add to queue
            if (decodedBuffers.length > 0) {
                const concatenatedBuffer = this.concatenateAudioBuffers(decodedBuffers)

                if (concatenatedBuffer) {
                    this.decodedQueue.push(concatenatedBuffer)
                    this.playbackStats.totalDecodedChunks++
                    this.playbackStats.totalDuration += concatenatedBuffer.duration

                    console.log(`✅ Final batch: ${decodedBuffers.length} chunks → ${concatenatedBuffer.duration.toFixed(3)}s`)

                    // If not playing, start playback
                    // If already playing, the pre-schedule mechanism will pick it up
                    if (!this.isPlaying && this.decodedQueue.length > 0) {
                        console.log('🎵 Starting playback of final chunks')
                        this.playNext()
                    } else if (this.isPlaying) {
                        console.log('🎵 Final chunk added to queue, pre-schedule will play it')
                    }
                }
            }
        }

        console.log(`✅ Stream finished, ${this.decodedQueue.length} chunks ready for playback`)
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

        // Close WebCodecs decoder
        if (this.webCodecsDecoder) {
            this.webCodecsDecoder.close()
            this.webCodecsDecoder = null
        }

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
        return this.decodedQueue.length
    }

    /**
     * Get encoded queue length
     */
    getEncodedQueueLength(): number {
        return this.encodedQueue.length
    }

    /**
     * Get decoded queue length
     */
    getDecodedQueueLength(): number {
        return this.decodedQueue.length
    }

    /**
     * Get audio context state
     */
    getAudioContextState(): AudioContextState | null {
        return this.audioContext?.state || null
    }

    /**
     * Get playback statistics for debugging
     */
    getPlaybackStats() {
        const encodedBytes = this.encodedQueue.reduce((sum, chunk) => sum + chunk.byteLength, 0)

        return {
            ...this.playbackStats,
            encodedQueueLength: this.encodedQueue.length,
            decodedQueueLength: this.decodedQueue.length,
            encodedQueueBytes: encodedBytes,
            isPlaying: this.isPlaying,
            isDecoding: this.isDecoding,
            isBuffering: this.isBuffering,
            audioContextState: this.audioContext?.state,
            bufferConfig: {...this.bufferConfig},
            decodeSuccessRate: this.playbackStats.totalEncodedChunks > 0
                ? (this.playbackStats.successfulDecodes / this.playbackStats.totalEncodedChunks * 100).toFixed(1) + '%'
                : '0%',
            // NEW: Performance metrics
            stutterRate: this.playbackStats.totalPlaybackCalls > 0
                ? (this.playbackStats.stutterCount / this.playbackStats.totalPlaybackCalls * 100).toFixed(1) + '%'
                : '0%',
            avgConcatCount: this.playbackStats.avgConcatCount.toFixed(2),
            timeSinceLastStutter: this.playbackStats.lastStutterTime > 0
                ? ((Date.now() - this.playbackStats.lastStutterTime) / 1000).toFixed(1) + 's'
                : 'N/A'
        }
    }

    /**
     * Get buffer configuration
     */
    getBufferConfig() {
        return {...this.bufferConfig}
    }

    /**
     * Update buffer configuration
     */
    setBufferConfig(config: Partial<typeof this.bufferConfig>): void {
        this.bufferConfig = {
            ...this.bufferConfig,
            ...config
        }
        console.log('🔧 Buffer configuration updated:', this.bufferConfig)
    }

    /**
     * Reset playback statistics
     */
    resetStats() {
        this.playbackStats = {
            totalEncodedChunks: 0,
            totalDecodedChunks: 0,
            successfulDecodes: 0,
            failedDecodes: 0,
            totalBytes: 0,
            totalDuration: 0,
            stutterCount: 0,
            lastStutterTime: 0,
            avgDecodeTime: 0,
            avgConcatCount: 0,
            totalPlaybackCalls: 0
        }
        console.log('📊 Playback statistics reset')
    }
}

// Create singleton instance
export const audioPlaybackService = new AudioPlaybackService()
