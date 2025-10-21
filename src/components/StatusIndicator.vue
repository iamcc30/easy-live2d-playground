<script setup lang="ts">
import { computed } from 'vue'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

interface Props {
  state?: VoiceState
  isConnected?: boolean
  customMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  state: 'idle',
  isConnected: false,
  customMessage: ''
})

// 状态配置
const stateConfig = computed(() => {
  const configs: Record<VoiceState, { icon: string; text: string; color: string; animate: boolean }> = {
    idle: {
      icon: '💤',
      text: props.customMessage || '等待中...',
      color: 'rgba(255, 255, 255, 0.6)',
      animate: false
    },
    listening: {
      icon: '🎤',
      text: props.customMessage || '正在倾听您的声音...',
      color: '#ff6b6b',
      animate: true
    },
    processing: {
      icon: '🤔',
      text: props.customMessage || '思考中，请稍候...',
      color: '#feca57',
      animate: true
    },
    speaking: {
      icon: '🔊',
      text: props.customMessage || '正在回复...',
      color: '#4ecdc4',
      animate: true
    },
    error: {
      icon: '⚠️',
      text: props.customMessage || '发生错误',
      color: '#ff6b6b',
      animate: false
    }
  }

  return configs[props.state]
})

// 容器类
const containerClass = computed(() => ({
  'status-active': props.state !== 'idle',
  'status-listening': props.state === 'listening',
  'status-processing': props.state === 'processing',
  'status-speaking': props.state === 'speaking',
  'status-error': props.state === 'error',
  'status-disconnected': !props.isConnected
}))

// 点效果类
const dotClass = computed(() => ({
  'dot-pulse': stateConfig.value.animate
}))
</script>

<template>
  <div class="status-indicator" :class="containerClass">
    <!-- 状态光环 -->
    <div class="status-aura" v-if="state !== 'idle'"></div>

    <!-- 状态内容 -->
    <div class="status-content">
      <!-- 状态图标 -->
      <div class="status-icon-wrapper">
        <span class="status-icon" :class="{ pulse: stateConfig.animate }">
          {{ stateConfig.icon }}
        </span>
      </div>

      <!-- 状态文本 -->
      <div class="status-text-wrapper">
        <div class="status-text">{{ stateConfig.text }}</div>

        <!-- 状态点 -->
        <div class="status-dots" v-if="stateConfig.animate">
          <span class="status-dot" :class="dotClass"></span>
          <span class="status-dot" :class="dotClass" style="animation-delay: 0.2s"></span>
          <span class="status-dot" :class="dotClass" style="animation-delay: 0.4s"></span>
        </div>
      </div>

      <!-- 连接状态指示 -->
      <div class="connection-indicator" v-if="!isConnected">
        <span class="connection-dot"></span>
        <span class="connection-text">未连接</span>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar" v-if="state === 'processing' || state === 'listening'">
      <div class="progress-fill"></div>
    </div>
  </div>
</template>

<style scoped>
.status-indicator {
  position: relative;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  overflow: hidden;
}

.status-indicator.status-active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.status-indicator.status-listening {
  background: rgba(255, 107, 107, 0.1);
  border-color: rgba(255, 107, 107, 0.3);
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.2);
}

.status-indicator.status-processing {
  background: rgba(254, 202, 87, 0.1);
  border-color: rgba(254, 202, 87, 0.3);
  box-shadow: 0 4px 20px rgba(254, 202, 87, 0.2);
}

.status-indicator.status-speaking {
  background: rgba(78, 205, 196, 0.1);
  border-color: rgba(78, 205, 196, 0.3);
  box-shadow: 0 4px 20px rgba(78, 205, 196, 0.2);
}

.status-indicator.status-error {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.4);
}

.status-indicator.status-disconnected {
  opacity: 0.6;
}

/* 状态光环 */
.status-aura {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle,
    rgba(255, 255, 255, 0.1) 0%,
    transparent 70%
  );
  animation: auraRotate 4s linear infinite;
  pointer-events: none;
}

@keyframes auraRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 状态内容 */
.status-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 状态图标 */
.status-icon-wrapper {
  flex-shrink: 0;
}

.status-icon {
  font-size: 24px;
  display: inline-block;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
  transition: all 0.3s ease;
}

.status-icon.pulse {
  animation: iconPulse 1.5s infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* 状态文本 */
.status-text-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-text {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  line-height: 1.4;
}

/* 状态点 */
.status-dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  display: inline-block;
}

.status-dot.dot-pulse {
  animation: dotBounce 1.2s infinite ease-in-out;
}

@keyframes dotBounce {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 连接指示器 */
.connection-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 10px;
  margin-left: auto;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff6b6b;
  animation: connectionBlink 1s infinite;
}

@keyframes connectionBlink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}

.connection-text {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* 进度条 */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.3),
    rgba(255, 255, 255, 0.6),
    rgba(255, 255, 255, 0.3)
  );
  animation: progressSlide 1.5s infinite;
  width: 50%;
}

@keyframes progressSlide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .status-indicator {
    padding: 10px 12px;
  }

  .status-icon {
    font-size: 20px;
  }

  .status-text {
    font-size: 12px;
  }

  .connection-indicator {
    padding: 3px 8px;
  }

  .connection-text {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .status-indicator {
    padding: 8px 10px;
  }

  .status-icon {
    font-size: 18px;
  }

  .status-text {
    font-size: 11px;
  }

  .status-content {
    gap: 8px;
  }
}

@media (min-width: 1920px) {
  .status-indicator {
    padding: 14px 18px;
  }

  .status-icon {
    font-size: 28px;
  }

  .status-text {
    font-size: 14px;
  }
}
</style>
