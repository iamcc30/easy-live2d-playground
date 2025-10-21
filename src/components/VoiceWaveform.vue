<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  isActive?: boolean
  isRecording?: boolean
  isSpeaking?: boolean
  audioLevel?: number
  barCount?: number
  color?: string
  glowColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  isRecording: false,
  isSpeaking: false,
  audioLevel: 0,
  barCount: 32,
  color: '#ff9a9e',
  glowColor: '#fecfef'
})

// 波形数据
const waveformBars = ref<number[]>([])
let animationFrameId: number | null = null

// 初始化波形条
onMounted(() => {
  waveformBars.value = Array(props.barCount).fill(0)
  if (props.isActive) {
    startAnimation()
  }
})

// 监听活跃状态
watch(() => props.isActive, (active) => {
  if (active) {
    startAnimation()
  } else {
    stopAnimation()
  }
})

// 开始动画
function startAnimation() {
  const animate = () => {
    if (!props.isActive) return

    // 根据录音或播放状态更新波形
    if (props.isRecording || props.isSpeaking) {
      // 实时音频波形动画
      waveformBars.value = waveformBars.value.map((_, index) => {
        const baseLevel = props.audioLevel || 0.3
        const randomFactor = Math.random() * 0.7
        const wavePhase = Math.sin(Date.now() / 200 + index * 0.3)
        return baseLevel * randomFactor * (0.5 + wavePhase * 0.5)
      })
    } else {
      // 空闲状态 - 微弱呼吸效果
      waveformBars.value = waveformBars.value.map((_, index) => {
        const breathPhase = Math.sin(Date.now() / 2000 + index * 0.1)
        return 0.05 + breathPhase * 0.05
      })
    }

    animationFrameId = requestAnimationFrame(animate)
  }
  animate()
}

// 停止动画
function stopAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  // 平滑归零
  waveformBars.value = waveformBars.value.map(() => 0)
}

// 清理
onUnmounted(() => {
  stopAnimation()
})

// 计算样式
const getBarStyle = (height: number) => ({
  height: `${Math.max(2, height * 100)}%`,
  background: props.isRecording
    ? `linear-gradient(to top, ${props.color}, ${props.glowColor})`
    : props.isSpeaking
    ? `linear-gradient(to top, #4ecdc4, #95e1d3)`
    : `linear-gradient(to top, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1))`,
  boxShadow: (props.isRecording || props.isSpeaking)
    ? `0 0 10px ${props.isRecording ? props.glowColor : '#95e1d3'}`
    : 'none'
})

// 容器样式
const containerClass = computed(() => ({
  'waveform-active': props.isActive,
  'waveform-recording': props.isRecording,
  'waveform-speaking': props.isSpeaking
}))
</script>

<template>
  <div class="voice-waveform" :class="containerClass">
    <div
      v-for="(barHeight, index) in waveformBars"
      :key="index"
      class="waveform-bar"
      :style="getBarStyle(barHeight)"
    >
    </div>
  </div>
</template>

<style scoped>
.voice-waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 60px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.voice-waveform::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
  animation: shimmer 2s infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.voice-waveform.waveform-active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.voice-waveform.waveform-recording {
  background: rgba(255, 182, 193, 0.1);
  border-color: rgba(255, 182, 193, 0.3);
  box-shadow:
    0 4px 20px rgba(255, 182, 193, 0.2),
    inset 0 0 20px rgba(255, 182, 193, 0.1);
}

.voice-waveform.waveform-speaking {
  background: rgba(78, 205, 196, 0.1);
  border-color: rgba(78, 205, 196, 0.3);
  box-shadow:
    0 4px 20px rgba(78, 205, 196, 0.2),
    inset 0 0 20px rgba(78, 205, 196, 0.1);
}

.waveform-bar {
  flex: 1;
  min-width: 2px;
  max-width: 4px;
  border-radius: 2px;
  transition: all 0.15s ease;
  transform-origin: bottom;
  position: relative;
}

.waveform-recording .waveform-bar {
  animation: barPulse 0.8s infinite ease-in-out;
}

.waveform-speaking .waveform-bar {
  animation: barPulse 0.6s infinite ease-in-out;
}

@keyframes barPulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .voice-waveform {
    height: 50px;
    padding: 6px 10px;
    gap: 1.5px;
  }
}

@media (max-width: 480px) {
  .voice-waveform {
    height: 40px;
    padding: 4px 8px;
    gap: 1px;
  }

  .waveform-bar {
    min-width: 1.5px;
    max-width: 3px;
  }
}

@media (min-width: 1920px) {
  .voice-waveform {
    height: 80px;
    padding: 10px 16px;
    gap: 3px;
  }

  .waveform-bar {
    min-width: 3px;
    max-width: 5px;
  }
}
</style>
