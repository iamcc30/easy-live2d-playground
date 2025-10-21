# WebSocket 改进文档

## 📋 改进概述

本次改进借鉴了 `vue-native-websocket-vue3` 的设计理念，为现有的 Socket.IO 实现添加了 Vue 3 友好的 API 和增强功能。

### ⚠️ 重要说明

**为什么不直接使用 `vue-native-websocket-vue3`？**

1. **协议不兼容**：你的服务器使用 Socket.IO 协议（事件驱动架构），而 `vue-native-websocket-vue3` 是原生 WebSocket 插件
2. **功能差异**：Socket.IO 提供自动重连、事件系统、二进制支持等高级功能
3. **业务需求**：你的项目需要 Socket.IO 的特定功能（hello、listen、tts、llm 等事件）

**改进策略**：保留 Socket.IO，采用 `vue-native-websocket-vue3` 的优秀设计模式

---

## ✨ 新增功能

### 1. Composition API 支持

#### `useWebSocket()` - 核心连接管理

```vue
<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'

const {
  // 响应式状态
  isConnected,
  connectionState,
  isConnecting,
  isReconnecting,
  hasError,
  lastError,

  // 方法
  connect,
  disconnect,
  sendMessage,
  startListening,
  stopListening,
  retry
} = useWebSocket({
  autoConnect: true,      // 自动连接
  autoDisconnect: true    // 卸载时自动断开
})
</script>

<template>
  <div>
    <p>连接状态: {{ connectionState }}</p>
    <p v-if="isConnected">✅ 已连接</p>
    <p v-if="isReconnecting">🔄 重连中...</p>

    <button @click="connect" :disabled="isConnected">连接</button>
    <button @click="disconnect" :disabled="!isConnected">断开</button>
    <button @click="retry" :disabled="isConnected">重试</button>
  </div>
</template>
```

#### `useWebSocketMessages()` - 消息管理

```vue
<script setup lang="ts">
import { useWebSocketMessages } from '@/composables/useWebSocket'

const {
  messages,
  latestMessage,
  messageCount,
  addMessage,
  clearMessages
} = useWebSocketMessages()
</script>

<template>
  <div>
    <p>消息数量: {{ messageCount }}</p>
    <div v-for="msg in messages" :key="msg.id">
      {{ msg.text }}
    </div>
    <button @click="clearMessages">清空</button>
  </div>
</template>
```

#### `useWebSocketAudio()` - 音频状态

```vue
<script setup lang="ts">
import { useWebSocketAudio } from '@/composables/useWebSocket'

const {
  isSpeaking,
  isListening,
  currentEmotion,
  currentTTSText
} = useWebSocketAudio()
</script>

<template>
  <div>
    <p v-if="isSpeaking">🔊 正在播放: {{ currentTTSText }}</p>
    <p v-if="isListening">🎤 正在录音</p>
    <p>情感: {{ currentEmotion }}</p>
  </div>
</template>
```

#### `useWebSocketWatcher()` - 事件监听

```vue
<script setup lang="ts">
import { useWebSocketWatcher } from '@/composables/useWebSocket'

useWebSocketWatcher({
  onConnected: () => {
    console.log('🎉 连接成功！')
    // 自动发送欢迎消息
  },
  onDisconnected: () => {
    console.log('👋 连接断开')
  },
  onReconnecting: () => {
    console.log('🔄 正在重连...')
  },
  onError: () => {
    console.error('❌ 连接错误')
  }
})
</script>
```

---

### 2. Plugin API 支持

#### 全局插件注册

```typescript
// main.ts
import { createApp } from 'vue'
import { createWebSocketPlugin } from '@/plugins/websocket'
import App from './App.vue'

const app = createApp(App)

// 注册 WebSocket 插件
app.use(createWebSocketPlugin({
  autoConnect: false,  // 是否自动连接
  debug: true         // 启用调试日志
}))

app.mount('#app')
```

#### 组件内使用全局实例

