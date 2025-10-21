# WebSocket 增强功能

本项目的 WebSocket 实现已经过改进，借鉴了 `vue-native-websocket-vue3` 的设计理念，同时保留了 Socket.IO 的所有功能和向后兼容性。

## 🚀 快速开始

### 使用 Composable API (推荐)

```vue
<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'

const {
  isConnected,
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
    <p>状态: {{ connectionState }}</p>
    <button @click="connect" v-if="!isConnected">连接</button>
    <button @click="disconnect" v-else>断开</button>
  </div>
</template>
```

## ✨ 新功能

### 1. Composition API 支持

四个专门的 Composable 函数：

- **`useWebSocket()`** - 核心连接管理
- **`useWebSocketMessages()`** - 消息管理
- **`useWebSocketAudio()`** - 音频状态
- **`useWebSocketWatcher()`** - 事件监听

### 2. 自动生命周期管理

```typescript
// 自动处理连接和断开
const { isConnected } = useWebSocket({
  autoConnect: true,
  autoDisconnect: true
})
```

### 3. 心跳监控 💓

自动发送 ping/pong 进行健康检查：

```typescript
const { $socket } = getCurrentInstance()!.appContext.config.globalProperties

console.log($socket.getConnectionQuality())  // 'excellent' | 'good' | 'poor'
console.log($socket.getLatency())            // 延迟(ms)
```

### 4. 连接质量评级

- 🟢 **excellent**: 延迟 < 200ms
- 🟡 **good**: 延迟 200-500ms
- 🔴 **poor**: 延迟 > 500ms

### 5. Plugin API (可选)

全局 WebSocket 实例访问：

```typescript
// main.ts
import { createWebSocketPlugin } from '@/plugins/websocket'

app.use(createWebSocketPlugin({
  autoConnect: false,
  debug: true
}))

// 组件中
const { $socket, $connect, $disconnect } = this
```

## 📚 完整文档

- **完整文档**: [`docs/WEBSOCKET_IMPROVEMENTS.md`](./docs/WEBSOCKET_IMPROVEMENTS.md)
- **快速开始**: [`docs/WEBSOCKET_QUICKSTART.md`](./docs/WEBSOCKET_QUICKSTART.md)
- **改进总结**: [`docs/WEBSOCKET_IMPROVEMENTS_SUMMARY.md`](./docs/WEBSOCKET_IMPROVEMENTS_SUMMARY.md)

## 🔄 向后兼容

所有改进都是**增强功能**，旧的 Store API 完全保留：

```typescript
// 旧方式仍然有效 ✅
import { useChatStore } from '@/stores/chat'
const chatStore = useChatStore()
await chatStore.connectWebsocket()
```

## 💡 为什么不使用 vue-native-websocket-vue3？

你的项目使用 **Socket.IO** 协议（事件驱动），而 `vue-native-websocket-vue3` 是 **原生 WebSocket**（消息驱动）。

直接切换会导致与服务器通信失败。我们的方案是：

✅ 保留 Socket.IO 功能
✅ 借鉴优秀设计模式
✅ 增强开发体验

详见: [`docs/WEBSOCKET_IMPROVEMENTS_SUMMARY.md`](./docs/WEBSOCKET_IMPROVEMENTS_SUMMARY.md#为什么不直接使用-vue-native-websocket-vue3)

## 🎯 使用建议

| 场景 | 推荐方式 |
|------|----------|
| 新组件开发 | Composable API ✨ |
| 现有组件 | 保持不变（完全兼容） |
| 全局调试 | Plugin API |
| 连接监控 | Composable + Plugin |

## 📦 新增文件

```
src/
├── composables/
│   └── useWebSocket.ts        # 4个 Composable 函数
├── plugins/
│   └── websocket.ts           # 全局插件
└── services/
    └── websocket.ts           # 增强的 WebSocket 服务

docs/
├── WEBSOCKET_IMPROVEMENTS.md  # 完整文档 + 示例
├── WEBSOCKET_QUICKSTART.md    # 5分钟快速上手
└── WEBSOCKET_IMPROVEMENTS_SUMMARY.md  # 改进总结
```

## 🧪 测试

所有功能已增强，并保持向后兼容。测试清单：

- ✅ 现有功能正常工作
- ✅ 新 Composable API 可用
- ✅ 心跳监控正常
- ✅ 连接质量检测准确
- ✅ 插件正常注册

## 🐛 问题排查

如果遇到问题：

1. 检查浏览器控制台
2. 查看心跳日志: `💓 Pong received`
3. 使用调试工具:
   ```javascript
   console.log($socket.getConnectionState())
   console.log($socket.getConnectionQuality())
   console.log($socket.getLatency())
   ```

详细排查指南: [`docs/WEBSOCKET_IMPROVEMENTS.md#调试`](./docs/WEBSOCKET_IMPROVEMENTS.md#调试)

---

**改进时间**: 2025-01-XX
**版本**: v1.0.0
**兼容性**: 完全向后兼容 ✅
