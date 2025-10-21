<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { OpusEncoder } from '@/services/opusEncoder'
import { WebCodecsAudioDecoder } from '@/services/webCodecsDecoder'

const testStatus = ref<string>('准备就绪')
const testLog = ref<string[]>([])
const isRecording = ref(false)
const isPlaying = ref(false)
const encodedChunks = ref<Uint8Array[]>([])
const totalEncodedBytes = ref(0)
const recordingDuration = ref(0)

let opusEncoder: OpusEncoder | null = null
let opusDecoder: WebCodecsAudioDecoder | null = null
let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let scriptProcessor: ScriptProcessorNode | null = null
let mediaStreamSource: MediaStreamAudioSourceNode | null = null
let recordingTimer: ReturnType<typeof setInterval> | null = null

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  testLog.value.push(`[${timestamp}] ${message}`)
  console.log(message)
}

const clearLog = () => {
  testLog.value = []
  testStatus.value = '日志已清空'
}

// 初始化编码器和解码器
const initializeCodecs = async () => {
  try {
    testStatus.value = '初始化编码器和解码器...'
    addLog('🔧 开始初始化 OPUS 编解码器')

    // 初始化编码器
    opusEncoder = new OpusEncoder()
    if (!opusEncoder.isOpusSupported()) {
      throw new Error('浏览器不支持 WebCodecs OPUS 编码')
    }
    addLog('✅ OPUS 编码器可用')

    // 初始化解码器
    opusDecoder = new WebCodecsAudioDecoder(16000, 1)
    await opusDecoder.initialize()
    addLog('✅ OPUS 解码器初始化成功')

    // 初始化音频上下文
    audioContext = new AudioContext({ sampleRate: 16000 })
    addLog(`✅ AudioContext 创建成功: ${audioContext.sampleRate}Hz`)

    testStatus.value = '✅ 编解码器初始化完成'
    addLog('🎉 所有编解码器准备就绪')
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    testStatus.value = `❌ 初始化失败: ${errorMsg}`
    addLog(`❌ 初始化错误: ${errorMsg}`)
    throw error
  }
}

// 开始录音
const startRecording = async () => {
  try {
    testStatus.value = '开始录音...'
    addLog('🎤 准备开始录音')

    // 清空之前的数据
    encodedChunks.value = []
    totalEncodedBytes.value = 0
    recordingDuration.value = 0

    // 请求麦克风权限
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    addLog('✅ 麦克风权限已获取')

    if (!audioContext) {
      await initializeCodecs()
    }

    // 创建音频处理管线
    mediaStreamSource = audioContext!.createMediaStreamSource(mediaStream)
    scriptProcessor = audioContext!.createScriptProcessor(1024, 1, 1)

    // 初始化编码器
    await opusEncoder!.initialize((data: Uint8Array) => {
      // 收集编码后的数据
      encodedChunks.value.push(new Uint8Array(data))
      totalEncodedBytes.value += data.byteLength
      addLog(`📦 收到 OPUS 帧: ${data.byteLength} bytes (总计: ${totalEncodedBytes.value} bytes)`)
    })

    // 处理音频数据
    scriptProcessor.onaudioprocess = (event) => {
      if (isRecording.value) {
        const inputBuffer = event.inputBuffer
        const channelData = inputBuffer.getChannelData(0)
        const timestamp = performance.now()

        // 编码 PCM 数据为 OPUS
        opusEncoder!.encode(channelData, timestamp)
      }
    }

    // 连接音频管线
    mediaStreamSource.connect(scriptProcessor)
    scriptProcessor.connect(audioContext!.destination)

    isRecording.value = true
    testStatus.value = '🔴 正在录音...'
    addLog('🎤 录音已开始')

    // 启动计时器
    recordingTimer = setInterval(() => {
      recordingDuration.value++
    }, 1000)
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    testStatus.value = `❌ 录音失败: ${errorMsg}`
    addLog(`❌ 录音错误: ${errorMsg}`)
  }
}

// 停止录音
const stopRecording = async () => {
  try {
    isRecording.value = false
    testStatus.value = '停止录音...'
    addLog('🛑 停止录音')

    // 清理计时器
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    // 刷新编码器
    if (opusEncoder) {
      await opusEncoder.flush()
      addLog('✅ 编码器已刷新')
    }

    // 停止音频管线
    if (scriptProcessor) {
      scriptProcessor.disconnect()
      scriptProcessor = null
    }
    if (mediaStreamSource) {
      mediaStreamSource.disconnect()
      mediaStreamSource = null
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }

    testStatus.value = `✅ 录音完成: ${encodedChunks.value.length} 个 OPUS 帧, ${totalEncodedBytes.value} bytes, ${recordingDuration.value}s`
    addLog(`✅ 录音完成: ${encodedChunks.value.length} 帧`)
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    testStatus.value = `❌ 停止失败: ${errorMsg}`
    addLog(`❌ 停止错误: ${errorMsg}`)
  }
}

