<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  visible?: boolean
  intensity?: number // 0-1 强度
  type?: 'stars' | 'hearts' | 'flowers' | 'mixed'
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  intensity: 0.5,
  type: 'stars'
})

interface FloatingElement {
  id: number
  emoji: string
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  rotation: number
  rotationSpeed: number
}

const elements = ref<FloatingElement[]>([])
let animationId: number | null = null
let elementId = 0

// 根据类型获取emoji
const getEmojisByType = (type: string): string[] => {
  switch (type) {
    case 'stars':
      return ['⭐', '✨', '🌟', '💫', '✦', '✧']
    case 'hearts':
      return ['💕', '💖', '💗', '💝', '💘', '❤️']
    case 'flowers':
      return ['🌸', '🌺', '🌷', '🌹', '💐', '🌻']
    case 'mixed':
      return ['⭐', '💕', '🌸', '✨', '💖', '🌺']
    default:
      return ['⭐', '✨']
  }
}

// 创建浮动元素
const createElement = (): FloatingElement => {
  const emojis = getEmojisByType(props.type)
  return {
    id: ++elementId,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 16,
    speed: 0.5 + Math.random() * 1.5,
    opacity: 0.3 + Math.random() * 0.4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 2
  }
}

// 初始化元素
const initializeElements = () => {
  const count = Math.floor(props.intensity * 15) // 根据强度调整数量
  elements.value = Array.from({ length: count }, createElement)
}

// 更新元素位置
const updateElements = () => {
  if (!props.visible) return

  elements.value = elements.value.map(element => ({
    ...element,
    y: (element.y - element.speed * 0.1) % 100,
    rotation: element.rotation + element.rotationSpeed,
    opacity: element.opacity * (0.995 + Math.sin(Date.now() * 0.001 + element.id) * 0.005)
  }))

  // 偶尔添加新元素
  if (Math.random() < 0.02 * props.intensity) {
    elements.value.push(createElement())
    // 移除超出数量的元素
    if (elements.value.length > props.intensity * 20) {
      elements.value.shift()
    }
  }

  animationId = requestAnimationFrame(updateElements)
}

// 开始动画
const startAnimation = () => {
  initializeElements()
  updateElements()
}

// 停止动画
const stopAnimation = () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

onMounted(() => {
  if (props.visible) {
    startAnimation()
  }
})

onUnmounted(() => {
  stopAnimation()
})

// 监听可见性变化
watch(() => props.visible, (visible) => {
  if (visible) {
    startAnimation()
  } else {
    stopAnimation()
  }
})
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="floating-elements"
         :style="{ '--intensity': intensity }"
    >
      <div
        v-for="element in elements"
        :key="element.id"
        class="floating-element"
        :style="{
          left: element.x + '%',
          top: element.y + '%',
          fontSize: element.size + 'px',
          opacity: element.opacity,
          transform: `rotate(${element.rotation}deg)`,
          '--animation-delay': Math.random() * 2 + 's'
        }"
      >
        {{ element.emoji }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.floating-elements {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.floating-element {
  position: absolute;
  user-select: none;
  animation: float 6s infinite ease-in-out;
  animation-delay: var(--animation-delay, 0s);
  filter: drop-shadow(0 0 8px rgba(255, 182, 193, 0.6));
  transition: all 0.1s ease;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-10px) rotate(90deg) scale(1.1);
  }
  50% {
    transform: translateY(-5px) rotate(180deg) scale(0.9);
  }
  75% {
    transform: translateY(-15px) rotate(270deg) scale(1.05);
  }
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 特殊效果 - 说话时的增强 */
.floating-element:hover {
  filter: drop-shadow(0 0 15px rgba(255, 182, 193, 0.9));
  transform: scale(1.2);
}

/* 展示屏优化 */
@media (min-width: 1920px) {
  .floating-element {
    font-size: 1.2em;
  }
}

@media (max-width: 768px) {
  .floating-element {
    font-size: 0.8em;
  }
}
</style>