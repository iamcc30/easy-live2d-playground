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
  recordingStatus.value = '正在聆听主人的声音...'
  interimText.value = ''
  startVoiceWaveAnimation()

  speechService.startRecognition(
    (result) => {
      if (result.isFinal) {
        // 识别完成
        emit('voiceInput', result.transcript)
        interimText.value = ''
        recordingStatus.value = '识别完成！✨'
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
    'zh-CN'
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
  <div class="floating-voice-controls"
       @mouseenter="isHovered = true"
       @mouseleave="isHovered = false"
  >
    <!-- 语音状态显示（玻璃效果）-->
    <div class="floating-voice-status"
         :class="{ active: isRecording || chatStore.isSpeaking }"
    >
      <div class="status-icon"
           :class="{ pulse: isRecording }"
      >
        {{ getVoiceIcon }}
      </div>

      <div class="status-text">{{ getVoiceStatusText }}</div>

      <!-- 语音波形动画（玻璃效果）-->
      <div v-if="isRecording" class="floating-voice-wave"
      >
        <div
          v-for="n in 5"
          :key="n"
          class="floating-wave-bar"
          :style="{ animationDelay: `${n * 0.1}s` }"
        >
          <div class="floating-wave-inner"
               :style="getVoiceWaveStyle"
          ></div>
        </div>
      </div>

    </div>

    <!-- 简化控制按钮组 -->
    <div class="simple-control-buttons"
    >
      <!-- 录音按钮（简化版）-->
      <button
        @click="toggleRecording"
        :class="{ recording: isRecording, speaking: chatStore.isSpeaking, disabled: !isRecognitionAvailable }"
        :disabled="!isRecognitionAvailable"
        class="simple-record-button"
        title="按住说话"
      >
        <span v-if="!isRecording" class="record-icon">🎤</span>
        <span v-else-if="chatStore.isSpeaking" class="speak-icon">🔊</span>
        <span v-else class="recording-icon">🔴</span>
      </button>

      <!-- 停止播放按钮（简化版）-->
      <button
        @click="stopSpeaking"
        :disabled="!chatStore.isSpeaking"
        class="simple-stop-button"
        title="停止播放"
      >
        ⏹️
      </button>
    </div>

    <!-- 状态显示区域（玻璃）-->
    <div v-if="recordingStatus || interimText" class="floating-status-display"
         :class="{ recording: isRecording }"
    >
      <div v-if="recordingStatus" class="floating-status-text"
           :class="{ pulse: isRecording }"
      >
        {{ recordingStatus }}
      </div>

      <div v-if="interimText" class="floating-interim-text"
      >
        <span class="interim-icon">📝</span>
        {{ interimText }}
      </div>
    </div>

    <!-- 不支持提示（玻璃效果）-->
    <div v-if="!isRecognitionAvailable" class="floating-unsupported-notice"
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
.floating-voice-controls {
  position: relative;
  padding: 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  margin-bottom: 12px;
}

.floating-voice-controls:hover {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
}

/* 语音状态显示（玻璃效果） */
.floating-voice-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.floating-voice-status.active {
  background: rgba(255, 182, 193, 0.15);
  box-shadow: inset 0 0 15px rgba(255, 182, 193, 0.2);
}

.status-icon {
  font-size: 18px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
  transition: all 0.3s ease;
  z-index: 2;
}

.status-icon.pulse {
  animation: statusPulse 1.5s infinite;
}

@keyframes statusPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
  z-index: 2;
}

/* 语音波形动画（玻璃效果） */
.floating-voice-wave {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 16px;
}

.floating-wave-bar {
  width: 3px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.floating-wave-inner {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #ff9a9e, #fecfef);
  border-radius: 2px;
  transition: all 0.1s ease;
  animation: floatingWaveAnimation 0.8s infinite ease-in-out;
}

@keyframes floatingWaveAnimation {
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

/* 语言指示器 */
.floating-lang-indicator {
  font-size: 14px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  transition: all 0.3s ease;
  z-index: 2;
}

.floating-lang-indicator.zh-CN {
  background: rgba(255, 0, 0, 0.15);
}

.floating-lang-indicator.en-US {
  background: rgba(0, 0, 255, 0.15);
}

/* 控制按钮组（玻璃按钮） */
.floating-control-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
}

.floating-control-button {
  position: relative;
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.floating-control-button:hover {
  transform: translateY(-2px) scale(1.05);
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.button-glass {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  border-radius: inherit;
  transition: all 0.3s ease;
}

.button-glass.pulse {
  animation: glassPulse 1.5s infinite;
}

@keyframes glassPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.button-icon {
  font-size: 20px;
  transition: all 0.3s ease;
  z-index: 2;
  color: rgba(255, 255, 255, 0.9);
}

.button-text {
  font-size: 9px;
  font-weight: 500;
  z-index: 2;
  color: rgba(255, 255, 255, 0.8);
}

/* 录音按钮 */
.record-button {
  background: rgba(102, 126, 234, 0.1);
  border-color: rgba(102, 126, 234, 0.3);
}

.record-button.recording {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.4);
  animation: recordingPulse 1s infinite;
}

.record-button.speaking {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
}

.record-button.hovered {
  transform: translateY(-2px) scale(1.05);
}

.recording-icon {
  animation: recordingBlink 1s infinite;
}

@keyframes recordingPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
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
  background: rgba(240, 147, 251, 0.1);
  border-color: rgba(240, 147, 251, 0.3);
}

/* 停止按钮 */
.stop-button {
  background: rgba(255, 234, 167, 0.1);
  border-color: rgba(255, 234, 167, 0.3);
}

.stop-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(0.95);
}

/* 按钮环效果 */
.button-ring {
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  opacity: 0;
  animation: ringExpand 1.5s infinite;
  z-index: 1;
}

@keyframes ringExpand {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.15);
    opacity: 0;
  }
}

