<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { speechService } from '@/utils/speech'
import { voiceHaptics } from '@/utils/hapticFeedback'
import FloatingChatMessage from './FloatingChatMessage.vue'
import FloatingParticles from './FloatingParticles.vue'
import VoiceWaveform from './VoiceWaveform.vue'
import VoiceControlCenter from './VoiceControlCenter.vue'
import StatusIndicator from './StatusIndicator.vue'
import type { ListenMode } from '@/types/websocket'

const chatStore = useChatStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const isRecording = ref(false)
const isInputFocused = ref(false)
const showParticles = ref(true)
const isFloating = ref(true)
const isMobile = ref(false)
const useWebsocket = ref(true)

// 监听模式
const listenMode = ref<ListenMode>('auto')

// 语音识别相关
const isRecognitionAvailable = computed(() => speechService.isRecognitionSupported())

// 语音状态
const voiceState = computed<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>(() => {
  if (isRecording.value) return 'listening'
  if (chatStore.isSpeaking) return 'speaking'
  if (chatStore.connectionState === 'error') return 'error'
  return 'idle'
})

// 音频波形级别（模拟）
const audioLevel = ref(0)
let audioLevelAnimation: number | null = null

// 计算属性
const userAvatar = computed(() => '🌸')
const aiAvatar = computed(() => '✨')

// 连接状态图标
const getConnectionStatusIcon = computed(() => {
  switch (chatStore.connectionState) {
    case 'connected': return '🟢'
    case 'connecting': return '🟡'
    case 'reconnecting': return '🟠'
    case 'error': return '🔴'
    default: return '⚪'
  }
})

const getConnectionStatusText = computed(() => {
  switch (chatStore.connectionState) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中...'
    case 'reconnecting': return '重连中...'
    case 'error': return '连接失败'
    default: return '未连接'
  }
})

// 切换连接
const toggleConnection = async () => {
  voiceHaptics.buttonTap()

  if (chatStore.isConnected) {
    chatStore.disconnectWebsocket()
  }
  else {
    try {
      await chatStore.connectWebsocket()
      voiceHaptics.connectionSuccess()
    }
    catch (error) {
      console.error('连接失败:', error)
      voiceHaptics.connectionError()
    }
  }
}

// 更新音频波形级别
const updateAudioLevel = () => {
  if (isRecording.value || chatStore.isSpeaking) {
    audioLevel.value = 0.3 + Math.random() * 0.7
    audioLevelAnimation = requestAnimationFrame(updateAudioLevel)
  } else {
    audioLevel.value = 0
    if (audioLevelAnimation) {
      cancelAnimationFrame(audioLevelAnimation)
      audioLevelAnimation = null
    }
  }
}

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 发送消息
const sendMessage = async () => {
  const text = messageInput.value.trim()
  if (!text) return

  voiceHaptics.buttonTap()

  chatStore.addMessage(text, true)
  messageInput.value = ''
  chatStore.clearInput()

  await scrollToBottom()
}

// 切换录音状态
const toggleRecording = async () => {
  if (isRecording.value) {
    stopRecording()
  }
  else {
    await startRecording()
  }
}

// 停止语音播放
const stopSpeaking = () => {
  speechService.stopSpeaking()
  chatStore.setSpeaking(false)
}

// 切换监听模式
const changeListenMode = (mode: ListenMode) => {
  listenMode.value = mode

  // 如果正在录音，重启以应用新模式
  if (isRecording.value) {
    stopRecording()
    setTimeout(() => startRecording(), 100)
  }
}

// 开始语音识别
const startRecording = async () => {
  // 使用Websocket模式
  if (useWebsocket.value && chatStore.isConnected) {
    try {
      await chatStore.startVoiceListen(listenMode.value)
      isRecording.value = true
      updateAudioLevel()
    }
    catch (error) {
      console.error('Websocket语音启动失败:', error)
    }
    return
  }

  // 使用本地语音识别
  if (!isRecognitionAvailable.value) {
    return
  }

  isRecording.value = true
  updateAudioLevel()

  speechService.startRecognition(
    (result) => {
      if (result.isFinal) {
        messageInput.value = result.transcript
        sendMessage()
        stopRecording()
      }
    },
    (error) => {
      console.error('语音识别错误:', error)
      stopRecording()
    },
    () => {
      stopRecording()
    },
    'zh-CN'
  )
}

// 停止语音识别
const stopRecording = () => {
  // 使用Websocket模式
  if (useWebsocket.value && chatStore.isConnected) {
    chatStore.stopVoiceListen()
    isRecording.value = false
    return
  }

  // 使用本地语音识别
  isRecording.value = false
  speechService.stopRecognition()
}

// 监听录音和播放状态，更新音频波形
watch([() => isRecording.value, () => chatStore.isSpeaking], () => {
  updateAudioLevel()
})

// 监听消息变化
chatStore.$subscribe(() => {
  scrollToBottom()
})

// 初始化
onMounted(() => {
  // 检测移动设备
  isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)

  console.log('📱 聊天界面移动设备检测:', isMobile.value)

  chatStore.loadHistory()
  scrollToBottom()

  // 添加欢迎消息
  if (chatStore.messages.length === 0) {
    setTimeout(() => {
      chatStore.addMessage(
        '哇～主人来啦！\n我是您的AI语音助手，\n试试对我说话吧！\n\n💬 点击大按钮开始语音对话 ☁️✨',
        false
      )
    }, 1000)
  }
})
</script>