```vue
<script setup lang="ts">
import { getCurrentInstance } from 'vue'

const instance = getCurrentInstance()
const { $socket, $connect, $disconnect } = instance!.appContext.config.globalProperties

// 直接访问 WebSocket 服务
console.log('连接状态:', $socket.getConnectionState())
console.log('连接质量:', $socket.getConnectionQuality())
console.log('延迟:', $socket.getLatency())

// 使用便捷方法
async function handleConnect() {
  await $connect()
}

function handleDisconnect() {
  $disconnect()
}
</script>

<template>
  <div>
    <button @click="handleConnect">连接</button>
    <button @click="handleDisconnect">断开</button>
  </div>
</template>
```

---

### 3. 增强的 WebSocket 服务

#### 新增功能

**心跳监控**
```typescript
// 自动发送 ping/pong 进行健康检查
websocketService.getLatency()          // 获取延迟 (ms)
websocketService.getConnectionQuality() // 获取连接质量
// 返回: 'excellent' | 'good' | 'poor' | 'unknown'
```

**连接质量评级**
- `excellent`: 延迟 < 200ms
- `good`: 延迟 200-500ms
- `poor`: 延迟 > 500ms 或心跳超时
- `unknown`: 未知状态

**强制重连**
```typescript
websocketService.reconnect() // 强制断开并重新连接
```

---

## 🔄 迁移指南

### 从旧 API 迁移到 Composable API

#### 旧方式（直接使用 Store）

```vue
<script setup lang="ts">
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

async function connect() {
  await chatStore.connectWebsocket()
}

function disconnect() {
  chatStore.disconnectWebsocket()
}
</script>

<template>
  <div>
    <p>{{ chatStore.connectionState }}</p>
    <button @click="connect">连接</button>
    <button @click="disconnect">断开</button>
  </div>
</template>
```

#### 新方式（使用 Composable）✨

```vue
<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'

const {
  connectionState,
  connect,
  disconnect
} = useWebSocket({
  autoConnect: true,      // 自动连接
  autoDisconnect: true    // 组件卸载时自动断开
})
</script>

<template>
  <div>
    <p>{{ connectionState }}</p>
    <button @click="connect">连接</button>
    <button @click="disconnect">断开</button>
  </div>
</template>
```

**优势**：
- ✅ 更简洁的 API
- ✅ 自动生命周期管理
- ✅ 更好的类型推导
- ✅ 按需组合功能

---

## 📚 完整使用示例

### 示例 1: 简单聊天界面

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useWebSocket, useWebSocketMessages } from '@/composables/useWebSocket'

const {
  isConnected,
  connectionState,
  connect,
  disconnect
} = useWebSocket({ autoConnect: true })

const {
  messages,
  addMessage
} = useWebSocketMessages()

const inputText = ref('')

function send() {
  if (!inputText.value.trim()) return
  addMessage(inputText.value, true)
  inputText.value = ''
}
</script>

<template>
  <div class="chat-container">
    <!-- 连接状态 -->
    <div class="header">
      <span :class="isConnected ? 'connected' : 'disconnected'">
        {{ connectionState }}
      </span>
      <button @click="isConnected ? disconnect() : connect()">
        {{ isConnected ? '断开' : '连接' }}
      </button>
    </div>

    <!-- 消息列表 -->
    <div class="messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="msg.isUser ? 'user-message' : 'ai-message'"
      >
        {{ msg.text }}
      </div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <input
        v-model="inputText"
        @keyup.enter="send"
        placeholder="输入消息..."
        :disabled="!isConnected"
      />
      <button @click="send" :disabled="!isConnected">发送</button>
    </div>
  </div>
</template>
```

### 示例 2: 语音聊天控制

```vue
<script setup lang="ts">
import { useWebSocket, useWebSocketAudio } from '@/composables/useWebSocket'

const {
  isConnected,
  startListening,
  stopListening
} = useWebSocket()

const {
  isListening,
  isSpeaking,
  currentEmotion
} = useWebSocketAudio()

async function toggleRecording() {
  if (isListening.value) {
    stopListening()
  } else {
    await startListening('auto')
  }
}
</script>

