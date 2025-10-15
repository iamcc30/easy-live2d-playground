<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { speechService } from '@/utils/speech'

const emit = defineEmits<{
  voiceInput: [text: string]
  recordingChange: [recording: boolean]
}>()

const chatStore = useChatStore()
const isRecording = ref(false)
const recordingStatus = ref('')
const interimText = ref('')
const isHovered = ref(false)
const voiceWaveLevel = ref(0)
let animationId: number | null = null

// 计算属性
const isRecognitionAvailable = computed(() => speechService.isRecognitionSupported())

const currentVoiceLang = computed(() => chatStore.recognitionLang)

// 获取语音状态图标
const getVoiceIcon = computed(() => {
  if (isRecording.value) return '🎤'
  if (chatStore.isSpeaking) return '🔊'
  return '🗣️'
})

// 获取语音状态文本
const getVoiceStatusText = computed(() => {
  if (isRecording.value) return '正在聆听...'
  if (chatStore.isSpeaking) return '正在说话...'
  return '语音助手'
})

// 开始语音识别
const startRecording = () => {
  if (!isRecognitionAvailable.value) {
    recordingStatus.value = '语音识别不支持'
    return
  }

  isRecording.value = true
  emit('recordingChange', true)
  recordingStatus.value = '正在聆听主人说话...'
  interimText.value = ''
  startVoiceWaveAnimation()

  speechService.startRecognition(
    (result) => {
      if (result.isFinal) {
        // 识别完成
        emit('voiceInput', result.transcript)
        interimText.value = ''
        recordingStatus.value = '识别完成！'
        setTimeout(() => {
          stopRecording()
        }, 500)
      } else {
        // 临时结果
        interimText.value = result.transcript
        recordingStatus.value = '正在识别...'
      }
    },
    (error) => {
      recordingStatus.value = error
      stopRecording()
    },
    () => {
      // 识别结束
      stopRecording()
    },
    currentVoiceLang.value
  )
}

// 停止语音识别
const stopRecording = () => {
  if (!isRecording.value) return

  isRecording.value = false
  emit('recordingChange', false)
  recordingStatus.value = ''
  interimText.value = ''
  stopVoiceWaveAnimation()

  speechService.stopRecognition()
}

// 切换录音状态
const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

// 停止语音播放
const stopSpeaking = () => {
  speechService.stopSpeaking()
  chatStore.setSpeaking(false)
}

// 切换语音合成语言
const toggleVoiceLang = () => {
  const currentLang = chatStore.recognitionLang
  chatStore.recognitionLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN'

  // 显示切换提示
  recordingStatus.value = currentLang === 'zh-CN'
    ? 'Switched to English 🇺🇸'
    : '切换到中文 🇨🇳'

  setTimeout(() => {
    recordingStatus.value = ''
  }, 1500)
}

// 语音波形动画
const startVoiceWaveAnimation = () => {
  const animate = () => {
    // 模拟语音波形
    voiceWaveLevel.value = 0.3 + Math.random() * 0.7
    if (isRecording.value) {
      animationId = requestAnimationFrame(animate)
    } else {
      voiceWaveLevel.value = 0
    }
  }
  animate()
}

const stopVoiceWaveAnimation = () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  voiceWaveLevel.value = 0
}

// 获取语音波形样式
const getVoiceWaveStyle = computed(() => ({
  transform: `scaleY(${voiceWaveLevel.value})`,
  opacity: voiceWaveLevel.value
}))

// 获取录音按钮样式
const getRecordButtonClass = computed(() => ({
  'recording': isRecording.value,
  'speaking': chatStore.isSpeaking,
  'disabled': !isRecognitionAvailable.value,
  'hovered': isHovered.value
}))

// 获取语言按钮文本
const getLangButtonText = computed(() => {
  return currentVoiceLang.value === 'zh-CN' ? '中文' : 'EN'
})

onMounted(() => {
  // 初始化语音列表
  if (speechService.isSynthesisSupported()) {
    setTimeout(() => {
      speechService.getVoices()
    }, 100)
  }
})
</script>

