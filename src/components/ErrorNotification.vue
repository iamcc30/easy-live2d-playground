<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { errorHandler, type ErrorMessage } from '@/utils/errorHandler'

interface Notification extends ErrorMessage {
  id: number
}

const notifications = ref<Notification[]>([])
let notificationId = 0

// 添加通知
const addNotification = (error: ErrorMessage) => {
  const id = ++notificationId
  const notification: Notification = {
    ...error,
    id,
    duration: error.duration || 4000
  }

  notifications.value.push(notification)

  // 自动移除
  if (notification.duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, notification.duration)
  }
}

// 移除通知
const removeNotification = (id: number) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

// 获取通知样式类
const getNotificationClass = (type: string) => {
  return {
    'notification': true,
    [`notification-${type}`]: true
  }
}

// 获取图标
const getIcon = (type: string) => {
  switch (type) {
    case 'error':
      return '❌'
    case 'warning':
      return '⚠️'
    case 'info':
      return '✅'
    default:
      return 'ℹ️'
  }
}

onMounted(() => {
  errorHandler.onError(addNotification)
})
</script>

<template>
  <div class="error-notifications">
    <transition-group name="notification" tag="div" class="notifications-container">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="getNotificationClass(notification.type)"
        class="notification-item"
      >
        <div class="notification-icon">{{ getIcon(notification.type) }}</div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
        <button
          @click="removeNotification(notification.id)"
          class="notification-close"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.error-notifications {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
}

.notifications-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid;
  animation: slideInRight 0.3s ease-out;
}

.notification-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.3;
}

.notification-message {
  font-size: 13px;
  line-height: 1.4;
  opacity: 0.9;
}

.notification-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-close:hover {
  color: #666;
}

/* 不同类型的样式 */
.notification-error {
  border-left-color: #dc3545;
}

.notification-error .notification-title {
  color: #dc3545;
}

.notification-warning {
  border-left-color: #ffc107;
}

.notification-warning .notification-title {
  color: #856404;
}

.notification-info {
  border-left-color: #28a745;
}

.notification-info .notification-title {
  color: #28a745;
}

/* 动画效果 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .error-notifications {
    left: 20px;
    right: 20px;
    max-width: none;
  }
}
</style>