<template>
  <div class="voice-controls">
    <!-- 状态指示 -->
    <div class="status">
      <div v-if="isListening" class="indicator recording">
        🎤 录音中...
      </div>
      <div v-if="isSpeaking" class="indicator speaking">
        🔊 播放中...
      </div>
      <div class="emotion">
        情感: {{ currentEmotion }}
      </div>
    </div>

    <!-- 控制按钮 -->
    <button
      @click="toggleRecording"
      :disabled="!isConnected"
      :class="{ active: isListening }"
    >
      {{ isListening ? '停止录音' : '开始录音' }}
    </button>
  </div>
</template>
```

### 示例 3: 连接监控面板

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWebSocket, useWebSocketWatcher } from '@/composables/useWebSocket'
import { getCurrentInstance } from 'vue'

const {
  connectionState,
  isConnected,
  isReconnecting,
  retry
} = useWebSocket()

const instance = getCurrentInstance()
const { $socket } = instance!.appContext.config.globalProperties

const quality = ref<string>('unknown')
const latency = ref<number>(0)

// 监听连接状态变化
useWebSocketWatcher({
  onConnected: () => {
    console.log('✅ 连接成功')
  },
  onDisconnected: () => {
    console.log('🔌 连接断开')
  },
  onReconnecting: () => {
    console.log('🔄 正在重连...')
  },
  onError: () => {
    console.error('❌ 连接错误')
  }
})

// 定期更新连接质量
onMounted(() => {
  setInterval(() => {
    if (isConnected.value) {
      quality.value = $socket.getConnectionQuality()
      latency.value = $socket.getLatency()
    }
  }, 1000)
})
</script>

<template>
  <div class="monitor">
    <h3>连接监控</h3>

    <div class="metrics">
      <div class="metric">
        <span>状态:</span>
        <span :class="connectionState">{{ connectionState }}</span>
      </div>

      <div class="metric" v-if="isConnected">
        <span>质量:</span>
        <span :class="quality">
          {{ quality }}
          <span v-if="quality === 'excellent'">🟢</span>
          <span v-else-if="quality === 'good'">🟡</span>
          <span v-else-if="quality === 'poor'">🔴</span>
        </span>
      </div>

      <div class="metric" v-if="isConnected">
        <span>延迟:</span>
        <span>{{ latency }}ms</span>
      </div>
    </div>

    <button v-if="!isConnected && !isReconnecting" @click="retry">
      重试连接
    </button>
  </div>
</template>

<style scoped>
.monitor {
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}

.metric {
  display: flex;
  justify-content: space-between;
}

.connected { color: #22c55e; }
.disconnected { color: #ef4444; }
.reconnecting { color: #f59e0b; }
.excellent { color: #22c55e; }
.good { color: #eab308; }
.poor { color: #ef4444; }
</style>
```

---

## 🎯 最佳实践

### 1. 使用 Composable 而不是直接访问 Store

```typescript
// ❌ 不推荐
import { useChatStore } from '@/stores/chat'
const chatStore = useChatStore()
await chatStore.connectWebsocket()

// ✅ 推荐
import { useWebSocket } from '@/composables/useWebSocket'
const { connect } = useWebSocket()
await connect()
```

### 2. 启用 autoConnect 和 autoDisconnect

```typescript
// ✅ 推荐：组件内自动管理连接生命周期
const { isConnected } = useWebSocket({
  autoConnect: true,      // 挂载时自动连接
  autoDisconnect: true    // 卸载时自动断开
})
```

### 3. 使用 Watcher 响应连接状态变化

```typescript
// ✅ 推荐：使用专门的 watcher composable
useWebSocketWatcher({
  onConnected: () => {
    // 连接成功后的操作
  },
  onDisconnected: () => {
    // 断开连接后的操作
  }
})
```

### 4. 分离关注点

```typescript
// ✅ 推荐：按功能分离不同的 composable
const { isConnected, connect, disconnect } = useWebSocket()
const { messages, addMessage } = useWebSocketMessages()
const { isSpeaking, isListening } = useWebSocketAudio()
```

---

## 🔧 配置选项

### WebSocket 配置 (`src/config/websocket.ts`)

