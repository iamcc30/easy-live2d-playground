<script setup lang="ts">
import { Config, CubismSetting, Live2DSprite, LogLevel } from 'easy-live2d'
import { Application, Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { lipSyncService } from '@/utils/lipSync'
import FloatingChatInterface from '@/components/FloatingChatInterface.vue'
import ErrorNotification from '@/components/ErrorNotification.vue'

const chatStore = useChatStore()
const canvasRef = ref<HTMLCanvasElement>()
const app = new Application()
let handleResize: (() => void) | null = null
let resizeTimeout: number | null = null

// 移动端触摸支持
const isMobile = ref(false)
const touchStartTime = ref(0)

// 居中模型的辅助函数
const centerModel = () => {
  if (canvasRef.value) {
    // 确保锚点始终在中心
    live2DSprite.anchor.set(0.5, 0.5)

    // 设置模型位置到画布中心
    live2DSprite.x = canvasRef.value.clientWidth / 2
    live2DSprite.y = canvasRef.value.clientHeight / 2
  }
}

// 设置 Config 默认配置
Config.MotionGroupIdle = 'Idle' // 设置默认的空闲动作组
// Config.MouseFollow = false // 禁用鼠标跟随
Config.CubismLoggingLevel = LogLevel.LogLevel_Off // 设置日志级别

// 创建Live2D精灵 并初始化
const live2DSprite = new Live2DSprite()
live2DSprite.init({
  modelPath: '/Resources/Hiyori/Hiyori.model3.json',
  ticker: Ticker.shared,
})

// 监听点击事件
live2DSprite.onLive2D('hit', ({ hitAreaName, x, y }) => {
  console.log('✨ 点击了:', hitAreaName, '位置:', x, y)

  // 触发互动效果
  if (hitAreaName === 'Head') {
    live2DSprite.setExpression({ expressionId: 'happy' })
    setTimeout(() => {
      live2DSprite.setExpression({ expressionId: 'normal' })
    }, 2000)
  } else if (hitAreaName === 'Body') {
    live2DSprite.startMotion({
      group: 'TapBody',
      no: 0,
      priority: 2,
    })
  }
})

// 触摸事件处理（移动端支持）
const handleTouchStart = (e: TouchEvent) => {
  touchStartTime.value = Date.now()
  // 阻止默认行为，避免移动端长按选择等问题
  if (isMobile.value) {
    e.preventDefault()
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  const touchDuration = Date.now() - touchStartTime.value

  // 只处理短触摸（点击）事件，避免滑动被识别为点击
  if (touchDuration < 300 && canvasRef.value) {
    const touch = e.changedTouches[0]
    const rect = canvasRef.value.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    console.log('📱 触摸交互:', x, y)

    // 触发随机互动动画
    const randomActions = ['happy', 'surprised', 'normal']
    const randomExpression = randomActions[Math.floor(Math.random() * randomActions.length)]

    live2DSprite.setExpression({ expressionId: randomExpression })
    setTimeout(() => {
      live2DSprite.setExpression({ expressionId: 'normal' })
    }, 2000)
  }
}

onMounted(async () => {
  // 检测是否为移动设备
  isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)

  console.log('📱 移动设备检测:', isMobile.value)

  // 初始化PixiJS应用（移动端优化）
  await app.init({
    view: canvasRef.value,
    backgroundAlpha: 0,
    antialias: !isMobile.value, // 移动端禁用抗锯齿提升性能
    resolution: isMobile.value ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio, // 移动端限制分辨率
    autoDensity: true,
    powerPreference: isMobile.value ? 'low-power' : 'high-performance', // 移动端使用低功耗模式
  })

  if (canvasRef.value) {
    // 移动端使用更低的分辨率倍数
    const pixelRatio = isMobile.value ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio

    live2DSprite.width = canvasRef.value.clientWidth * pixelRatio
    live2DSprite.height = canvasRef.value.clientHeight * pixelRatio

    // 使用居中函数设置模型位置
    // centerModel()

    app.stage.addChild(live2DSprite)

    // 设置初始表情
    live2DSprite.setExpression({
      expressionId: 'normal',
    })

    // 设置嘴型同步服务
    lipSyncService.setLive2DSprite(live2DSprite)

    // 添加入场动画
    setTimeout(() => {
      live2DSprite.startMotion({
        group: 'Idle',
        no: 0,
        priority: 1,
      })
    }, 1000)

    // 添加移动端触摸事件监听
    if (isMobile.value) {
      canvasRef.value.addEventListener('touchstart', handleTouchStart, { passive: false })
      canvasRef.value.addEventListener('touchend', handleTouchEnd, { passive: false })
      console.log('✅ 移动端触摸事件已启用')
    }
  }

  // 监听窗口大小变化（带防抖）
  handleResize = () => {
    if (canvasRef.value) {
      // 移动端使用更低的分辨率倍数
      const pixelRatio = isMobile.value ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio

      // 更新画布尺寸
      live2DSprite.width = canvasRef.value.clientWidth * pixelRatio
      live2DSprite.height = canvasRef.value.clientHeight * pixelRatio

      // 重新渲染画布
      app.renderer.resize(canvasRef.value.clientWidth, canvasRef.value.clientHeight)
    }
  }

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize)
})