/* 状态显示区域（玻璃效果） */
.floating-status-display {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
  margin-top: 10px;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.floating-status-display.recording {
  background: rgba(255, 182, 193, 0.1);
  box-shadow: inset 0 0 10px rgba(255, 182, 193, 0.2);
}

.floating-status-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  margin-bottom: 6px;
  z-index: 2;
}

.floating-status-text.pulse {
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

.floating-interim-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 10px;
  border-radius: 8px;
  margin-top: 6px;
  z-index: 2;
}

.interim-icon {
  font-size: 12px;
}

/* 不支持提示（玻璃效果） */
.floating-unsupported-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 243, 205, 0.15);
  border: 1px solid rgba(255, 234, 167, 0.3);
  border-radius: 12px;
  margin-top: 10px;
  backdrop-filter: blur(5px);
}

.notice-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.notice-content {
  flex: 1;
}

.notice-title {
  font-size: 11px;
  font-weight: 600;
  color: #856404;
  margin-bottom: 2px;
}

.notice-text {
  font-size: 10px;
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
  .floating-voice-controls {
    padding: 10px;
  }

  .floating-control-button {
    width: 44px;
    height: 44px;
  }

  .button-icon {
    font-size: 18px;
  }

  .button-text {
    font-size: 8px;
  }

  .floating-voice-status {
    padding: 8px 10px;
  }

  .status-icon {
    font-size: 16px;
  }

  .status-text {
    font-size: 11px;
  }
}

@media (min-width: 1920px) {
  .floating-voice-controls {
    padding: 16px;
  }

  .floating-control-button {
    width: 56px;
    height: 56px;
  }

  .button-icon {
    font-size: 22px;
  }

  .button-text {
    font-size: 10px;
  }

  .floating-voice-status {
    padding: 12px 14px;
  }

  .status-icon {
    font-size: 20px;
  }

  .status-text {
    font-size: 13px;
  }
}
</style>