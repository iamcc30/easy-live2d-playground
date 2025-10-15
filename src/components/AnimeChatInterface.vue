<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { speechService } from '@/utils/speech'
import AnimeChatMessage from './AnimeChatMessage.vue'
import AnimeVoiceControls from './AnimeVoiceControls.vue'
import AnimeChatHistory from './AnimeChatHistory.vue'
import FloatingElements from './FloatingElements.vue'

const chatStore = useChatStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const isRecording = ref(false)
const isInputFocused = ref(false)
const showFloatingElements = ref(true)

// 计算属性
const userAvatar = computed(() => '😊')
const aiAvatar = computed(() => '🌸')

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 发送消息
const sendMessage = async () => {
  const text = messageInput.value.trim()
  if (!text) return

  // 添加用户消息，带有动画效果
  const userMessage = chatStore.addMessage(text, true)

  // 清空输入框
  messageInput.value = ''
  chatStore.clearInput()

  // 滚动到底部
  await scrollToBottom()

  // 模拟AI回复，添加延迟效果
  setTimeout(async () => {
    const aiResponse = generateAIResponse(text)
    const aiMessage = chatStore.addMessage(aiResponse, false)

    // 播放语音回复
    if (!chatStore.isSpeaking) {
      await speakMessage(aiResponse)
    }

    await scrollToBottom()
  }, 1000 + Math.random() * 1000) // 随机延迟，更自然
}

// 生成AI回复（二次元风格）
const generateAIResponse = (userMessage: string): string => {
  const animeResponses = [
    '哇！主人对我说了这样的话呢～\n让我想想怎么回答比较好...',
    '诶嘿嘿～主人的声音真好听呢！\n我会认真记住的～',
    '哇，好有趣的话题！\n让我也分享一下我的想法吧～',
    '主人今天心情怎么样呀？\n看起来很开心呢～',
    '诶？是这样的吗？\n我第一次听说呢，好新鲜！',
    '主人的想法好特别呢～\n我觉得很有意思哦！',
    '哇，感觉和主人聊天好开心！\n能再多说一点吗？',
    '主人说得对呢～\n我也有同样的感觉！',
    '诶嘿嘿～被主人夸奖了，\n我有点害羞了呢...',
    '主人的建议我会好好记住的！\n谢谢主人～'
  ]

  return animeResponses[Math.floor(Math.random() * animeResponses.length)]
}

// 语音合成消息（带嘴型同步）
const speakMessage = async (text: string) => {
  chatStore.setSpeaking(true)

  try {
    await new Promise((resolve) => {
      speechService.speak(
        text,
        chatStore.voiceSettings.lang,
        chatStore.voiceSettings.pitch,
        chatStore.voiceSettings.rate,
        chatStore.voiceSettings.volume,
        () => {
          // 开始播放时触发言嘴同步
          console.log('🎵 开始播放语音:', text)
        },
        () => {
          // 播放结束
          chatStore.setSpeaking(false)
          console.log('🎵 语音播放结束')
          resolve(void 0)
        },
        (error) => {
          console.error('语音播放错误:', error)
          chatStore.setSpeaking(false)
          resolve(void 0)
        }
      )
    })
  } catch (error) {
    console.error('语音合成失败:', error)
    chatStore.setSpeaking(false)
  }
}

// 语音识别结果处理
const handleVoiceInput = (text: string) => {
  messageInput.value = text
  sendMessage()
}

// 输入框聚焦效果
const handleInputFocus = () => {
  isInputFocused.value = true
}

const handleInputBlur = () => {
  isInputFocused.value = false
}

// 监听消息变化
chatStore.$subscribe(() => {
  scrollToBottom()
})

// 初始化
onMounted(() => {
  chatStore.loadHistory()
  scrollToBottom()

  // 添加欢迎消息
  if (chatStore.messages.length === 0) {
    setTimeout(() => {
      chatStore.addMessage(
        '哇！主人来啦～\n我是您的二次元助手，\n可以和我聊天哦！\n\n试试对我说话吧～',
        false
      )
    }, 1500)
  }
})
</script>