// 下载 OPUS 数据
const downloadOpusData = () => {
  if (encodedChunks.value.length === 0) {
    testStatus.value = '⚠️ 没有可下载的数据'
    return
  }

  try {
    // 合并所有 OPUS 帧
    const totalBytes = encodedChunks.value.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const combined = new Uint8Array(totalBytes)
    let offset = 0

    for (const chunk of encodedChunks.value) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }

    // 创建 Blob 和下载链接
    const blob = new Blob([combined], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `opus-test-${Date.now()}.opus`
    link.click()
    URL.revokeObjectURL(url)

    testStatus.value = `✅ 已下载: ${combined.byteLength} bytes`
    addLog(`📥 已下载 OPUS 数据: ${combined.byteLength} bytes`)
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    testStatus.value = `❌ 下载失败: ${errorMsg}`
    addLog(`❌ 下载错误: ${errorMsg}`)
  }
}

// 播放 OPUS 数据 (解码并播放)
const playOpusData = async () => {
  if (encodedChunks.value.length === 0) {
    testStatus.value = '⚠️ 没有可播放的数据'
    return
  }

  try {
    testStatus.value = '开始解码和播放...'
    addLog('🔊 开始解码 OPUS 数据')
    isPlaying.value = true

    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: 16000 })
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // 解码所有 OPUS 帧
    const decodedBuffers: AudioBuffer[] = []
    let decodedCount = 0

    for (let i = 0; i < encodedChunks.value.length; i++) {
      const chunk = encodedChunks.value[i]
      const timestamp = i * 60000 // 60ms per frame in microseconds

      try {
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          opusDecoder!.setOnFrameDecoded(async (audioData: AudioData) => {
            try {
              const buffer = await opusDecoder!.audioDataToAudioBuffer(audioData, audioContext!)
              audioData.close()
              resolve(buffer)
            }
            catch (error) {
              reject(error)
            }
          })

          opusDecoder!.setOnError((error: Error) => {
            reject(error)
          })

          opusDecoder!.decode(chunk.buffer, timestamp)
        })

        decodedBuffers.push(audioBuffer)
        decodedCount++

        if (decodedCount % 10 === 0) {
          addLog(`🔄 已解码 ${decodedCount}/${encodedChunks.value.length} 帧`)
        }
      }
      catch (error) {
        addLog(`❌ 解码帧 ${i} 失败: ${error}`)
      }
    }

    addLog(`✅ 解码完成: ${decodedBuffers.length}/${encodedChunks.value.length} 帧`)

    // 合并所有解码后的音频
    const totalLength = decodedBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
    const combinedBuffer = audioContext.createBuffer(1, totalLength, 16000)
    const channelData = combinedBuffer.getChannelData(0)

    let offset = 0
    for (const buffer of decodedBuffers) {
      channelData.set(buffer.getChannelData(0), offset)
      offset += buffer.length
    }

    addLog(`🎵 合并音频: ${combinedBuffer.duration.toFixed(2)}s`)

    // 播放音频
    const source = audioContext.createBufferSource()
    source.buffer = combinedBuffer
    source.connect(audioContext.destination)

    source.onended = () => {
      isPlaying.value = false
      testStatus.value = '✅ 播放完成'
      addLog('✅ 播放完成')
    }

    source.start()
    testStatus.value = '🔊 正在播放...'
    addLog('🔊 开始播放')
  }
  catch (error) {
    isPlaying.value = false
    const errorMsg = error instanceof Error ? error.message : String(error)
    testStatus.value = `❌ 播放失败: ${errorMsg}`
    addLog(`❌ 播放错误: ${errorMsg}`)
  }
}

// 停止播放
const stopPlayback = () => {
  if (audioContext) {
    audioContext.suspend()
  }
  isPlaying.value = false
  testStatus.value = '⏸️ 播放已停止'
  addLog('⏸️ 播放已停止')
}

// 清理资源
const cleanup = () => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }

  if (opusEncoder) {
    opusEncoder.close()
    opusEncoder = null
  }

  if (opusDecoder) {
    opusDecoder.close()
    opusDecoder = null
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close()
    audioContext = null
  }

  testStatus.value = '🧹 资源已清理'
  addLog('🧹 所有资源已清理')
}