// 监听语音播放状态，控制嘴型同步
watch(() => chatStore.isSpeaking, (isSpeaking) => {
  if (isSpeaking) {
    // 开始嘴型同步
    lipSyncService.startLipSync()
  }
  else {
    // 停止嘴型同步
    lipSyncService.stopLipSync()
  }
})

// 监听情感状态变化，更新Live2D表情
watch(() => chatStore.currentEmotion, (emotion) => {
  if (!emotion || emotion === 'normal') {
    live2DSprite.setExpression({ expressionId: 'normal' })
    return
  }

  // 根据情感类型设置对应的表情
  const emotionMap: Record<string, string> = {
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    normal: 'normal'
  }

  const expressionId = emotionMap[emotion] || 'normal'
  live2DSprite.setExpression({ expressionId })

  console.log(`😊 Setting emotion: ${emotion} -> ${expressionId}`)

  // 3秒后恢复normal表情
  setTimeout(() => {
    if (chatStore.currentEmotion === emotion) {
      live2DSprite.setExpression({ expressionId: 'normal' })
    }
  }, 3000)
})

onUnmounted(() => {
  // 停止嘴型同步
  lipSyncService.stopLipSync()

  // 释放Live2D实例
  live2DSprite.destroy()

  // 清理窗口大小变化监听
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }

  // 清理移动端触摸事件监听
  if (canvasRef.value && isMobile.value) {
    canvasRef.value.removeEventListener('touchstart', handleTouchStart)
    canvasRef.value.removeEventListener('touchend', handleTouchEnd)
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Live2D 模型显示区域 -->
    <div class="live2d-container">
      <canvas
        id="live2d"
        ref="canvasRef"
      />
    </div>

    <!-- 浮动聊天界面 -->
    <div class="floating-chat-overlay">
      <FloatingChatInterface />
    </div>
  </div>

  <!-- 错误通知组件 -->
  <ErrorNotification />
</template>

<style>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Comic Sans MS', 'Microsoft YaHei', sans-serif;
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
  touch-action: pan-y; /* 允许垂直滚动 */
}

.live2d-container {
  flex: 1;
  position: relative;
  background: radial-gradient(ellipse at center,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(0, 0, 0, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

#live2d {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  transition: transform 0.3s ease;
  object-fit: contain;
  object-position: center;
  -webkit-tap-highlight-color: transparent; /* 移除 iOS 点击高亮 */
  touch-action: manipulation; /* 移动端触摸优化 */
  user-select: none; /* 防止长按选择 */
  -webkit-user-select: none;
}

#live2d:hover {
  transform: scale(1.02);
}

.chat-container {
  width: 420px;
  background: linear-gradient(135deg,
    rgba(255, 182, 193, 0.95) 0%,
    rgba(255, 192, 203, 0.9) 25%,
    rgba(255, 218, 185, 0.85) 50%,
    rgba(255, 160, 122, 0.8) 75%,
    rgba(255, 182, 193, 0.9) 100%
  );
  border-left: 3px solid rgba(255, 255, 255, 0.3);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(20px);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.chat-container:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  pointer-events: none;
}

.chat-header {
  padding: 20px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 182, 193, 0.3) 100%
  );
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  text-align: center;
  position: relative;
  backdrop-filter: blur(10px);
}

.chat-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #fff 0%, #ffeaa7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.chat-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: rgba(255, 182, 193, 0.3);
  box-shadow: 0 0 20px rgba(255, 182, 193, 0.4);
  animation: statusGlow 2s infinite;
}

@keyframes statusGlow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 182, 193, 0.4);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 182, 193, 0.6);
  }
}

.status-icon {
  font-size: 14px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

.status-text {
  font-weight: 500;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  position: relative;
  z-index: 1;
}

/* 浮动聊天界面覆盖层 */
.floating-chat-overlay {
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  height: 100vh;
  z-index: 1000;
  pointer-events: none;
  max-height: 100vh;
  overflow: hidden;
}

.floating-chat-overlay > * {
  pointer-events: auto;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .app-container {
    flex-direction: column;
  }

  .floating-chat-overlay {
    width: 100%;
    height: 45vh;
    top: auto;
    bottom: 0;
    right: 0;
    max-height: 45vh;
  }

  .live2d-container {
    height: 55vh;
    min-height: 300px; /* 确保最小高度 */
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  #live2d {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain; /* 保持模型比例 */
  }
}

@media (max-width: 768px) {
  .floating-chat-overlay {
    height: 50vh;
    max-height: 50vh;
  }

  .live2d-container {
    height: 50vh;
    min-height: 250px; /* 移动设备最小高度 */
  }

  #live2d {
    object-fit: contain;
    max-width: 100%;
    max-height: 100%;
  }
}

@media (max-width: 480px) {
  .floating-chat-overlay {
    height: 55vh;
    max-height: 55vh;
  }

  .live2d-container {
    height: 45vh;
    min-height: 200px; /* 小屏幕设备最小高度 */
  }

  #live2d {
    object-fit: contain;
    max-width: 100%;
    max-height: 100%;
  }
}

@media (min-width: 1920px) {
  .app-container {
    font-size: 18px;
  }

  .floating-chat-overlay {
    width: 480px;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .floating-chat-overlay {
    -webkit-overflow-scrolling: touch;
  }
}

/* 展示屏专用样式 */
@media (min-width: 1920px) and (min-height: 1080px) {
  .app-container {
    font-size: 20px;
  }

  .floating-chat-overlay {
    width: 520px;
  }
}
</style>