```typescript
export const websocketConfig: WebsocketConfig = {
  url: 'https://your-server.com',
  accessToken: '',
  deviceId: '...',
  clientId: '...',
  protocolVersion: 1,

  // 重连设置
  reconnect: true,
  reconnectInterval: 3000,      // 3秒
  reconnectMaxAttempts: 10,

  // Socket.IO 选项
  path: '/',
  transports: ['websocket', 'polling']
}
```

### 插件配置

```typescript
app.use(createWebSocketPlugin({
  autoConnect: false,  // 是否自动连接
  debug: true          // 启用调试日志
}))
```

---

## 🐛 调试

### 启用详细日志

```typescript
// 1. 插件级别
app.use(createWebSocketPlugin({ debug: true }))

// 2. Composable 级别
const { connect } = useWebSocket()
// 自动打印 [useWebSocket] 前缀的日志

// 3. Service 级别
// 所有 websocket.ts 的日志已经带有表情符号前缀
// 🔗 连接事件
// 📤 发送消息
// 📥 接收消息
// ❌ 错误
// 💓 心跳
```

### 浏览器控制台检查

```javascript
// 获取连接质量
window.$socket.getConnectionQuality()

// 获取延迟
window.$socket.getLatency()

// 获取会话信息
window.$socket.getSessionInfo()

// 强制重连
window.$socket.reconnect()
```

---

## 📊 对比总结

| 特性 | 旧实现 | 新实现 (改进后) |
|------|--------|----------------|
| **API 风格** | Store 直接访问 | Composable API ✨ |
| **生命周期管理** | 手动 | 自动 (autoConnect/Disconnect) ✨ |
| **事件监听** | Store watch | Watcher Composable ✨ |
| **全局访问** | ❌ 无 | Plugin API ✨ |
| **心跳监控** | ❌ 无 | ✅ 内置 ✨ |
| **连接质量** | ❌ 无 | ✅ 实时监控 ✨ |
| **延迟监控** | ❌ 无 | ✅ 实时显示 ✨ |
| **强制重连** | ❌ 无 | ✅ reconnect() ✨ |
| **类型安全** | ✅ 有 | ✅ 增强 |
| **协议** | Socket.IO | Socket.IO (保持) |

---

## 🚀 下一步

1. **测试新 API**：在现有组件中尝试使用新的 Composable API
2. **监控连接质量**：使用心跳监控功能查看连接稳定性
3. **逐步迁移**：将旧的 Store 直接访问替换为 Composable
4. **添加更多功能**：根据需要扩展 Composable API

---

## 💡 常见问题

### Q: 为什么不直接使用 vue-native-websocket-vue3？
A: 因为你的服务器使用 Socket.IO 协议，而不是原生 WebSocket。直接切换会导致通信失败。

### Q: 新 API 向后兼容吗？
A: 完全兼容！旧的 Store API 仍然可用，新 API 是额外的增强功能。

### Q: 需要改动服务器端吗？
A: 不需要！所有改进都在客户端实现，服务器端无需改动。

### Q: 心跳监控会增加流量吗？
A: 影响很小，每 30 秒发送一次 ping/pong，数据量可忽略不计。

### Q: 可以禁用心跳吗？
A: 心跳自动启用，但不会影响性能。如需禁用，可以注释掉 `startHeartbeat()` 调用。

---

## 📝 更新日志

### 2025-01-XX

**新增**：
- ✨ 添加 Composition API 支持 (`useWebSocket`, `useWebSocketMessages`, `useWebSocketAudio`, `useWebSocketWatcher`)
- ✨ 添加 Plugin API 支持 (`createWebSocketPlugin`)
- ✨ 添加心跳监控和连接质量检测
- ✨ 添加强制重连功能
- 📚 完整文档和使用示例

**改进**：
- 🔧 增强 WebSocket 服务错误处理
- 🔧 优化连接生命周期管理
- 🔧 改进类型定义

**保持**：
- ✅ Socket.IO 协议和现有功能完全保留
- ✅ 向后兼容，旧 API 仍然可用
