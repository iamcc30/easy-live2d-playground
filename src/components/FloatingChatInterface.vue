<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { speechService } from '@/utils/speech'
import FloatingChatMessage from './FloatingChatMessage.vue'
import FloatingParticles from './FloatingParticles.vue'

const chatStore = useChatStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const isRecording = ref(false)
const isInputFocused = ref(false)
const showParticles = ref(true)
const isFloating = ref(true)
const isMobile = ref(false)
const useWebsocket = ref(true) // Toggle between Websocket and local speech

// 语音识别相关
const isRecognitionAvailable = computed(() => speechService.isRecognitionSupported())

// 计算属性
const userAvatar = computed(() => '🌸')
const aiAvatar = computed(() => '✨')

// Websocket连接状态标识
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
  if (chatStore.isConnected) {
    chatStore.disconnectWebsocket()
  }
  else {
    try {
      await chatStore.connectWebsocket()
    }
    catch (error) {
      console.error('连接失败:', error)
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

  // 添加用户消息，带有浮动动画效果
  const userMessage = chatStore.addMessage(text, true)

  // 清空输入框
  messageInput.value = ''
  chatStore.clearInput()

  // 滚动到底部
  await scrollToBottom()

  // 模拟AI回复，添加浮动效果
  setTimeout(async () => {
    const aiResponse = generateAIFloatingResponse(text)
    const aiMessage = chatStore.addMessage(aiResponse, false)

    // 播放语音回复
    if (!chatStore.isSpeaking) {
      await speakFloatingMessage(aiResponse)
    }

    await scrollToBottom()
  }, 800 + Math.random() * 600) // 更短的随机延迟
}

// 生成AI回复（浮动风格）
const generateAIFloatingResponse = (userMessage: string): string => {
  const floatingResponses = [
    '哇～主人对我说话了呢！\n让我想想怎么回答比较好... ✨',
    '诶嘿嘿～主人的声音真好听！\n我会认真记住的～ 💕',
    '哇，好有趣的话题！\n让我也分享一下我的想法吧～ 🌸',
    '主人今天心情怎么样呀？\n看起来很开心呢～ ☁️',
    '诶？是这样的吗？\n我第一次听说呢，好新鲜！ 🌙',
    '主人的想法好特别呢～\n我觉得很有意思哦！ ⭐',
    '哇，感觉和主人聊天好开心！\n能再多说一点吗？ 🌈',
    '主人说得对呢～\n我也有同样的感觉！ 💫'
  ]

  return floatingResponses[Math.floor(Math.random() * floatingResponses.length)]
}

// 语音合成消息（带浮动效果）
const speakFloatingMessage = async (text: string) => {
  chatStore.setSpeaking(true)

  try {
    await new Promise((resolve) => {
      speechService.speak(
        text,
        chatStore.voiceSettings.lang,
        chatStore.voiceSettings.pitch,
        chatStore.voiceSettings.rate,
        chatStore.voiceSettings.volume,
        () => {
          // 开始播放时触发浮动效果
          console.log('🎵 开始播放浮动语音:', text)
        },
        () => {
          // 播放结束
          chatStore.setSpeaking(false)
          console.log('🎵 浮动语音播放结束')
          resolve(void 0)
        },
        (error) => {
          console.error('浮动语音播放错误:', error)
          chatStore.setSpeaking(false)
          resolve(void 0)
        }
      )
    })
  } catch (error) {
    console.error('浮动语音合成失败:', error)
    chatStore.setSpeaking(false)
  }
}

// 语音识别结果处理
const handleVoiceInput = (text: string) => {
  messageInput.value = text
  sendMessage()
}

// 语音录制切换
const toggleRecording = async () => {
  if (isRecording.value) {
    stopRecording()
  }
  else {
    await startRecording()
  }
}

// 开始语音识别
const startRecording = async () => {
  // 使用Websocket模式
  if (useWebsocket.value && chatStore.isConnected) {
    try {
      await chatStore.startVoiceListen('auto')
      isRecording.value = true
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

  speechService.startRecognition(
    (result) => {
      if (result.isFinal) {
        // 识别完成，发送消息
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
      // 识别结束
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

// 输入框聚焦效果
const handleInputFocus = () => {
  isInputFocused.value = true
  // 聚焦时增加浮动效果
  isFloating.value = true

  // 移动端键盘弹出时滚动到输入框
  if (isMobile.value && messagesContainer.value) {
    setTimeout(() => {
      messagesContainer.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 300)
  }
}

const handleInputBlur = () => {
  isInputFocused.value = false
  // 失焦时恢复
  setTimeout(() => {
    isFloating.value = true
  }, 300)
}

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

  // 添加欢迎消息（浮动风格）
  if (chatStore.messages.length === 0) {
    setTimeout(() => {
      chatStore.addMessage(
        '哇～主人来啦！\n我是您的浮动小助手，\n让我们一起在云端聊天吧！\n\n试试对我说话吧～ ☁️✨',
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
    <div class="floating-chat-main"
         :class="{ 'lifted': isInputFocused }"
    >
      <!-- 极简头部 -->
      <div class="simple-header"
           :class="{ active: chatStore.isSpeaking }"
      >
        <span class="simple-title">💬</span>
        <!-- 连接状态指示器 -->
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

      <!-- 消息区域（玻璃拟态）-->
      <div ref="messagesContainer" class="floating-messages"
           :class="{ 'speaking': chatStore.isSpeaking }"
      >
        <transition-group name="floating-message" tag="div" class="messages-list"
        >
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

      <!-- 简化输入区域 -->
      <div class="simple-input-area">
        <!-- 简化文本输入 -->
        <div class="simple-input-wrapper">
          <input
            v-model="messageInput"
            type="text"
            placeholder="说点什么..."
            class="simple-message-input"
            @keyup.enter="sendMessage"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            :disabled="isRecording"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :inputmode="isMobile ? 'text' : undefined"
          />
          <button
            @click="sendMessage"
            :disabled="!messageInput.trim() || isRecording"
            class="simple-send-button"
          >
            发送
          </button>
          <!-- 语音按钮移到发送按钮后面 -->
          <button
            @click="toggleRecording"
            :class="{ recording: isRecording, speaking: chatStore.isSpeaking }"
            :disabled="!isRecognitionAvailable"
            class="simple-voice-button"
            title="语音输入"
          >
            <span v-if="!isRecording" class="voice-icon">🎤</span>
            <span v-else-if="chatStore.isSpeaking" class="voice-icon">🔊</span>
            <span v-else class="voice-icon">🔴</span>
          </button>
        </div>
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
  transform: scale(1.02);
}

.floating-chat-container.floating-active {
  animation: gentleFloat 6s infinite ease-in-out;
}

@keyframes gentleFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  25% {
    transform: translateY(-2px) rotate(0.2deg);
  }
  50% {
    transform: translateY(-4px) rotate(0deg);
  }
  75% {
    transform: translateY(-2px) rotate(-0.2deg);
  }
}

/* 浮动聊天主体 */
.floating-chat-main {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform-style: preserve-3d;
  overflow: hidden;
}

.floating-chat-main.lifted {
  transform: translateY(-8px) rotateX(2deg);
  filter: drop-shadow(0 20px 40px rgba(255, 182, 193, 0.3));
}

/* 浮动头部（极简） */
.floating-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.floating-header.active {
  animation: headerGlow 2s infinite;
}

@keyframes headerGlow {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(255, 182, 193, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(255, 182, 193, 0.6));
  }
}

.floating-gem {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 182, 193, 0.6) 100%
  );
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.floating-gem.pulse {
  animation: gemPulse 1.5s infinite;
}

@keyframes gemPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 10px rgba(255, 182, 193, 0.3);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(255, 182, 193, 0.6);
  }
}

.gem-inner {
  font-size: 16px;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));
}

.floating-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  margin: 0 16px;
  transition: all 0.3s ease;
}

.floating-line.active {
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 182, 193, 0.8),
    transparent
  );
  animation: lineGlow 2s infinite;
}

@keyframes lineGlow {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

/* 浮动消息区域（玻璃拟态） */
.floating-messages {
  flex: 1;
  min-height: 0; /* 修复flex布局问题 */
  max-height: calc(100% - 160px); /* 确保不会超出容器，为输入区域留出空间 */
  overflow-y: auto;
  padding: 16px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.1),
    inset 0 0 10px rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  position: relative;
}

.floating-messages.speaking {
  background: rgba(255, 182, 193, 0.15);
  box-shadow:
    0 8px 32px rgba(255, 182, 193, 0.2),
    inset 0 0 15px rgba(255, 182, 193, 0.1);
}

.floating-messages:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 182, 193, 0.05) 100%
  );
  border-radius: 20px;
  pointer-events: none;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 1;
}

