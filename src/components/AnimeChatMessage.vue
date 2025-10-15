<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ChatMessage } from '@/stores/chat'

interface Props {
  message: ChatMessage
  userAvatar: string
  aiAvatar: string
  isLatest?: boolean
}

const props = defineProps<Props>()

const messageRef = ref<HTMLElement>()
const isHovered = ref(false)
const isAnimating = ref(true)

// 计算属性
const messageClasses = computed(() => [
  'anime-message',
  props.message.isUser ? 'message-user' : 'message-ai',
  {
    'is-latest': props.isLatest,
    'animating': isAnimating.value,
    'hovered': isHovered.value
  }
])

const avatar = computed(() =>
  props.message.isUser ? props.userAvatar : props.aiAvatar
)

const formatTime = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

// 获取消息内容（支持多行文本）
const getMessageLines = (text: string): string[] => {
  return text.split('\n').filter(line => line.trim() !== '')
}

// 处理鼠标悬停
const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

// 动画完成
const handleAnimationEnd = () => {
  isAnimating.value = false
}

onMounted(() => {
  // 最新消息添加特殊效果
  if (props.isLatest) {
    setTimeout(() => {
      isAnimating.value = false
    }, 1000)
  }
})
</script>

<template>
  <div
    :class="messageClasses"
    ref="messageRef"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @animationend="handleAnimationEnd"
  >
    <!-- 头像 -->
    <div class="avatar-container"
         :class="{ 'user-avatar': message.isUser, 'ai-avatar': !message.isUser }"
    >
      <div class="avatar"
           :class="{ pulse: isLatest }">
        {{ avatar }}
      </div>
      <div class="avatar-glow"
           v-if="isLatest"
      ></div>
    </div>

    <!-- 消息内容 -->
    <div class="message-content"
         :class="{ 'user-content': message.isUser, 'ai-content': !message.isUser }"
    >
      <!-- 消息气泡 -->
      <div class="message-bubble"
           :class="{
             'user-bubble': message.isUser,
             'ai-bubble': !message.isUser,
             'hovered': isHovered
           }"
      >
        <!-- 装饰元素 -->
        <div class="bubble-decoration top-left">✨</div>
        <div class="bubble-decoration top-right">✨</div>
        <div class="bubble-decoration bottom-left">✨</div>
        <div class="bubble-decoration bottom-right">✨</div>

        <!-- 消息文本 -->
        <div class="message-text">
          <div
            v-for="(line, index) in getMessageLines(message.text)"
            :key="index"
            class="message-line"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            {{ line }}
          </div>
        </div>

        <!-- 时间戳 -->
        <div class="message-time"
             :class="{ 'user-time': message.isUser, 'ai-time': !message.isUser }"
        >
          <span class="time-icon">🕐</span>
          {{ formatTime(message.timestamp) }}
        </div>
      </div>

      <!-- 尾巴装饰 -->
      <div class="message-tail"
           :class="{ 'user-tail': message.isUser, 'ai-tail': !message.isUser }"
      ></div>

      <!-- 特效元素（仅最新消息） -->
      <div v-if="isLatest" class="special-effects"
           :class="{ active: isLatest }"
      >
        <div class="sparkle sparkle-1">✨</div>
        <div class="sparkle sparkle-2">✨</div>
        <div class="sparkle sparkle-3">✨</div>
        <div class="heart heart-1">💕</div>
        <div class="heart heart-2">💖</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anime-message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: messageAppear 0.6s ease-out;
  position: relative;
}

.anime-message.message-user {
  flex-direction: row-reverse;
}

.anime-message.message-ai {
  flex-direction: row;
}

@keyframes messageAppear {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 头像样式 */
.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  z-index: 2;
}

.avatar.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.avatar.ai-avatar {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
}

.avatar:hover {
  transform: scale(1.1) rotate(5deg);
}

.avatar.pulse {
  animation: avatarPulse 1.5s infinite;
}

@keyframes avatarPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.avatar-glow {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 50%;
  background: linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e);
  animation: glowRotate 2s linear infinite;
  z-index: 1;
}

@keyframes glowRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 消息内容 */
.message-content {
  flex: 1;
  min-width: 0;
  position: relative;
}

/* 消息气泡 */
.message-bubble {
  position: relative;
  padding: 16px 20px;
  max-width: 70%;
  word-wrap: break-word;
  animation: bubbleAppear 0.5s ease-out;
  transition: all 0.3s ease;
}

