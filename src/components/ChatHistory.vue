<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { ChatStorage } from '@/utils/storage'

const chatStore = useChatStore()
const showHistoryPanel = ref(false)
const isExporting = ref(false)

// 计算属性
const hasMessages = computed(() => chatStore.messages.length > 0)
const stats = computed(() => chatStore.stats)

// 格式化日期范围
const formatDateRange = (start: Date | null, end: Date | null): string => {
  if (!start || !end) return '暂无数据'

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  return `${formatDate(start)} - ${formatDate(end)}`
}

// 清空聊天记录
const clearHistory = () => {
  if (confirm('确定要清空所有聊天记录吗？此操作不可恢复。')) {
    chatStore.clearMessages()
  }
}

// 导出聊天记录
const exportHistory = async () => {
  isExporting.value = true
  try {
    const jsonData = chatStore.exportHistory()
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出聊天记录失败:', error)
    alert('导出失败，请重试')
  } finally {
    isExporting.value = false
  }
}

// 导入聊天记录
const importHistory = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      if (chatStore.importHistory(content)) {
        alert('聊天记录导入成功！')
      } else {
        alert('导入失败，文件格式不正确')
      }
    } catch (error) {
      console.error('导入聊天记录失败:', error)
      alert('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)

  // 清空input，允许重复导入同一文件
  target.value = ''
}

// 获取存储使用情况
const storageUsage = computed(() => ChatStorage.getStorageUsage())

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="chat-history">
    <!-- 历史记录按钮 -->
    <div class="history-header">
      <button
        @click="showHistoryPanel = !showHistoryPanel"
        class="history-toggle-button"
        :class="{ active: showHistoryPanel }"
      >
        <span class="icon">📋</span>
        <span class="text">历史记录</span>
        <span v-if="stats.totalCount > 0" class="badge">{{ stats.totalCount }}</span>
      </button>
    </div>

    <!-- 历史记录面板 -->
    <div v-if="showHistoryPanel" class="history-panel">
      <div class="panel-header">
        <h3 class="panel-title">聊天记录管理</h3>
        <button
          @click="showHistoryPanel = false"
          class="close-button"
        >
          ✕
        </button>
      </div>

      <!-- 统计信息 -->
      <div v-if="hasMessages" class="stats-section">
        <div class="stat-item">
          <span class="stat-label">总消息数:</span>
          <span class="stat-value">{{ stats.totalCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">我的消息:</span>
          <span class="stat-value">{{ stats.userMessageCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AI回复:</span>
          <span class="stat-value">{{ stats.aiMessageCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">时间范围:</span>
          <span class="stat-value">{{ formatDateRange(stats.dateRange.start, stats.dateRange.end) }}</span>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>暂无聊天记录</p>
      </div>

      <!-- 存储使用情况 -->
      <div class="storage-info">
        <div class="storage-bar">
          <div
            class="storage-used"
            :style="{ width: `${(storageUsage.used / storageUsage.total) * 100}%` }"
          ></div>
        </div>
        <div class="storage-text">
          已使用 {{ formatFileSize(storageUsage.used) }} / {{ formatFileSize(storageUsage.total) }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button
          @click="exportHistory"
          :disabled="!hasMessages || isExporting"
          class="action-button export-button"
        >
          <span v-if="!isExporting">📥 导出记录</span>
          <span v-else>⏳ 导出中...</span>
        </button>

        <label class="action-button import-button">
          📤 导入记录
          <input
            type="file"
            accept=".json"
            @change="importHistory"
            class="file-input"
          />
        </label>

        <button
          @click="clearHistory"
          :disabled="!hasMessages"
          class="action-button clear-button"
        >
          🗑️ 清空记录
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-history {
  position: relative;
}

.history-header {
  margin-bottom: 12px;
}

.history-toggle-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.history-toggle-button:hover {
  background: #f8f9fa;
  border-color: #bbb;
}

.history-toggle-button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.history-toggle-button .icon {
  font-size: 14px;
}

.history-toggle-button .text {
  font-weight: 500;
}

.badge {
  background: #dc3545;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.history-panel {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 16px;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 4px;
  border-radius: 4px;
}

.close-button:hover {
  background: #f0f0f0;
}

.stats-section {
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: 600;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 14px;
}

.storage-info {
  margin: 16px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.storage-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.storage-used {
  height: 100%;
  background: #007bff;
  transition: width 0.3s;
}

.storage-text {
  font-size: 11px;
  color: #666;
  text-align: center;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.export-button {
  background: #e8f5e8;
  border-color: #28a745;
  color: #155724;
}

.export-button:hover:not(:disabled) {
  background: #28a745;
  color: white;
}

.import-button {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
  position: relative;
  cursor: pointer;
}

.import-button:hover {
  background: #ffc107;
  color: white;
}

.clear-button {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.clear-button:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
}

/* 滚动条样式 */
.history-panel::-webkit-scrollbar {
  width: 6px;
}

.history-panel::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.history-panel::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.history-panel::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>