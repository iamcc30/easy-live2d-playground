<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ListenMode } from '@/types/websocket'
import { voiceHaptics } from '@/utils/hapticFeedback'

interface Props {
  isRecording?: boolean
  isSpeaking?: boolean
  isConnected?: boolean
  currentMode?: ListenMode
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isRecording: false,
  isSpeaking: false,
  isConnected: false,
  currentMode: 'auto',
  disabled: false
})

const emit = defineEmits<{
  toggleRecording: []
  stopSpeaking: []
  changeMode: [mode: ListenMode]
}>()

// 模式选择器显示状态
const showModeSelector = ref(false)

// 长按状态（Push-to-Talk模式）
const isPushing = ref(false)
const pushTimer = ref<number | null>(null)

// 获取主按钮图标
const getMainIcon = computed(() => {
  if (props.isRecording) return '🔴'
  if (props.isSpeaking) return '🔊'
  return '🎤'
})

// 获取主按钮文本
const getMainText = computed(() => {
  if (props.isRecording) return '正在录音...'
  if (props.isSpeaking) return '正在播放...'
  return '点击说话'
})

// 获取主按钮状态类
const getMainButtonClass = computed(() => ({
  'recording': props.isRecording,
  'speaking': props.isSpeaking,
  'disabled': props.disabled || !props.isConnected,
  'pulsing': props.isRecording || props.isSpeaking
}))

// 模式配置
const modes: Array<{ value: ListenMode; icon: string; label: string; desc: string }> = [
  { value: 'auto', icon: '🤖', label: '自动模式', desc: '检测停顿后自动停止' },
  { value: 'manual', icon: '👆', label: '手动模式', desc: '需手动点击停止按钮' },
  { value: 'realtime', icon: '📡', label: '实时模式', desc: '持续监听，流式传输' }
]

// 获取当前模式配置
const currentModeConfig = computed(() => {
  return modes.find(m => m.value === props.currentMode) || modes[0]
})

// 切换录音
const handleToggleRecording = () => {
  if (props.disabled || !props.isConnected) return

  // 触觉反馈
  if (props.isRecording) {
    voiceHaptics.stopRecording()
  } else {
    voiceHaptics.startRecording()
  }

  emit('toggleRecording')
}

// 停止播放
const handleStopSpeaking = () => {
  if (!props.isSpeaking) return

  // 触觉反馈
  voiceHaptics.buttonTap()

  emit('stopSpeaking')
}

// 切换模式选择器
const toggleModeSelector = () => {
  voiceHaptics.buttonTap()
  showModeSelector.value = !showModeSelector.value
}

// 选择模式
const selectMode = (mode: ListenMode) => {
  voiceHaptics.modeSwitch()
  emit('changeMode', mode)
  showModeSelector.value = false
}

// Push-to-Talk 按下
const handleMouseDown = () => {
  if (props.disabled || !props.isConnected || props.isRecording) return
  isPushing.value = true

  // 短暂延迟后开始录音（防止误触）
  pushTimer.value = window.setTimeout(() => {
    emit('toggleRecording')
  }, 100)
}

// Push-to-Talk 释放
const handleMouseUp = () => {
  if (pushTimer.value) {
    clearTimeout(pushTimer.value)
    pushTimer.value = null
  }

  if (isPushing.value && props.isRecording) {
    emit('toggleRecording')
  }

  isPushing.value = false
}

// 触摸支持
const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  handleMouseDown()
}

const handleTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  handleMouseUp()
}
</script>

<template>
  <div class="voice-control-center">
    <!-- 主控制按钮 -->
    <div class="main-control-wrapper">
      <!-- 大型语音按钮 -->
      <button
        class="main-voice-button"
        :class="getMainButtonClass"
        :disabled="disabled || !isConnected"
        @click="handleToggleRecording"
        @mousedown="handleMouseDown"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchcancel="handleMouseUp"
      >
        <!-- 按钮光环效果 -->
        <div class="button-glow" v-if="isRecording || isSpeaking"></div>

        <!-- 按钮内容 -->
        <div class="button-content">
          <div class="button-icon">{{ getMainIcon }}</div>
          <div class="button-text">{{ getMainText }}</div>
        </div>

        <!-- 录音脉冲环 -->
        <div class="pulse-ring" v-if="isRecording"></div>
      </button>

      <!-- 未连接提示 -->
      <div class="connection-hint" v-if="!isConnected">
        <span class="hint-icon">⚠️</span>
        <span class="hint-text">请先连接服务器</span>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <!-- 模式选择器 -->
      <div class="mode-selector-wrapper">
        <button
          class="mode-selector-button"
          @click="toggleModeSelector"
          :title="currentModeConfig.desc"
        >
          <span class="mode-icon">{{ currentModeConfig.icon }}</span>
          <span class="mode-label">{{ currentModeConfig.label }}</span>
          <span class="mode-arrow" :class="{ rotated: showModeSelector }">▼</span>
        </button>

        <!-- 模式下拉菜单 -->
        <transition name="mode-dropdown">
          <div v-if="showModeSelector" class="mode-dropdown">
            <button
              v-for="mode in modes"
              :key="mode.value"
              class="mode-option"
              :class="{ active: currentMode === mode.value }"
              @click="selectMode(mode.value)"
            >
              <span class="option-icon">{{ mode.icon }}</span>
              <div class="option-content">
                <div class="option-title">{{ mode.label }}</div>
                <div class="option-desc">{{ mode.desc }}</div>
              </div>
              <span v-if="currentMode === mode.value" class="check-mark">✓</span>
            </button>
          </div>
        </transition>
      </div>

      <!-- 停止播放按钮 -->
      <button
        class="stop-button"
        :class="{ active: isSpeaking }"
        :disabled="!isSpeaking"
        @click="handleStopSpeaking"
        title="停止播放"
      >
        <span class="stop-icon">⏹️</span>
        <span class="stop-text">停止</span>
      </button>
    </div>

    <!-- 操作提示 -->
    <div class="control-hints">
      <div class="hint-item">
        <span class="hint-badge">💡</span>
        <span class="hint-content">按住说话或点击切换</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-control-center {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 主控制包装器 */
.main-control-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* 主语音按钮 */
.main-voice-button {
  position: relative;
  width: 120px;
  height: 120px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  background: linear-gradient(135deg,
    rgba(255, 182, 193, 0.2) 0%,
    rgba(255, 218, 185, 0.15) 100%
  );
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px rgba(255, 182, 193, 0.3),
    inset 0 0 20px rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.main-voice-button::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: buttonShimmer 3s infinite;
}

@keyframes buttonShimmer {
  0% {
    transform: translateX(-100%) translateY(-100%) rotate(45deg);
  }
  100% {
    transform: translateX(100%) translateY(100%) rotate(45deg);
  }
}

.main-voice-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow:
    0 12px 48px rgba(255, 182, 193, 0.4),
    inset 0 0 30px rgba(255, 255, 255, 0.15);
}

