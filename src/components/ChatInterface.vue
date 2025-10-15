<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { speechService } from '@/utils/speech'
import ChatMessage from './ChatMessage.vue'
import VoiceControls from './VoiceControls.vue'
import ChatHistory from './ChatHistory.vue'

const chatStore = useChatStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const isRecording = ref(false)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 发送文本消息
const sendMessage = () => {
  const text = messageInput.value.trim()
  if (!text) return

  // 添加用户消息
  chatStore.addMessage(text, true)

  // 模拟AI回复（实际应用中应该调用AI API）
  setTimeout(() => {
    const aiResponse = generateAIResponse(text)
    chatStore.addMessage(aiResponse, false)

    // 语音合成回复
    if (!chatStore.isSpeaking) {
      speakMessage(aiResponse)
    }
  }, 1000)

  messageInput.value = ''
  chatStore.clearInput()
  scrollToBottom()
}

// 简单的AI回复生成器
const generateAIResponse = (userMessage: string): string => {
  const responses = [
    '我在听，请继续告诉我你的想法。',
    '这是一个很有趣的观点，能详细说说吗？',
    '我明白了，让我想想怎么回应你。',
    '谢谢你的分享，我也有类似的想法。',
    '这个问题很有意思，我们可以深入讨论。'
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

// 语音合成消息
const speakMessage = (text: string) => {
  chatStore.setSpeaking(true)
  speechService.speak(
    text,
    chatStore.voiceSettings.lang,
    chatStore.voiceSettings.pitch,
    chatStore.voiceSettings.rate,
    chatStore.voiceSettings.volume,
    () => {
      // 开始播放时触发言嘴同步
      console.log('开始播放语音:', text)
    },
    () => {
      // 播放结束
      chatStore.setSpeaking(false)
      console.log('语音播放结束')
    },
    (error) => {
      console.error('语音播放错误:', error)
      chatStore.setSpeaking(false)
    }
  )
}

// 语音识别结果处理
const handleVoiceInput = (text: string) => {
  messageInput.value = text
  sendMessage()
}

// 监听消息变化，自动滚动
chatStore.$subscribe(() => {
  scrollToBottom()
})

// 初始化时加载历史记录
onMounted(() => {
  chatStore.loadHistory()
  scrollToBottom()
})

</script>

<template>
  <div class="chat-interface">
    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-container">
      <ChatMessage
        v-for="message in chatStore.messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 聊天历史管理 -->
      <ChatHistory />

      <VoiceControls
        @voice-input="handleVoiceInput"
        @recording-change="isRecording = $event"
      />

      <div class="text-input-container">
        <input
          v-model="messageInput"
          type="text"
          placeholder="输入消息..."
          class="message-input"
          @keyup.enter="sendMessage"
          :disabled="isRecording"
        />
        <button
          @click="sendMessage"
          :disabled="!messageInput.trim() || isRecording"
          class="send-button"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-area {
  border-top: 1px solid #e0e0e0;
  padding: 16px;
  background: #f8f9fa;
}

.text-input-container {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.message-input:focus {
  border-color: #007bff;
}

.message-input:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.send-button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s;
}

.send-button:hover:not(:disabled) {
  background: #0056b3;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>