<template>
  <div class="anime-voice-controls"
       @mouseenter="isHovered = true"
       @mouseleave="isHovered = false"
  >
    <!-- 语音状态显示 -->
    <div class="voice-status-bar"
         :class="{ active: isRecording || chatStore.isSpeaking }"
    >
      <div class="status-icon"
           :class="{ pulse: isRecording }"
      >
        {{ getVoiceIcon }}
      </div>

      <div class="status-text">{{ getVoiceStatusText }}</div>

      <!-- 语音波形动画 -->
      <div v-if="isRecording" class="voice-wave-container"
      >
        <div
          v-for="n in 5"
          :key="n"
          class="voice-wave-bar"
          :style="{ animationDelay: `${n * 0.1}s` }"
        >
          <div class="wave-bar-inner"
               :style="getVoiceWaveStyle"
          ></div>
        </div>
      </div>

      <!-- 语言指示器 -->
      <div class="lang-indicator"
           :class="currentVoiceLang"
      >
        {{ currentVoiceLang === 'zh-CN' ? '🇨🇳' : '🇺🇸' }}
      </div>
    </div>

    <!-- 控制按钮组 -->
    <div class="control-buttons"
    >
      <!-- 录音按钮 -->
      <button
        @click="toggleRecording"
        :class="getRecordButtonClass"
        :disabled="!isRecognitionAvailable"
        class="control-button record-button"
        title="按住说话"
      >
        <div class="button-icon">
          <span v-if="!isRecording">🎤</span>
          <span v-else-if="chatStore.isSpeaking">🔊</span>
          <span v-else class="recording-icon">🔴</span>
        </div>

        <div class="button-glow"></div>

        <div class="button-ring"
             v-if="isRecording"
        ></div>
      </button>

      <!-- 语言切换按钮 -->
      <button
        @click="toggleVoiceLang"
        class="control-button lang-button"
        title="切换语言"
      >
        <div class="button-icon">🌐</div>
        <div class="button-text">{{ getLangButtonText }}</div>
        <div class="button-glow"></div>
      </button>

      <!-- 停止播放按钮 -->
      <button
        @click="stopSpeaking"
        :disabled="!chatStore.isSpeaking"
        class="control-button stop-button"
        title="停止播放"
      >
        <div class="button-icon">⏹️</div>
        <div class="button-glow"
             v-if="chatStore.isSpeaking"
        ></div>
      </button>
    </div>

    <!-- 状态显示区域 -->
    <div v-if="recordingStatus || interimText" class="status-display"
         :class="{ recording: isRecording }"
    >
      <div v-if="recordingStatus" class="status-text"
           :class="{ pulse: isRecording }"
      >
        {{ recordingStatus }}
      </div>

      <div v-if="interimText" class="interim-text"
      >
        <span class="interim-icon">📝</span>
        {{ interimText }}
      </div>
    </div>

    <!-- 不支持提示 -->
    <div v-if="!isRecognitionAvailable" class="unsupported-notice"
    >
      <div class="notice-icon">⚠️</div>
      <div class="notice-content">
        <div class="notice-title">语音功能暂不可用</div>
        <div class="notice-text">建议使用Chrome或Edge浏览器获得完整体验</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anime-voice-controls {
  position: relative;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.anime-voice-controls:hover {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 25px rgba(255, 182, 193, 0.2);
}

/* 语音状态栏 */
.voice-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.voice-status-bar.active {
  background: rgba(255, 182, 193, 0.2);
  box-shadow: inset 0 0 20px rgba(255, 182, 193, 0.3);
}

.status-icon {
  font-size: 20px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
  transition: all 0.3s ease;
}

.status-icon.pulse {
  animation: statusPulse 1.5s infinite;
}

@keyframes statusPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  flex: 1;
}

/* 语音波形 */
.voice-wave-container {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 20px;
}

.voice-wave-bar {
  width: 3px;
  height: 20px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.wave-bar-inner {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #ff9a9e, #fecfef);
  border-radius: 2px;
  transition: all 0.1s ease;
  animation: waveAnimation 0.8s infinite ease-in-out;
}

@keyframes waveAnimation {
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

/* 语言指示器 */
.lang-indicator {
  font-size: 16px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.lang-indicator.zh-CN {
  background: rgba(255, 0, 0, 0.1);
}

.lang-indicator.en-US {
  background: rgba(0, 0, 255, 0.1);
}

/* 控制按钮 */
.control-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}

.control-button {
  position: relative;
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
}

.control-button:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.control-button:hover:before {
  opacity: 1;
}

.button-icon {
  font-size: 24px;
  transition: all 0.3s ease;
  z-index: 2;
}

.button-text {
  font-size: 10px;
  font-weight: 500;
  z-index: 2;
}

.button-glow {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e);
  border-radius: 50%;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.3s ease;
}

.control-button:hover .button-glow {
  opacity: 0.6;
  animation: glowRotate 2s linear infinite;
}

/* 录音按钮 */
.record-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.record-button.recording {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.6);
  animation: recordingPulse 1s infinite;
}

.record-button.speaking {
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  box-shadow: 0 4px 15px rgba(78, 205, 196, 0.6);
}

.record-button.hovered {
  transform: scale(1.05);
}

.recording-icon {
  animation: recordingBlink 1s infinite;
}

@keyframes recordingPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.6);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.8);
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

/* 语言按钮 */
.lang-button {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
}

/* 停止按钮 */
.stop-button {
  background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
  box-shadow: 0 4px 15px rgba(255, 234, 167, 0.4);
}

.stop-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮环效果 */
.button-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  opacity: 0;
  animation: ringExpand 1.5s infinite;
}

@keyframes ringExpand {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

/* 状态显示 */
.status-display {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
  transition: all 0.3s ease;
}

.status-display.recording {
  background: rgba(255, 182, 193, 0.2);
  box-shadow: inset 0 0 20px rgba(255, 182, 193, 0.3);
}

.status-text {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-bottom: 8px;
}

.status-text.pulse {
  animation: textPulse 1.5s infinite;
}

@keyframes textPulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

.interim-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  background: rgba(255, 255, 255, 0.5);
  padding: 8px 12px;
  border-radius: 8px;
  margin-top: 8px;
  animation: interimTextAppear 0.3s ease-out;
}

@keyframes interimTextAppear {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.interim-icon {
  font-size: 14px;
}

/* 不支持提示 */
.unsupported-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 243, 205, 0.8);
  border: 1px solid rgba(255, 234, 167, 0.5);
  border-radius: 12px;
  margin-top: 12px;
  animation: noticeAppear 0.5s ease-out;
}

@keyframes noticeAppear {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notice-content {
  flex: 1;
}

.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: #856404;
  margin-bottom: 4px;
}

.notice-text {
  font-size: 11px;
  color: #856404;
  opacity: 0.9;
}

/* 发光旋转动画 */
@keyframes glowRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .anime-voice-controls {
    padding: 12px;
  }

  .control-button {
    width: 50px;
    height: 50px;
  }

  .button-icon {
    font-size: 20px;
  }

  .button-text {
    font-size: 9px;
  }
}

@media (min-width: 1920px) {
  .anime-voice-controls {
    padding: 20px;
  }

  .control-button {
    width: 70px;
    height: 70px;
  }

  .button-icon {
    font-size: 28px;
  }

  .button-text {
    font-size: 11px;
  }
}
</style>