.main-voice-button:active:not(:disabled) {
  transform: scale(0.95);
}

.main-voice-button.recording {
  background: linear-gradient(135deg,
    rgba(255, 107, 107, 0.3) 0%,
    rgba(255, 182, 193, 0.25) 100%
  );
  border-color: rgba(255, 107, 107, 0.5);
  animation: recordingPulse 1.5s infinite;
}

.main-voice-button.speaking {
  background: linear-gradient(135deg,
    rgba(78, 205, 196, 0.3) 0%,
    rgba(149, 225, 211, 0.25) 100%
  );
  border-color: rgba(78, 205, 196, 0.5);
  animation: speakingPulse 1s infinite;
}

.main-voice-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(0.95);
}

@keyframes recordingPulse {
  0%, 100% {
    box-shadow:
      0 8px 32px rgba(255, 107, 107, 0.3),
      inset 0 0 20px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 12px 48px rgba(255, 107, 107, 0.5),
      inset 0 0 30px rgba(255, 255, 255, 0.15);
  }
}

@keyframes speakingPulse {
  0%, 100% {
    box-shadow:
      0 8px 32px rgba(78, 205, 196, 0.3),
      inset 0 0 20px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 12px 48px rgba(78, 205, 196, 0.5),
      inset 0 0 30px rgba(255, 255, 255, 0.15);
  }
}

/* 按钮光环 */
.button-glow {
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 182, 193, 0.4) 0%,
    transparent 70%
  );
  animation: glowPulse 2s infinite;
  pointer-events: none;
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 按钮内容 */
.button-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.button-icon {
  font-size: 40px;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
  transition: all 0.3s ease;
}

.main-voice-button.recording .button-icon {
  animation: iconBounce 0.6s infinite;
}

@keyframes iconBounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.button-text {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

/* 脉冲环 */
.pulse-ring {
  position: absolute;
  top: -15px;
  left: -15px;
  right: -15px;
  bottom: -15px;
  border: 3px solid rgba(255, 107, 107, 0.6);
  border-radius: 50%;
  animation: ringExpand 1.5s infinite;
  pointer-events: none;
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

/* 连接提示 */
.connection-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 234, 167, 0.15);
  border: 1px solid rgba(255, 234, 167, 0.3);
  border-radius: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
}

.hint-icon {
  font-size: 14px;
}

.hint-text {
  font-weight: 500;
}

/* 控制面板 */
.control-panel {
  display: flex;
  gap: 10px;
}

/* 模式选择器 */
.mode-selector-wrapper {
  position: relative;
  flex: 1;
}

.mode-selector-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.mode-selector-button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.mode-icon {
  font-size: 16px;
}

.mode-label {
  flex: 1;
  font-weight: 500;
  text-align: left;
}

.mode-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.mode-arrow.rotated {
  transform: rotate(180deg);
}

/* 模式下拉菜单 */
.mode-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  z-index: 1000;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
}

.mode-option:last-child {
  border-bottom: none;
}

.mode-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mode-option.active {
  background: rgba(78, 205, 196, 0.2);
}

.option-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.option-content {
  flex: 1;
}

.option-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.option-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.check-mark {
  font-size: 14px;
  color: rgba(78, 205, 196, 1);
  flex-shrink: 0;
}

.mode-dropdown-enter-active,
.mode-dropdown-leave-active {
  transition: all 0.2s ease;
}

.mode-dropdown-enter-from,
.mode-dropdown-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 停止按钮 */
.stop-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.stop-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.stop-button.active {
  background: rgba(255, 234, 167, 0.2);
  border-color: rgba(255, 234, 167, 0.4);
}

.stop-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stop-icon {
  font-size: 14px;
}

/* 操作提示 */
.control-hints {
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.hint-badge {
  font-size: 14px;
}

.hint-content {
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-voice-button {
    width: 100px;
    height: 100px;
  }

  .button-icon {
    font-size: 36px;
  }

  .button-text {
    font-size: 11px;
  }

  .control-panel {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .main-voice-button {
    width: 90px;
    height: 90px;
  }

  .button-icon {
    font-size: 32px;
  }

  .button-text {
    font-size: 10px;
  }

  .mode-selector-button,
  .stop-button {
    padding: 8px 10px;
    font-size: 12px;
  }
}

@media (min-width: 1920px) {
  .main-voice-button {
    width: 140px;
    height: 140px;
  }

  .button-icon {
    font-size: 48px;
  }

  .button-text {
    font-size: 14px;
  }
}
</style>
