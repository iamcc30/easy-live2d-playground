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
  'floating-message',
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
function getMessageLines(text: string): string[] {
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
    <!-- 头像（玻璃效果）-->
    <div class="floating-avatar-container"
         :class="{ 'user-avatar': message.isUser, 'ai-avatar': !message.isUser }"
    >
      <div class="floating-avatar"
           :class="{ pulse: isLatest }">
        {{ avatar }}
      </div>
      <div class="avatar-glow"
           v-if="isLatest"
      ></div>
    </div>

    <!-- 消息内容（玻璃气泡）-->
    <div class="floating-message-content"
         :class="{ 'user-content': message.isUser, 'ai-content': !message.isUser }"
    >
      <!-- 玻璃气泡 -->
      <div class="floating-message-bubble"
           :class="{
             'user-bubble': message.isUser,
             'ai-bubble': !message.isUser,
             'hovered': isHovered
           }"
      >
        <!-- 玻璃效果背景 -->
        <div class="bubble-glass"
             :class="{ speaking: isLatest }"
        ></div>

        <!-- 消息文本 -->
        <div class="message-text"
             :class="{ 'user-text': message.isUser, 'ai-text': !message.isUser }"
        >
          <div
            v-for="(line, index) in getMessageLines(message.text)"
            :key="index"
            class="message-line"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            {{ line }}
          </div>
        </div>

        <!-- 时间戳（玻璃效果）-->
        <div class="message-time"
             :class="{ 'user-time': message.isUser, 'ai-time': !message.isUser }"
        >
          <span class="time-icon">🕐</span>
          {{ formatTime(message.timestamp) }}
        </div>
      </div>

      <!-- 浮动尾巴 -->
      <div class="floating-message-tail"
           :class="{ 'user-tail': message.isUser, 'ai-tail': !message.isUser }"
      ></div>

      <!-- 特效元素（仅最新消息）-->
      <div v-if="isLatest" class="floating-effects"
           :class="{ active: isLatest }"
      >
        <div class="floating-sparkle sparkle-1">✨</div>
        <div class="floating-sparkle sparkle-2">✨</div>
        <div class="floating-sparkle sparkle-3">✨</div>
        <div class="floating-heart heart-1">💫</div>
        <div class="floating-heart heart-2">💫</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-message {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  animation: floatingMessageAppear 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
}

.floating-message.message-user {
  flex-direction: row-reverse;
}

.floating-message.message-ai {
  flex-direction: row;
}

