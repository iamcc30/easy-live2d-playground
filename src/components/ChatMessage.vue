<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@/stores/chat'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const messageClasses = computed(() => [
  'message',
  props.message.isUser ? 'message-user' : 'message-ai'
])

const formatTime = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}
</script>

<template>
  <div :class="messageClasses">
    <div class="message-content">
      <div class="message-text">{{ message.text }}</div>
      <div class="message-meta">
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        <span v-if="message.isUser" class="message-sender">我</span>
        <span v-else class="message-sender">AI助手</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  margin-bottom: 8px;
  animation: fadeIn 0.3s ease-in;
}

.message-user {
  justify-content: flex-end;
}

.message-ai {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
}

.message-user .message-content {
  background: #007bff;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-ai .message-content {
  background: #f1f3f4;
  color: #333;
  border-bottom-left-radius: 4px;
}

.message-text {
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  opacity: 0.7;
}

.message-time {
  margin-right: 8px;
}

.message-sender {
  font-weight: 500;
}

.message-user .message-meta {
  color: rgba(255, 255, 255, 0.9);
}

.message-ai .message-meta {
  color: rgba(0, 0, 0, 0.6);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>