<script setup lang="ts">
import { ref, computed } from 'vue'
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

// 语音识别是否可用
const isRecognitionAvailable = computed(() => speechService.isRecognitionSupported())

// 开始语音识别
const startRecording = () => {
  if (!isRecognitionAvailable.value) {
    recordingStatus.value = '语音识别不支持'
    return
  }

  isRecording.value = true
  emit('recordingChange', true)
  recordingStatus.value = '正在聆听...'
  interimText.value = ''

  speechService.startRecognition(
    (result) => {
      if (result.isFinal) {
        // 识别完成
        emit('voiceInput', result.transcript)
        interimText.value = ''
        stopRecording()
      } else {
        // 临时结果
        interimText.value = result.transcript
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
    chatStore.recognitionLang
  )
}

// 停止语音识别
const stopRecording = () => {
  if (!isRecording.value) return

  isRecording.value = false
  emit('recordingChange', false)
  recordingStatus.value = ''
  interimText.value = ''

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
}
</script>

<template>
  <div class="voice-controls">
    <!-- 语音识别控制 -->
    <div class="voice-recognition">
      <button
        @click="toggleRecording"
        :class="[
          'voice-button',
          'record-button',
          {
            'recording': isRecording,
            'disabled': !isRecognitionAvailable
          }
        ]"
        :disabled="!isRecognitionAvailable"
        title="按住说话"
      >
        <span v-if="!isRecording" class="icon">🎤</span>
        <span v-else class="icon recording-icon">🔴</span>
        <span class="button-text">{{ isRecording ? '录音中...' : '语音输入' }}</span>
      </button>

      <button
        @click="toggleVoiceLang"
        class="voice-button lang-button"
        :title="`当前语言: ${chatStore.recognitionLang === 'zh-CN' ? '中文' : '英文'}`"
      >
        <span class="icon">🌐</span>
        <span class="button-text">{{ chatStore.recognitionLang === 'zh-CN' ? '中文' : 'EN' }}</span>
      </button>

      <button
        @click="stopSpeaking"
        :disabled="!chatStore.isSpeaking"
        class="voice-button stop-button"
        title="停止播放"
      >
        <span class="icon">⏹️</span>
        <span class="button-text">停止</span>
      </button>
    </div>

    <!-- 状态显示 -->
    <div v-if="recordingStatus || interimText" class="voice-status">
      <div v-if="recordingStatus" class="status-text">{{ recordingStatus }}</div>
      <div v-if="interimText" class="interim-text">{{ interimText }}</div>
    </div>

    <!-- 不支持提示 -->
    <div v-if="!isRecognitionAvailable" class="unsupported-notice">
      ⚠️ 您的浏览器不支持语音识别功能
    </div>
  </div>
</template>

<style scoped>
.voice-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-recognition {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.voice-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  min-height: 36px;
}

.voice-button:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #bbb;
}

.voice-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.record-button {
  background: #e8f4fd;
  border-color: #007bff;
  color: #007bff;
}

.record-button:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.record-button.recording {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
  animation: pulse 1.5s infinite;
}

.lang-button {
  background: #f8f9fa;
  border-color: #6c757d;
  color: #6c757d;
}

.stop-button {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.icon {
  font-size: 16px;
}

.recording-icon {
  animation: blink 1s infinite;
}

.button-text {
  font-weight: 500;
}

.voice-status {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #666;
}

.status-text {
  font-weight: 500;
  color: #007bff;
  margin-bottom: 4px;
}

.interim-text {
  font-style: italic;
  color: #999;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  margin-top: 4px;
}

.unsupported-notice {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  text-align: center;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
  }
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}
</style>