<template>
  <div class="anime-chat-interface"
       :class="{ 'input-focused': isInputFocused }"
       @click="showFloatingElements = true"
       @mouseleave="showFloatingElements = false"
  >
    <!-- 浮动装饰元素 -->
    <FloatingElements
      :visible="showFloatingElements"
      :intensity="0.3"
      type="stars"
    />

    <!-- 顶部装饰 -->
    <div class="top-decoration">
      <div class="decoration-line left"></div>
      <div class="center-gem"
           :class="{ active: chatStore.isSpeaking }"
      >
        <div class="gem-inner">💎</div>
      </div>
      <div class="decoration-line right"></div>
    </div>

    <!-- 消息区域 -->
    <div ref="messagesContainer" class="messages-container"
         :class="{ 'speaking': chatStore.isSpeaking }"
    >
      <transition-group name="message" tag="div" class="messages-list"
      >
        <AnimeChatMessage
          v-for="message in chatStore.messages"
          :key="message.id"
          :message="message"
          :user-avatar="userAvatar"
          :ai-avatar="aiAvatar"
          :is-latest="message === chatStore.latestMessage"
        />
      </transition-group>
    </div>

    <!-- 输入区域 -->
    <div class="input-area"
         :class="{ focused: isInputFocused }"
    >
      <!-- 聊天历史管理 -->
      <AnimeChatHistory />

      <!-- 语音控制 -->
      <AnimeVoiceControls
        @voice-input="handleVoiceInput"
        @recording-change="isRecording = $event"
      />

      <!-- 文本输入 -->
      <div class="text-input-wrapper"
           :class="{ focused: isInputFocused }"
      >
        <div class="input-decoration left">✨</div>
        <input
          v-model="messageInput"
          type="text"
          placeholder="和可爱的助手聊天吧～ (•̀ᴗ•́)و"
          class="message-input"
          @keyup.enter="sendMessage"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          :disabled="isRecording"
        />
        <div class="input-decoration right">🌸</div>

        <button
          @click="sendMessage"
          :disabled="!messageInput.trim() || isRecording"
          class="send-button"
          :class="{ pulse: messageInput.trim() }"
        >
          <span class="button-icon">{{ isRecording ? '🔴' : '💌' }}</span>
        </button>
      </div>
    </div>

    <!-- 底部装饰 -->
    <div class="bottom-decoration">
      <div class="floating-hearts"
           v-if="chatStore.isSpeaking"
      >
        <div class="heart">💕</div>
        <div class="heart">💖</div>
        <div class="heart">💗</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anime-chat-interface {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg,
    rgba(255, 182, 193, 0.9) 0%,
    rgba(255, 192, 203, 0.8) 25%,
    rgba(255, 218, 185, 0.7) 50%,
    rgba(255, 160, 122, 0.6) 75%,
    rgba(255, 182, 193, 0.8) 100%
  );
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 0 40px rgba(255, 182, 193, 0.4),
    inset 0 0 20px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.anime-chat-interface.input-focused {
  box-shadow:
    0 0 60px rgba(255, 182, 193, 0.6),
    inset 0 0 30px rgba(255, 255, 255, 0.3);
  transform: scale(1.01);
}

/* 顶部装饰 */
.top-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
}

.decoration-line {
  height: 2px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 182, 193, 0.8),
    transparent
  );
  flex: 1;
  margin: 0 16px;
}

.center-gem {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 20px rgba(255, 154, 158, 0.6),
    inset 0 0 10px rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
  position: relative;
}

.center-gem.active {
  animation: gemPulse 1.5s infinite;
  box-shadow:
    0 0 30px rgba(255, 154, 158, 0.8),
    inset 0 0 15px rgba(255, 255, 255, 0.4);
}

.gem-inner {
  font-size: 24px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

@keyframes gemPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

/* 消息区域 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.messages-container.speaking {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 20px rgba(255, 182, 193, 0.3);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 输入区域 */
.input-area {
  padding: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.input-area.focused {
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 0 20px rgba(255, 182, 193, 0.2);
}

/* 文本输入包装器 */
.text-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  transition: all 0.3s ease;
}

.text-input-wrapper.focused {
  transform: scale(1.02);
}

.input-decoration {
  font-size: 20px;
  animation: sparkle 2s infinite;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

@keyframes sparkle {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2) rotate(180deg);
    opacity: 1;
  }
}

.message-input {
  flex: 1;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid transparent;
  border-radius: 25px;
  font-size: 14px;
  color: #333;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.message-input:focus {
  border-color: #ff9a9e;
  box-shadow:
    0 4px 20px rgba(255, 154, 158, 0.3),
    inset 0 0 10px rgba(255, 154, 158, 0.1);
  transform: translateY(-2px);
}

.message-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message-input::placeholder {
  color: #999;
  font-style: italic;
}

.send-button {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 154, 158, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(255, 154, 158, 0.6);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(0.95);
}

.send-button.pulse {
  animation: buttonPulse 2s infinite;
}

@keyframes buttonPulse {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(255, 154, 158, 0.4);
  }
  50% {
    box-shadow: 0 4px 25px rgba(255, 154, 158, 0.8);
  }
}

.button-icon {
  font-size: 24px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

/* 底部装饰 */
.bottom-decoration {
  height: 20px;
  position: relative;
  overflow: hidden;
}

.floating-hearts {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

.heart {
  font-size: 16px;
  animation: heartFloat 2s infinite ease-in-out;
  filter: drop-shadow(0 0 5px rgba(255, 182, 193, 0.8));
}

.heart:nth-child(2) {
  animation-delay: 0.7s;
}

.heart:nth-child(3) {
  animation-delay: 1.4s;
}

@keyframes heartFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translateY(-10px) scale(1.1);
    opacity: 1;
  }
}

/* 消息动画 */
.message-enter-active,
.message-leave-active {
  transition: all 0.5s ease;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.8);
}

.message-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

.message-move {
  transition: transform 0.5s ease;
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #ff8a8e 0%, #fdbfdf 100%);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .anime-chat-interface {
    border-radius: 16px;
  }

  .messages-container {
    margin: 0 12px;
    padding: 16px;
  }

  .input-area {
    padding: 16px;
  }

  .message-input {
    padding: 12px 16px;
    font-size: 13px;
  }

  .send-button {
    width: 45px;
    height: 45px;
  }
}

/* 展示屏优化 */
@media (min-width: 1920px) {
  .anime-chat-interface {
    font-size: 18px;
  }

  .message-input {
    font-size: 16px;
    padding: 18px 24px;
  }

  .send-button {
    width: 60px;
    height: 60px;
  }

  .button-icon {
    font-size: 28px;
  }
}
</style>