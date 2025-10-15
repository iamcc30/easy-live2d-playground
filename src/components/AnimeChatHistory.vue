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

// 获取历史记录的统计颜色
const getStatColor = (type: string) => {
  switch (type) {
    case 'total': return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    case 'user': return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    case 'ai': return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    default: return 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
  }
}

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
  if (confirm('确定要清空所有珍贵的回忆吗？\n这个操作无法恢复哦～ (｡•́︿•̀｡)')) {
    chatStore.clearMessages()
    showHistoryPanel.value = false
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
    link.download = `二次元聊天记录-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    // 显示成功提示
    setTimeout(() => {
      alert('📥 聊天记录导出成功！\n\n保存了与可爱助手的所有美好回忆～ 💕')
    }, 500)
  } catch (error) {
    console.error('导出聊天记录失败:', error)
    alert('😢 导出失败了...\n\n请再试一次吧～')
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
        alert('📤 聊天记录导入成功！\n\n找回了珍贵的回忆～ 💖')
        showHistoryPanel.value = false
      } else {
        alert('😅 导入失败了...\n\n文件格式好像不对呢～')
      }
    } catch (error) {
      console.error('导入聊天记录失败:', error)
      alert('😵 导入时出错了...\n\n请检查文件格式是否正确～')
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

// 获取存储进度百分比
const storageProgress = computed(() => {
  const usage = storageUsage.value
  return usage.total > 0 ? (usage.used / usage.total) * 100 : 0
})
</script>

<template>
  <div class="anime-chat-history">
    <!-- 历史记录按钮 -->
    <div class="history-header">
      <button
        @click="showHistoryPanel = !showHistoryPanel"
        class="history-toggle-button"
        :class="{ active: showHistoryPanel }"
      >
        <div class="button-icon">📋</div>
        <div class="button-text">回忆相册</div>
        <div v-if="stats.totalCount > 0" class="message-count">
          {{ stats.totalCount }}
        </div>
        <div class="button-glow"></div>
      </button>
    </div>

    <!-- 历史记录面板 -->
    <transition name="panel-slide">
      <div v-if="showHistoryPanel" class="history-panel">
        <!-- 面板头部 -->
        <div class="panel-header">
          <div class="panel-title-area">
            <div class="panel-icon">💝</div>
            <h3 class="panel-title">珍贵的回忆</h3>
          </div>
          <button
            @click="showHistoryPanel = false"
            class="close-button"
          >
            ✨
          </button>
        </div>

        <!-- 统计卡片 -->
        <div v-if="hasMessages" class="stats-cards">
          <div class="stat-card" :style="{ background: getStatColor('total') }">
            <div class="stat-icon">💬</div>
            <div class="stat-value">{{ stats.totalCount }}</div>
            <div class="stat-label">总消息</div>
          </div>

          <div class="stat-card" :style="{ background: getStatColor('user') }">
            <div class="stat-icon">😊</div>
            <div class="stat-value">{{ stats.userMessageCount }}</div>
            <div class="stat-label">我的消息</div>
          </div>

          <div class="stat-card" :style="{ background: getStatColor('ai') }">
            <div class="stat-icon">🌸</div>
            <div class="stat-value">{{ stats.aiMessageCount }}</div>
            <div class="stat-label">助手回复</div>
          </div>

          <div class="stat-card" :style="{ background: getStatColor('time') }">
            <div class="stat-icon">📅</div>
            <div class="stat-value small">{{ formatDateRange(stats.dateRange.start, stats.dateRange.end) }}</div>
            <div class="stat-label">时间范围</div>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">📖</div>
          <div class="empty-title">还没有回忆呢～</div>
          <div class="empty-text">和可爱的助手聊聊天吧！\n她会帮你创造美好的回忆～ 💕</div>
        </div>

        <!-- 存储使用情况 -->
        <div class="storage-section">
          <div class="storage-title">💾 存储使用情况</div>
          <div class="storage-bar">
            <div
              class="storage-progress"
              :style="{ width: `${storageProgress}%` }"
            ></div>
          </div>
          <div class="storage-text">
            {{ formatFileSize(storageUsage.used) }} / {{ formatFileSize(storageUsage.total) }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button
            @click="exportHistory"
            :disabled="!hasMessages || isExporting"
            class="action-button export-button"
          >
            <div class="button-icon">📥</div>
            <div class="button-text">
              <span v-if="!isExporting">导出回忆</span>
              <span v-else>导出中...</span>
            </div>
            <div class="button-glow"></div>
          </button>

          <label class="action-button import-button">
            <div class="button-icon">📤</div>
            <div class="button-text">导入回忆</div>
            <div class="button-glow"></div>
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
            <div class="button-icon">🗑️</div>
            <div class="button-text">清空回忆</div>
            <div class="button-glow"></div>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.anime-chat-history {
  position: relative;
  margin-bottom: 16px;
}

/* 历史记录按钮 */
.history-header {
  text-align: center;
}

.history-toggle-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border: none;
  border-radius: 25px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 154, 158, 0.4);
  overflow: hidden;
}

.history-toggle-button:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 25px rgba(255, 154, 158, 0.6);
}

.history-toggle-button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.button-icon {
  font-size: 18px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

.button-text {
  position: relative;
  z-index: 2;
}

.message-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  min-width: 20px;
  font-weight: 600;
  z-index: 2;
}

.button-glow {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e);
  border-radius: 25px;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.3s ease;
}

.history-toggle-button:hover .button-glow {
  opacity: 0.7;
  animation: glowRotate 2s linear infinite;
}

/* 历史记录面板 */
.history-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 192, 203, 0.9) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  padding: 24px;
  width: 380px;
  max-height: 500px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 12px;
  backdrop-filter: blur(20px);
}

/* 面板滑入动画 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.9);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px) scale(0.95);
}

/* 面板头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(255, 182, 193, 0.3);
}

.panel-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-icon {
  font-size: 24px;
  filter: drop-shadow(0 0 5px rgba(255, 182, 193, 0.5));
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.close-button:hover {
  background: rgba(255, 182, 193, 0.2);
  transform: scale(1.1);
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 16px;
  border-radius: 16px;
  color: white;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.stat-card:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stat-card:hover:before {
  opacity: 1;
}

.stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.stat-value.small {
  font-size: 12px;
  font-weight: 500;
}

.stat-label {
  font-size: 11px;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  filter: drop-shadow(0 0 10px rgba(255, 182, 193, 0.5));
  animation: emptyIconFloat 3s infinite ease-in-out;
}

@keyframes emptyIconFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  color: #999;
  line-height: 1.5;
}

/* 存储使用情况 */
.storage-section {
  margin: 24px 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.storage-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.storage-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
  position: relative;
}

.storage-progress {
  height: 100%;
  background: linear-gradient(90deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
  position: relative;
  overflow: hidden;
}

.storage-progress:before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: progressShine 2s infinite;
}

@keyframes progressShine {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.storage-text {
  font-size: 11px;
  color: #666;
  text-align: center;
  font-weight: 500;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-button {
  position: relative;
  flex: 1;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.action-button:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.action-button:hover:before {
  opacity: 1;
}

.button-icon {
  font-size: 20px;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
  z-index: 2;
}

.button-text {
  z-index: 2;
  text-align: center;
}

.button-glow {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e);
  border-radius: 12px;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.3s ease;
}

.action-button:hover .button-glow {
  opacity: 0.6;
  animation: glowRotate 2s linear infinite;
}

.export-button {
  background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(86, 171, 47, 0.3);
}

.import-button {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
  position: relative;
  cursor: pointer;
}

.clear-button {
  background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(255, 65, 108, 0.3);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(0.95);
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
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.history-panel::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 3px;
}

/* 发光旋转动画 */
@keyframes glowRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .history-panel {
    width: 320px;
    padding: 20px;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }
}

@media (min-width: 1920px) {
  .history-panel {
    width: 450px;
    padding: 32px;
  }

  .panel-title {
    font-size: 20px;
  }

  .stat-card {
    padding: 20px;
  }
}
</style>