/* 简化输入区域 */
.simple-input-area {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  flex-shrink: 0; /* 防止输入区域被压缩 */
  margin-bottom: 30px;
}

/* 简化输入包装器 */
.simple-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 简化消息输入框 */
.simple-message-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 14px;
  color: #fff;
  outline: none;
  transition: all 0.2s ease;
}

.simple-message-input:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 182, 193, 0.3);
}

.simple-message-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.simple-message-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

/* 简化发送按钮 */
.simple-send-button {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}

.simple-send-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.simple-send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 简化语音按钮 */
.simple-voice-button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
}

.simple-voice-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.simple-voice-button.recording {
  background: rgba(255, 107, 107, 0.2);
  animation: recordingPulse 1s infinite;
}

.simple-voice-button.speaking {
  background: rgba(78, 205, 196, 0.2);
}

.simple-voice-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.voice-icon {
  transition: all 0.2s ease;
}

.simple-voice-button.recording .voice-icon {
  animation: recordingBlink 1s infinite;
}

@keyframes recordingPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes recordingBlink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}

/* 简化头部 */
.simple-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.simple-header.active {
  animation: headerGlow 2s infinite;
}

.simple-title {
  font-size: 16px;
  filter: drop-shadow(0 0 5px rgba(255, 182, 193, 0.6));
}

