# WebSocket 改进 - 快速开始

## 🚀 快速开始（5分钟）

### 步骤 1: 使用新的 Composable API

在你的组件中替换旧的实现：

**旧方式** (FloatingChatInterface.vue):
```vue
<script setup lang="ts">
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

const toggleConnection = async () => {
  if (chatStore.isConnected) {
    chatStore.disconnectWebsocket()
  }
  else {
    await chatStore.connectWebsocket()
  }
}
</script>
```

**新方式** (更简洁):
```vue
<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'

const {
  isConnected,
  connectionState,
  connect,
  disconnect
} = useWebSocket({
  autoConnect: false,    // 按需连接
  autoDisconnect: true   // 组件卸载时自动断开
})

const toggleConnection = async () => {
  if (isConnected.value) {
    disconnect()
  } else {
    await connect()
  }
}
</script>
```

### 步骤 2: (可选) 添加连接监控

显示连接质量和延迟信息：

```vue
<script setup lang="ts">
import { ref, onMounted, getCurrentInstance } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'

const { isConnected } = useWebSocket()

const instance = getCurrentInstance()
const { $socket } = instance!.appContext.config.globalProperties

const quality = ref('unknown')
const latency = ref(0)

onMounted(() => {
  setInterval(() => {
    if (isConnected.value && $socket) {
      quality.value = $socket.getConnectionQuality()
      latency.value = $socket.getLatency()
    }
  }, 1000)
})
</script>

<template>
  <div v-if="isConnected" class="connection-info">
    <span :class="quality">{{ quality }}</span>
    <span>{{ latency }}ms</span>
  </div>
</template>
```

### 步骤 3: (可选) 注册全局插件

在 `main.ts` 中添加：

```typescript
import { createWebSocketPlugin } from '@/plugins/websocket'

app.use(createWebSocketPlugin({
  autoConnect: false,  // 是否自动连接
  debug: true          // 开发环境启用调试
}))
```

## ✅ 完成！

你的 WebSocket 现在具有：
- ✨ 更简洁的 Composable API
- 💓 自动心跳监控
- 📊 实时连接质量检测
- 🔄 更好的生命周期管理

## 📚 更多示例

查看完整文档: `docs/WEBSOCKET_IMPROVEMENTS.md`

## 🐛 遇到问题？

1. 检查浏览器控制台是否有错误
2. 确认服务器 URL 配置正确 (`.env` 文件中的 `VITE_WS_URL`)
3. 查看心跳日志: 应该看到 `💓 Pong received (latency: XXms)`
4. 使用 `$socket` 全局实例进行调试:
   ```javascript
   console.log($socket.getConnectionState())
   console.log($socket.getConnectionQuality())
   ```

## 🎯 下一步

- 在其他组件中使用新 API
- 添加连接监控面板
- 根据连接质量调整功能（如降低音频质量）