@keyframes bubbleAppear {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.message-bubble.user-bubble {
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.9) 0%,
    rgba(118, 75, 162, 0.9) 100%
  );
  color: white;
  border-radius: 20px 20px 5px 20px;
  margin-left: auto;
  box-shadow:
    0 8px 25px rgba(102, 126, 234, 0.3),
    inset 0 0 15px rgba(255, 255, 255, 0.1);
}

.message-bubble.ai-bubble {
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 192, 203, 0.9) 100%
  );
  color: #333;
  border-radius: 20px 20px 20px 5px;
  box-shadow:
    0 8px 25px rgba(255, 182, 193, 0.3),
    inset 0 0 15px rgba(255, 255, 255, 0.2);
}

.message-bubble:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 30px rgba(255, 182, 193, 0.4),
    inset 0 0 20px rgba(255, 255, 255, 0.3);
}

/* 气泡装饰 */
.bubble-decoration {
  position: absolute;
  font-size: 12px;
  opacity: 0.6;
  animation: sparkle 2s infinite;
}

.bubble-decoration.top-left {
  top: 8px;
  left: 8px;
}

.bubble-decoration.top-right {
  top: 8px;
  right: 8px;
}

.bubble-decoration.bottom-left {
  bottom: 8px;
  left: 8px;
}

.bubble-decoration.bottom-right {
  bottom: 8px;
  right: 8px;
}

@keyframes sparkle {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

/* 消息文本 */
.message-text {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}

.message-line {
  margin-bottom: 4px;
  animation: textAppear 0.4s ease-out;
}

@keyframes textAppear {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 时间戳 */
.message-time {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.message-time.user-time {
  color: rgba(255, 255, 255, 0.8);
  justify-content: flex-end;
}

.message-time.ai-time {
  color: rgba(0, 0, 0, 0.6);
  justify-content: flex-start;
}

.time-icon {
  font-size: 10px;
}

/* 消息尾巴 */
.message-tail {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.message-tail.user-tail {
  right: -8px;
  top: 20px;
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent rgba(102, 126, 234, 0.9);
}

.message-tail.ai-tail {
  left: -8px;
  top: 20px;
  border-width: 8px 8px 8px 0;
  border-color: transparent rgba(255, 255, 255, 0.95) transparent transparent;
}

/* 特效元素 */
.special-effects {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.special-effects.active .sparkle,
.special-effects.active .heart {
  animation: effectFloat 2s infinite ease-in-out;
}

.sparkle {
  position: absolute;
  font-size: 16px;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8));
}

.sparkle-1 {
  top: -10px;
  left: -10px;
  animation-delay: 0s;
}

.sparkle-2 {
  top: -5px;
  right: -10px;
  animation-delay: 0.7s;
}

.sparkle-3 {
  bottom: -10px;
  left: 50%;
  animation-delay: 1.4s;
}

.heart {
  position: absolute;
  font-size: 14px;
  filter: drop-shadow(0 0 8px rgba(255, 182, 193, 0.8));
}

.heart-1 {
  top: 50%;
  right: -15px;
  animation-delay: 0.3s;
}

.heart-2 {
  bottom: -5px;
  left: -10px;
  animation-delay: 1s;
}

@keyframes effectFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translateY(-10px) scale(1.2);
    opacity: 1;
  }
}

/* 最新消息特殊样式 */
.anime-message.is-latest {
  z-index: 10;
}

.anime-message.is-latest .message-bubble {
  animation: latestMessageGlow 2s infinite;
}

@keyframes latestMessageGlow {
  0%, 100% {
    box-shadow:
      0 8px 25px rgba(255, 182, 193, 0.3),
      inset 0 0 15px rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
      0 12px 35px rgba(255, 182, 193, 0.5),
      inset 0 0 20px rgba(255, 255, 255, 0.3);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .anime-message {
    gap: 8px;
    margin-bottom: 12px;
  }

  .avatar {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .message-bubble {
    padding: 12px 16px;
    max-width: 75%;
  }

  .message-text {
    font-size: 13px;
  }

  .message-time {
    font-size: 10px;
  }
}

@media (min-width: 1920px) {
  .anime-message {
    gap: 16px;
    margin-bottom: 20px;
  }

  .avatar {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }

  .message-bubble {
    padding: 20px 24px;
  }

  .message-text {
    font-size: 16px;
  }

  .message-time {
    font-size: 12px;
  }
}
</style>