onMounted(() => {
  addLog('🚀 OPUS 测试组件已加载')
})
</script>

<template>
  <div class="opus-test-container">
    <div class="test-header">
      <h2>🎵 OPUS 编解码测试</h2>
      <p class="test-description">
        测试音频录制 → OPUS 编码 → 保存 → OPUS 解码 → 播放的完整流程
      </p>
    </div>

    <div class="test-status" :class="{
      'status-error': testStatus.includes('❌'),
      'status-success': testStatus.includes('✅'),
      'status-recording': isRecording,
      'status-playing': isPlaying
    }">
      {{ testStatus }}
    </div>

    <div class="test-info">
      <div class="info-item">
        <span class="info-label">编码帧数:</span>
        <span class="info-value">{{ encodedChunks.length }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">数据大小:</span>
        <span class="info-value">{{ totalEncodedBytes }} bytes</span>
      </div>
      <div class="info-item">
        <span class="info-label">录音时长:</span>
        <span class="info-value">{{ recordingDuration }}s</span>
      </div>
    </div>

    <div class="test-controls">
      <div class="control-group">
        <h3>1️⃣ 初始化</h3>
        <button @click="initializeCodecs" class="btn btn-primary">
          🔧 初始化编解码器
        </button>
      </div>

      <div class="control-group">
        <h3>2️⃣ 录音和编码</h3>
        <button
          @click="startRecording"
          :disabled="isRecording"
          class="btn btn-success"
        >
          🎤 开始录音
        </button>
        <button
          @click="stopRecording"
          :disabled="!isRecording"
          class="btn btn-danger"
        >
          🛑 停止录音
        </button>
      </div>

      <div class="control-group">
        <h3>3️⃣ 保存数据</h3>
        <button
          @click="downloadOpusData"
          :disabled="encodedChunks.length === 0"
          class="btn btn-info"
        >
          📥 下载 OPUS 数据
        </button>
      </div>

      <div class="control-group">
        <h3>4️⃣ 解码和播放</h3>
        <button
          @click="playOpusData"
          :disabled="encodedChunks.length === 0 || isPlaying"
          class="btn btn-primary"
        >
          🔊 解码并播放
        </button>
        <button
          @click="stopPlayback"
          :disabled="!isPlaying"
          class="btn btn-warning"
        >
          ⏸️ 停止播放
        </button>
      </div>

      <div class="control-group">
        <h3>🧹 清理</h3>
        <button @click="clearLog" class="btn btn-secondary">
          🗑️ 清空日志
        </button>
        <button @click="cleanup" class="btn btn-danger">
          🧹 清理资源
        </button>
      </div>
    </div>

    <div class="test-log">
      <h3>📋 测试日志</h3>
      <div class="log-container">
        <div
          v-for="(log, index) in testLog"
          :key="index"
          class="log-entry"
        >
          {{ log }}
        </div>
        <div v-if="testLog.length === 0" class="log-empty">
          暂无日志...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opus-test-container {
  max-width: 1000px;
  margin: 20px auto;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 12px;
}

.test-header {
  text-align: center;
  margin-bottom: 20px;
}

.test-header h2 {
  margin: 0 0 10px 0;
  color: #333;
}

.test-description {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.test-status {
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  margin-bottom: 20px;
  background: #fff;
  border: 2px solid #ddd;
  transition: all 0.3s;
}

.status-error {
  background: #fee;
  border-color: #f66;
  color: #c33;
}

.status-success {
  background: #efe;
  border-color: #6c6;
  color: #363;
}

.status-recording {
  background: #ffe;
  border-color: #fc6;
  color: #963;
  animation: pulse 1.5s infinite;
}

.status-playing {
  background: #eef;
  border-color: #66f;
  color: #336;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.test-info {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.info-item {
  background: white;
  padding: 10px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.info-label {
  color: #666;
  font-size: 12px;
  margin-right: 8px;
}

.info-value {
  color: #333;
  font-weight: 600;
  font-size: 16px;
}

.test-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.control-group {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.control-group h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.control-group h3 {
  width: 100%;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
}

.btn-success:hover:not(:disabled) {
  background: #1e7e34;
}

.btn-danger {
  background: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background: #a71d2a;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-info {
  background: #17a2b8;
}

.btn-info:hover:not(:disabled) {
  background: #117a8b;
}

.btn-secondary {
  background: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.test-log {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.test-log h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-entry {
  padding: 4px 0;
  border-bottom: 1px solid #e9ecef;
  color: #333;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-empty {
  text-align: center;
  color: #999;
  padding: 20px;
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