/* 连接状态按钮 */
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
  transform: translateY(-1px);
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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.status-dot {
  font-size: 10px;
  line-height: 1;
}

.status-label {
  font-weight: 500;
  white-space: nowrap;
}

@keyframes headerGlow {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* 简化语音控制 */
.simple-control-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 10px;
}

.simple-record-button,
.simple-stop-button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
}

.simple-record-button:hover:not(:disabled),
.simple-stop-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.simple-record-button.recording {
  background: rgba(255, 107, 107, 0.2);
  animation: recordingPulse 1s infinite;
}

.simple-record-button.speaking {
  background: rgba(78, 205, 196, 0.2);
}

.simple-record-button:disabled,
.simple-stop-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.record-icon,
.speak-icon,
.recording-icon {
  transition: all 0.2s ease;
}

.recording-icon {
  animation: recordingBlink 1s infinite;
}

@keyframes recordingPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes recordingBlink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}

/* 浮动消息动画 */
.floating-message-enter-active,
.floating-message-leave-active {
  transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.floating-message-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.8) rotate(-5deg);
}

.floating-message-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.8) rotate(5deg);
}

.floating-message-move {
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 滚动条样式（玻璃） */
.floating-messages::-webkit-scrollbar {
  width: 6px;
}

.floating-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.floating-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.floating-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .floating-chat-main {
    padding: 12px;
  }

  .floating-messages {
    padding: 12px;
    margin-bottom: 12px;
    min-height: 120px; /* 减少最小高度 */
    max-height: calc(100% - 100px); /* 调整移动设备上的最大高度 */
  }

  .simple-input-area {
    padding: 10px;
    margin-top: auto; /* 确保输入区域在底部 */
    flex-shrink: 0;
  }

  .simple-input-wrapper {
    gap: 6px;
    flex-wrap: nowrap; /* 防止在小屏幕上换行 */
  }

  .simple-message-input {
    padding: 8px 12px;
    font-size: 14px;
    min-width: 0; /* 允许输入框收缩 */
  }

  .simple-send-button {
    padding: 8px 12px;
    font-size: 13px;
    white-space: nowrap; /* 防止文字换行 */
  }

  .simple-voice-button {
    width: 36px;
    height: 36px;
    font-size: 14px;
    flex-shrink: 0; /* 防止按钮收缩 */
  }

  .simple-header {
    padding: 6px;
    margin-bottom: 6px;
  }

  .simple-title {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .floating-chat-main {
    padding: 8px;
  }

  .floating-messages {
    padding: 8px;
    margin-bottom: 8px;
    min-height: 100px; /* 更小屏幕的最小高度 */
    max-height: calc(100% - 90px); /* 调整更小屏幕的最大高度 */
  }

  .simple-input-area {
    padding: 8px;
    flex-shrink: 0;
  }

  .simple-input-wrapper {
    gap: 4px;
  }

  .simple-message-input {
    padding: 6px 10px;
    font-size: 13px;
  }

  .simple-send-button {
    padding: 6px 10px;
    font-size: 12px;
  }

  .simple-voice-button {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .simple-header {
    padding: 4px;
    margin-bottom: 4px;
  }

  .simple-title {
    font-size: 12px;
  }
}

@media (min-width: 1920px) {
  .floating-chat-main {
    padding: 20px;
  }

  .floating-messages {
    padding: 20px;
    margin-bottom: 20px;
  }

  .floating-input-area {
    padding: 20px;
  }

  .floating-message-input {
    padding: 16px 20px;
    font-size: 15px;
  }

  .floating-send-button {
    width: 52px;
    height: 52px;
  }

  .button-icon {
    font-size: 22px;
  }

  .floating-gem {
    width: 36px;
    height: 36px;
  }

  .gem-inner {
    font-size: 18px;
  }
}
</style>