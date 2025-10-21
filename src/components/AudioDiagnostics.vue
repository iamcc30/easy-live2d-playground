<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { websocketService } from '@/services/websocket'
import { audioRecordingService } from '@/services/audioRecording'

interface DiagnosticResult {
  name: string
  status: 'checking' | 'success' | 'warning' | 'error'
  message: string
  details?: string
}

const diagnostics = ref<DiagnosticResult[]>([])
const isRunning = ref(false)
const audioPacketCount = ref(0)
const audioBytesSent = ref(0)
const lastPacketTime = ref<number | null>(null)
const packetIntervals = ref<number[]>([])

// 添加日志监控
const setupLogMonitoring = () => {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  console.log = function(...args: any[]) {
    originalLog.apply(console, args)

    const message = args.join(' ')

    // 检测音频发送
    if (message.includes('📤 Sent audio data:')) {
      audioPacketCount.value++
      const match = message.match(/(\d+) bytes/)
      if (match) {
        const bytes = parseInt(match[1])
        audioBytesSent.value += bytes

        const now = Date.now()
        if (lastPacketTime.value) {
          const interval = now - lastPacketTime.value
          packetIntervals.value.push(interval)
          // 只保留最近10个间隔
          if (packetIntervals.value.length > 10) {
            packetIntervals.value.shift()
          }
        }
        lastPacketTime.value = now
      }
    }
  }

  console.error = function(...args: any[]) {
    originalError.apply(console, args)

    const message = args.join(' ')

    // 检测发送错误
    if (message.includes('❌ Cannot send audio')) {
      addDiagnostic('Audio Sending', 'error', 'WebSocket未连接，无法发送音频')
    }

    if (message.includes('⚠️ No data callback set')) {
      addDiagnostic('Audio Callback', 'error', '音频回调未设置')
    }
  }

  console.warn = function(...args: any[]) {
    originalWarn.apply(console, args)
  }
}

const addDiagnostic = (name: string, status: DiagnosticResult['status'], message: string, details?: string) => {
  const existing = diagnostics.value.find(d => d.name === name)
  if (existing) {
    existing.status = status
    existing.message = message
    if (details) existing.details = details
  } else {
    diagnostics.value.push({ name, status, message, details })
  }
}

const checkWebSocket = async (): Promise<void> => {
  addDiagnostic('WebSocket连接', 'checking', '检查中...')

  await new Promise(resolve => setTimeout(resolve, 100))

  const isConnected = websocketService.isConnected()
  const state = websocketService.getConnectionState()

  if (isConnected) {
    addDiagnostic('WebSocket连接', 'success', '已连接', `状态: ${state}`)
  } else {
    addDiagnostic('WebSocket连接', 'error', '未连接', `状态: ${state}，请先点击"连接"按钮`)
  }
}

const checkMicrophonePermission = async (): Promise<void> => {
  addDiagnostic('麦克风权限', 'checking', '检查中...')

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })

    if (result.state === 'granted') {
      addDiagnostic('麦克风权限', 'success', '已授予')
    } else if (result.state === 'prompt') {
      addDiagnostic('麦克风权限', 'warning', '未请求', '点击麦克风按钮时会请求权限')
    } else {
      addDiagnostic('麦克风权限', 'error', '已拒绝', '请在浏览器设置中允许麦克风权限')
    }
  } catch (error) {
    addDiagnostic('麦克风权限', 'warning', '无法检查', '将在启动录音时请求')
  }
}

const checkAudioAPIs = (): void => {
  addDiagnostic('音频API', 'checking', '检查中...')

  const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext)
  const hasWebCodecs = typeof AudioEncoder !== 'undefined'

  if (hasAudioContext) {
    if (hasWebCodecs) {
      addDiagnostic('音频API', 'success', 'AudioContext + WebCodecs', '支持OPUS编码')
    } else {
      addDiagnostic('音频API', 'warning', '仅AudioContext', '将使用PCM格式（数据量较大）')
    }
  } else {
    addDiagnostic('音频API', 'error', '不支持', '浏览器不支持音频录制')
  }
}

const checkAudioRecordingService = (): void => {
  addDiagnostic('录音服务', 'checking', '检查中...')

  const contextState = audioRecordingService.getAudioContextState()
  const isRecording = audioRecordingService.getIsRecording()
  const encoderStatus = audioRecordingService.getEncoderStatus()

  if (contextState === 'running' && isRecording) {
    addDiagnostic('录音服务', 'success', '正在录音',
      `格式: ${encoderStatus.format.toUpperCase()}, 编码器: ${encoderStatus.state}`)
  } else if (contextState === 'suspended') {
    addDiagnostic('录音服务', 'warning', 'AudioContext挂起', '点击页面任意位置激活')
  } else if (contextState === null) {
    addDiagnostic('录音服务', 'warning', '未初始化', '点击"连接"按钮初始化')
  } else {
    addDiagnostic('录音服务', 'warning', '未启动', '点击麦克风按钮启动')
  }
}