@keyframes floatingMessageAppear {
  0% {
    opacity: 0;
    transform: translateY(25px) scale(0.9) rotate(-2deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
  }
}

/* 浮动头像（玻璃效果） */
.floating-avatar-container {
  position: relative;
  flex-shrink: 0;
  z-index: 2;
}

.floating-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  z-index: 2;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.floating-avatar.user-avatar {
  background: rgba(102, 126, 234, 0.15);
  color: rgba(102, 126, 234, 0.9);
}

.floating-avatar.ai-avatar {
  background: rgba(255, 182, 193, 0.15);
  color: rgba(255, 182, 193, 0.9);
}

.floating-avatar:hover {
  transform: scale(1.15) rotate(5deg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.floating-avatar.pulse {
  animation: avatarPulse 1.5s infinite;
}

@keyframes avatarPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

.avatar-glow {
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border-radius: 50%;
  background: linear-gradient(45deg,
    rgba(255, 182, 193, 0.3),
    rgba(255, 255, 255, 0.3),
    rgba(255, 182, 193, 0.3)
  );
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

/* 浮动消息内容 */
.floating-message-content {
  flex: 1;
  min-width: 0;
  position: relative;
}

/* 浮动消息气泡（玻璃拟态） */
.floating-message-bubble {
  position: relative;
  padding: 12px 16px;
  max-width: 75%;
  word-wrap: break-word;
  animation: floatingBubbleAppear 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transition: all 0.3s ease;
  border-radius: 18px;
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

@keyframes floatingBubbleAppear {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.bubble-glass {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  transition: all 0.3s ease;
}

.bubble-glass.speaking {
  background: linear-gradient(135deg,
    rgba(255, 182, 193, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  animation: speakingGlow 2s infinite;
}

@keyframes speakingGlow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.floating-message-bubble.user-bubble {
  background: rgba(102, 126, 234, 0.12);
  border: 1px solid rgba(102, 126, 234, 0.3);
  margin-left: auto;
  border-radius: 18px 18px 5px 18px;
}

.floating-message-bubble.ai-bubble {
  background: rgba(255, 182, 193, 0.12);
  border: 1px solid rgba(255, 182, 193, 0.3);
  border-radius: 18px 18px 18px 5px;
}

.floating-message-bubble:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
}

/* 消息文本 */
.message-text {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 6px;
  position: relative;
  z-index: 2;
}

.message-line {
  margin-bottom: 3px;
  animation: textAppear 0.4s ease-out;
}

@keyframes textAppear {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-text.user-text {
  color: rgba(255, 255, 255, 0.95);
}

.message-text.ai-text {
  color: rgba(255, 255, 255, 0.9);
}

/* 时间戳（玻璃效果） */
.message-time {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  position: relative;
  z-index: 2;
}

.message-time.user-time {
  color: rgba(255, 255, 255, 0.7);
  justify-content: flex-end;
}

.message-time.ai-time {
  color: rgba(255, 255, 255, 0.6);
  justify-content: flex-start;
}

.time-icon {
  font-size: 9px;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.5));
}

/* 浮动尾巴 */
.floating-message-tail {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.floating-message-tail.user-tail {
  right: -6px;
  top: 16px;
  border-width: 6px 0 6px 6px;
  border-color: transparent transparent transparent rgba(102, 126, 234, 0.12);
}

.floating-message-tail.ai-tail {
  left: -6px;
  top: 16px;
  border-width: 6px 6px 6px 0;
  border-color: transparent rgba(255, 182, 193, 0.12) transparent transparent;
}

/* 特效元素（仅最新消息） */
.floating-effects {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.floating-effects.active .floating-sparkle,
.floating-effects.active .floating-heart {
  animation: floatingEffectAppear 2s infinite ease-in-out;
}

.floating-sparkle {
  position: absolute;
  font-size: 14px;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.8));
}

.sparkle-1 {
  top: -8px;
  left: -8px;
  animation-delay: 0s;
}

.sparkle-2 {
  top: -4px;
  right: -8px;
  animation-delay: 0.7s;
}

.sparkle-3 {
  bottom: -8px;
  left: 50%;
  animation-delay: 1.4s;
}

.floating-heart {
  position: absolute;
  font-size: 12px;
  filter: drop-shadow(0 0 6px rgba(255, 182, 193, 0.8));
}

.heart-1 {
  top: 50%;
  right: -12px;
  animation-delay: 0.3s;
}

.heart-2 {
  bottom: -4px;
  left: -8px;
  animation-delay: 1s;
}

@keyframes floatingEffectAppear {
  0%, 100% {
    opacity: 0.7;
    transform: translateY(0) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-8px) scale(1.2);
  }
}

/* 最新消息特殊样式 */
.floating-message.is-latest {
  z-index: 10;
}

.floating-message.is-latest .floating-message-bubble {
  animation: latestFloatingMessageGlow 2s infinite;
}

@keyframes latestFloatingMessageGlow {
  0%, 100% {
    box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.1),
      inset 0 0 10px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 12px 35px rgba(0, 0, 0, 0.15),
      inset 0 0 15px rgba(255, 182, 193, 0.2);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .floating-message {
    gap: 8px;
    margin-bottom: 10px;
  }

  .floating-avatar {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .floating-message-bubble {
    padding: 10px 14px;
    max-width: 80%;
  }

  .message-text {
    font-size: 12px;
  }

  .message-time {
    font-size: 9px;
  }
}

@media (min-width: 1920px) {
  .floating-message {
    gap: 12px;
    margin-bottom: 14px;
  }

  .floating-avatar {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .floating-message-bubble {
    padding: 14px 18px;
  }

  .message-text {
    font-size: 14px;
  }

  .message-time {
    font-size: 11px;
  }
}
</style>