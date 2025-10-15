<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  visible?: boolean
  intensity?: number // 0-1 强度
  type?: 'bubbles' | 'sparkles' | 'clouds' | 'mixed'
  color?: string // 主色调
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  intensity: 0.3,
  type: 'bubbles',
  color: '#ffffff'
})

interface Particle {
  id: number
  type: 'bubble' | 'sparkle' | 'cloud'
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  rotation: number
  rotationSpeed: number
  color: string
  animationDelay: number
}

const particles = ref<Particle[]>([])
let animationId: number | null = null
let particleId = 0

// 粒子类型配置
const particleConfigs = {
  bubble: {
    shapes: ['○', '●', '◯'],
    colors: ['rgba(255,255,255,0.1)', 'rgba(255,182,193,0.1)', 'rgba(173,216,230,0.1)'],
    sizeRange: [8, 24],
    speedRange: [0.2, 0.8],
    opacityRange: [0.05, 0.15]
  },
  sparkle: {
    shapes: ['✨', '⭐', '💫', '✦', '✧'],
    colors: ['rgba(255,255,255,0.2)', 'rgba(255,215,0,0.2)', 'rgba(255,182,193,0.2)'],
    sizeRange: [10, 18],
    speedRange: [0.1, 0.5],
    opacityRange: [0.1, 0.3]
  },
  cloud: {
    shapes: ['☁️', '◡', '◠', '∿'],
    colors: ['rgba(255,255,255,0.08)', 'rgba(240,240,240,0.08)', 'rgba(255,250,250,0.08)'],
    sizeRange: [20, 40],
    speedRange: [0.05, 0.3],
    opacityRange: [0.03, 0.1]
  }
}

// 创建粒子
function createParticle(): Particle {
  const types = props.type === 'mixed'
    ? ['bubble', 'sparkle', 'cloud']
    : [props.type]

  const type = types[Math.floor(Math.random() * types.length)] as 'bubble' | 'sparkle' | 'cloud'
  const config = particleConfigs[type]

  return {
    id: ++particleId,
    type,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
    speed: config.speedRange[0] + Math.random() * (config.speedRange[1] - config.speedRange[0]),
    opacity: config.opacityRange[0] + Math.random() * (config.opacityRange[1] - config.opacityRange[0]),
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 2,
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    animationDelay: Math.random() * 4
  }
}

// 初始化粒子
const initializeParticles = () => {
  const count = Math.floor(props.intensity * 20) // 根据强度调整数量
  particles.value = Array.from({ length: count }, createParticle)
}

// 更新粒子位置
const updateParticles = () => {
  if (!props.visible) return

  particles.value = particles.value.map(particle => ({
    ...particle,
    y: (particle.y - particle.speed * 0.1) % 100,
    rotation: particle.rotation + particle.rotationSpeed,
    opacity: particle.opacity * (0.995 + Math.sin(Date.now() * 0.001 + particle.id) * 0.005),
    x: particle.x + Math.sin(Date.now() * 0.001 + particle.id) * 0.02
  }))

  // 偶尔添加新粒子
  if (Math.random() < 0.01 * props.intensity) {
    particles.value.push(createParticle())
    // 移除超出数量的粒子
    if (particles.value.length > props.intensity * 30) {
      particles.value.shift()
    }
  }

  animationId = requestAnimationFrame(updateParticles)
}

// 开始动画
const startAnimation = () => {
  initializeParticles()
  updateParticles()
}

// 停止动画
const stopAnimation = () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 获取粒子形状
function getParticleShape(particle: Particle): string {
  const config = particleConfigs[particle.type]
  return config.shapes[Math.floor(Math.random() * config.shapes.length)]
}

// 获取粒子样式
const getParticleStyle = (particle: Particle) => ({
  left: `${particle.x}%`,
  top: `${particle.y}%`,
  fontSize: `${particle.size}px`,
  opacity: particle.opacity,
  color: particle.color,
  transform: `rotate(${particle.rotation}deg)`,
  '--animation-delay': `${particle.animationDelay}s`
})

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
    <div v-if="visible" class="floating-particles"
         :style="{ '--intensity': intensity }"
    >
      <div
        v-for="particle in particles"
        :key="particle.id"
        class="particle"
        :class="[
          `particle-${particle.type}`,
          `particle-${particle.id % 3}`
        ]"
        :style="getParticleStyle(particle)"
      >
        {{ getParticleShape(particle) }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.floating-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.particle {
  position: absolute;
  user-select: none;
  animation: particleFloat 8s infinite ease-in-out;
  animation-delay: var(--animation-delay, 0s);
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
  transition: all 0.1s ease;
}

/* 粒子浮动动画 */
@keyframes particleFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-15px) rotate(90deg) scale(1.1);
  }
  50% {
    transform: translateY(-8px) rotate(180deg) scale(0.9);
  }
  75% {
    transform: translateY(-20px) rotate(270deg) scale(1.05);
  }
}

/* 气泡粒子 */
.particle-bubble {
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
  animation-duration: 10s;
}

.particle-bubble:nth-child(3n) {
  animation-duration: 12s;
  animation-delay: 1s;
}

.particle-bubble:nth-child(3n+1) {
  animation-duration: 8s;
  animation-delay: 2s;
}

/* 闪光粒子 */
.particle-sparkle {
  filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.6));
  animation-duration: 6s;
}

.particle-sparkle:nth-child(3n) {
  animation-duration: 7s;
  animation-delay: 0.5s;
}

.particle-sparkle:nth-child(3n+1) {
  animation-duration: 5s;
  animation-delay: 1.5s;
}

/* 云朵粒子 */
.particle-cloud {
  filter: drop-shadow(0 0 15px rgba(240, 240, 240, 0.3));
  animation-duration: 15s;
}

.particle-cloud:nth-child(3n) {
  animation-duration: 18s;
  animation-delay: 2s;
}

.particle-cloud:nth-child(3n+1) {
  animation-duration: 12s;
  animation-delay: 3s;
}

/* 特殊效果 */
.particle-0 {
  animation-timing-function: ease-in-out;
}

.particle-1 {
  animation-timing-function: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.particle-2 {
  animation-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 鼠标悬停效果 */
.particle:hover {
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
  transform: scale(1.2);
  animation-play-state: paused;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式强度调整 */
@media (max-width: 768px) {
  .particle {
    font-size: 0.8em !important;
  }
}

@media (min-width: 1920px) {
  .particle {
    font-size: 1.2em !important;
  }
}
</style>