const runDiagnostics = async (): Promise<void> => {
  isRunning.value = true
  diagnostics.value = []
  audioPacketCount.value = 0
  audioBytesSent.value = 0
  lastPacketTime.value = null
  packetIntervals.value = []

  console.log('🔧 开始运行音频诊断...')

  await checkWebSocket()
  await checkMicrophonePermission()
  checkAudioAPIs()
  checkAudioRecordingService()

  isRunning.value = false

  console.log('✅ 诊断完成')
}

const getStatusIcon = (status: DiagnosticResult['status']) => {
  switch (status) {
    case 'checking': return '⏳'
    case 'success': return '✅'
    case 'warning': return '⚠️'
    case 'error': return '❌'
  }
}

const getStatusColor = (status: DiagnosticResult['status']) => {
  switch (status) {
    case 'checking': return 'text-blue-500'
    case 'success': return 'text-green-500'
    case 'warning': return 'text-yellow-500'
    case 'error': return 'text-red-500'
  }
}

const getAverageInterval = () => {
  if (packetIntervals.value.length === 0) return 0
  const sum = packetIntervals.value.reduce((a, b) => a + b, 0)
  return Math.round(sum / packetIntervals.value.length)
}

onMounted(() => {
  setupLogMonitoring()
  runDiagnostics()
})
</script>

<template>
  <div class="audio-diagnostics bg-gray-800 text-white p-6 rounded-lg shadow-xl max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold">🔍 音频系统诊断</h2>
      <button
        @click="runDiagnostics"
        :disabled="isRunning"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
      >
        {{ isRunning ? '检查中...' : '重新检查' }}
      </button>
    </div>

    <!-- 诊断结果 -->
    <div class="space-y-3 mb-6">
      <div
        v-for="diagnostic in diagnostics"
        :key="diagnostic.name"
        class="bg-gray-700 p-4 rounded-lg"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xl">{{ getStatusIcon(diagnostic.status) }}</span>
              <span class="font-semibold">{{ diagnostic.name }}</span>
            </div>
            <p :class="getStatusColor(diagnostic.status)">
              {{ diagnostic.message }}
            </p>
            <p v-if="diagnostic.details" class="text-sm text-gray-400 mt-1">
              {{ diagnostic.details }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时统计 -->
    <div class="bg-gray-700 p-4 rounded-lg">
      <h3 class="font-semibold mb-3 text-lg">📊 实时传输统计</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-400">发送包数</div>
          <div class="text-2xl font-bold" :class="audioPacketCount > 0 ? 'text-green-400' : 'text-gray-500'">
            {{ audioPacketCount }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-400">发送字节</div>
          <div class="text-2xl font-bold" :class="audioBytesSent > 0 ? 'text-green-400' : 'text-gray-500'">
            {{ (audioBytesSent / 1024).toFixed(2) }} KB
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-400">平均间隔</div>
          <div class="text-2xl font-bold" :class="packetIntervals.length > 0 ? 'text-green-400' : 'text-gray-500'">
            {{ getAverageInterval() }}ms
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-400">传输速率</div>
          <div class="text-2xl font-bold" :class="audioPacketCount > 0 ? 'text-green-400' : 'text-gray-500'">
            {{ audioPacketCount > 0 && getAverageInterval() > 0
              ? ((audioBytesSent / audioPacketCount) / (getAverageInterval() / 1000)).toFixed(1)
              : '0'
            }} B/s
          </div>
        </div>
      </div>

      <div v-if="audioPacketCount === 0" class="mt-4 text-sm text-yellow-400">
        💡 提示：点击麦克风按钮并说话，这里会显示实时传输数据
      </div>
      <div v-else class="mt-4 text-sm text-green-400">
        ✅ 音频数据正在发送！期望间隔: 64ms
      </div>
    </div>

    <!-- 操作指南 -->
    <div class="mt-6 bg-gray-700 p-4 rounded-lg">
      <h3 class="font-semibold mb-3">📋 操作步骤</h3>
      <ol class="space-y-2 text-sm">
        <li class="flex items-start gap-2">
          <span class="text-blue-400">1.</span>
          <span>确保所有诊断项显示 ✅ 或 ⚠️（警告可接受）</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-blue-400">2.</span>
          <span>如果WebSocket未连接，点击主界面的"连接"按钮</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-blue-400">3.</span>
          <span>点击麦克风按钮启动录音</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-blue-400">4.</span>
          <span>对着麦克风说话，观察"发送包数"是否增加</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-blue-400">5.</span>
          <span>如果发送包数增加，说明数据正在发送到服务器</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.audio-diagnostics {
  font-family: system-ui, -apple-system, sans-serif;
}
</style>