<template>
  <div class="floating-chat-container"
       :class="{
         'input-focused': isInputFocused,
         'floating-active': isFloating
       }"
       @click="showParticles = true"
       @mouseleave="showParticles = false"
  >
    <!-- 浮动粒子背景 -->
    <FloatingParticles
      :visible="showParticles"
      :intensity="0.4"
      type="mixed"
    />

    <!-- 浮动聊天主体 -->
    <div class="floating-chat-main">
      <!-- 顶部连接状态 -->
      <div class="top-header">
        <span class="app-icon">💬</span>
        <button
          @click="toggleConnection"
          class="connection-button"
          :class="chatStore.connectionState"
          :title="`${getConnectionStatusText} - 点击${chatStore.isConnected ? '断开' : '连接'}`"
        >
          <span class="status-dot">{{ getConnectionStatusIcon }}</span>
          <span class="status-label">{{ getConnectionStatusText }}</span>
        </button>
      </div>

      <!-- 智能状态指示器 -->
      <StatusIndicator
        :state="voiceState"
        :is-connected="chatStore.isConnected"
      />

      <!-- 实时音频波形 -->
      <VoiceWaveform
        :is-active="isRecording || chatStore.isSpeaking"
        :is-recording="isRecording"
        :is-speaking="chatStore.isSpeaking"
        :audio-level="audioLevel"
      />

      <!-- 消息显示区（压缩）-->
      <div ref="messagesContainer" class="compact-messages"
           :class="{ 'speaking': chatStore.isSpeaking }"
      >
        <transition-group name="floating-message" tag="div" class="messages-list">
          <FloatingChatMessage
            v-for="message in chatStore.messages"
            :key="message.id"
            :message="message"
            :user-avatar="userAvatar"
            :ai-avatar="aiAvatar"
            :is-latest="message === chatStore.latestMessage"
          />
        </transition-group>
      </div>

      <!-- 语音控制中心（主要交互区域）-->
      <VoiceControlCenter
        :is-recording="isRecording"
        :is-speaking="chatStore.isSpeaking"
        :is-connected="chatStore.isConnected"
        :current-mode="listenMode"
        :disabled="!isRecognitionAvailable"
        @toggle-recording="toggleRecording"
        @stop-speaking="stopSpeaking"
        @change-mode="changeListenMode"
      />

      <!-- 文本输入（作为备用）-->
      <div class="backup-text-input">
        <input
          v-model="messageInput"
          type="text"
          placeholder="或者输入文字..."
          class="text-input"
          @keyup.enter="sendMessage"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
          :disabled="isRecording"
        />
        <button
          @click="sendMessage"
          :disabled="!messageInput.trim() || isRecording"
          class="send-button"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 浮动聊天容器 */
.floating-chat-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transition: all 0.3s ease;
  perspective: 1000px;
}

.floating-chat-container.input-focused {
  transform: scale(1.01);
}

.floating-chat-container.floating-active {
  animation: gentleFloat 6s infinite ease-in-out;
}

@keyframes gentleFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* 浮动聊天主体 */
.floating-chat-main {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
}

/* 顶部连接状态 */
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  flex-shrink: 0;
}

.app-icon {
  font-size: 18px;
  filter: drop-shadow(0 0 5px rgba(255, 182, 193, 0.6));
}

.connection-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
}

.connection-button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.connection-button.connected {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.3);
}

.connection-button.connecting,
.connection-button.reconnecting {
  background: rgba(255, 234, 167, 0.15);
  border-color: rgba(255, 234, 167, 0.3);
  animation: connectionPulse 1.5s infinite;
}

.connection-button.error {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.3);
}

@keyframes connectionPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.status-dot {
  font-size: 10px;
  line-height: 1;
}

.status-label {
  font-weight: 500;
  white-space: nowrap;
}

/* 紧凑消息区 */
.compact-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  margin: 0;
}

.compact-messages.speaking {
  background: rgba(78, 205, 196, 0.08);
  border-color: rgba(78, 205, 196, 0.2);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 备用文本输入 */
.backup-text-input {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.text-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  font-size: 13px;
  color: #fff;
  outline: none;
  transition: all 0.2s ease;
}

.text-input:focus {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 182, 193, 0.3);
}

.text-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.send-button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}

.send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 浮动消息动画 */
.floating-message-enter-active,
.floating-message-leave-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.floating-message-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.floating-message-leave-to {
  opacity: 0;
  transform: translateX(50px) scale(0.9);
}

/* 滚动条样式 */
.compact-messages::-webkit-scrollbar {
  width: 5px;
}

.compact-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.compact-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.compact-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .floating-chat-main {
    padding: 10px;
    gap: 8px;
  }

  .compact-messages {
    padding: 10px;
  }

  .backup-text-input {
    padding: 8px;
    gap: 6px;
  }

  .text-input {
    padding: 6px 10px;
    font-size: 12px;
  }

  .send-button {
    padding: 6px 12px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .floating-chat-main {
    padding: 8px;
    gap: 6px;
  }

  .compact-messages {
    padding: 8px;
  }

  .top-header {
    padding: 6px;
  }

  .app-icon {
    font-size: 16px;
  }
}

@media (min-width: 1920px) {
  .floating-chat-main {
    padding: 16px;
    gap: 12px;
  }

  .compact-messages {
    padding: 16px;
  }
}
</style>
