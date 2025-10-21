# vue-native-websocket-vue3 迁移：完整分析和建议

## 🎯 现状分析

### 你的当前架构

**前端**:
- 使用 `socket.io-client`
- 支持命名事件 (`socket.on('hello')`, `socket.emit('listen')`)
- 自动重连和心跳

**后端** (Python):
- 可能使用 `python-socketio` 或原生 WebSocket
- 需要确认具体实现

### vue-native-websocket-vue3 的特点

- ✅ 适用于**原生 WebSocket** (W3C 标准)
- ✅ 提供 Pinia/Vuex 集成
- ✅ 自动管理连接状态
- ❌ **不支持 Socket.IO 协议**
- ❌ 没有命名事件系统

---

## 📋 三种可行方案

### 方案 1: 保持 Socket.IO (推荐) ⭐

**适用场景**: 服务器使用 `python-socketio`

**优点**:
- ✅ 无需任何改动
- ✅ 已有现代化 Composable API
- ✅ 功能完整，稳定可靠

**下一步**: 无需操作，继续使用现有代码

---

### 方案 2: 使用 vue-native-websocket-vue3 + 改造服务器

**适用场景**: 你想使用原生 WebSocket 且愿意改造服务器

#### 前端改动

**安装依赖**:
```bash
pnpm add vue-native-websocket-vue3
pnpm remove socket.io-client
```

**创建 WebSocket Store**:
📄 `src/stores/websocket.ts` (已创建)

**配置插件**:
📄 `src/main.ts`
```typescript
import VueNativeSock from 'vue-native-websocket-vue3'
import { useWebSocketStoreWithOut } from './stores/websocket'

const websocketStore = useWebSocketStoreWithOut()

app.use(VueNativeSock, 'ws://your-server.com:8080', {
  store: websocketStore,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 3000
})
```

#### 后端改动 (Python)

**安装依赖**:
```bash
pip install websockets
```

**服务器示例**:
```python
import asyncio
import json
import websockets
from websockets.server import serve

# 存储连接的客户端
clients = set()

async def handle_client(websocket, path):
    """处理客户端连接"""
    # 解析 URL 参数进行认证
    # path 包含查询参数
    print(f"New client connected: {websocket.remote_address}")
    clients.add(websocket)

    try:
        async for message in websocket:
            try:
                # 解析 JSON 消息
                data = json.loads(message)
                message_type = data.get('type')

                print(f"Received message type: {message_type}")

                # 路由消息
                if message_type == 'hello':
                    await handle_hello(websocket, data)
                elif message_type == 'listen':
                    await handle_listen(websocket, data)
                elif message_type == 'ping':
                    await handle_ping(websocket, data)
                elif message_type == 'abort':
                    await handle_abort(websocket, data)
                elif message_type == 'mcp':
                    await handle_mcp(websocket, data)
                else:
                    print(f"Unknown message type: {message_type}")

            except json.JSONDecodeError:
                print("Invalid JSON message")
            except Exception as e:
                print(f"Error handling message: {e}")

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    finally:
        clients.remove(websocket)


async def handle_hello(websocket, data):
    """处理 hello 消息"""
    print(f"Hello from client: {data}")

    response = {
        'type': 'hello',
        'version': 1,
        'session_id': 'session_' + str(id(websocket)),
        'accepted_audio_format': 'opus'
    }

    await websocket.send(json.dumps(response))


async def handle_listen(websocket, data):
    """处理 listen 消息"""
    state = data.get('state')
    mode = data.get('mode')

    print(f"Listen state: {state}, mode: {mode}")

    if state == 'start':
        # 启动语音识别
        pass
    elif state == 'stop':
        # 停止语音识别
        pass


async def handle_ping(websocket, data):
    """处理 ping 消息"""
    timestamp = data.get('timestamp')

    response = {
        'type': 'pong',
        'timestamp': timestamp
    }

    await websocket.send(json.dumps(response))


async def handle_abort(websocket, data):
    """处理 abort 消息"""
    reason = data.get('reason')
    print(f"Session aborted: {reason}")


async def handle_mcp(websocket, data):
    """处理 MCP 消息"""
    payload = data.get('payload')
    print(f"MCP message: {payload}")


async def send_tts(websocket, state, text=None):
    """发送 TTS 消息"""
    message = {
        'type': 'tts',
        'state': state
    }
    if text:
        message['text'] = text

    await websocket.send(json.dumps(message))


async def send_llm_emotion(websocket, emotion):
    """发送 LLM 情感消息"""
    message = {
        'type': 'llm',
        'emotion': emotion
    }

    await websocket.send(json.dumps(message))


async def send_audio(websocket, audio_data: bytes):
    """发送音频数据"""
    await websocket.send(audio_data)


async def main():
    """启动 WebSocket 服务器"""
    async with serve(handle_client, "localhost", 8080):
        print("WebSocket server started on ws://localhost:8080")
        await asyncio.Future()  # 运行永久


if __name__ == "__main__":
    asyncio.run(main())
```

**优点**:
- ✅ 包大小减少 86% (31KB)
- ✅ 使用 W3C 标准
- ✅ Pinia 自动集成

**缺点**:
- ❌ 需要完全重写服务器
- ❌ 开发时间 8-13 天
- ❌ 高风险

---

### 方案 3: 混合方案 - 保持 Socket.IO + 手动 Pinia 集成

**适用场景**: 想要 Pinia 集成但不想改协议

#### 实现步骤

**创建 Socket.IO 专用的 Pinia Store**:

```typescript
// src/stores/websocket-socketio.ts
import { defineStore } from 'pinia'
import { websocketService } from '@/services/websocket'

export const useWebSocketStore = defineStore({
  id: 'websocket',

  state: () => ({
    isConnected: false,
    lastMessage: null,
    reconnectError: false
  }),

  actions: {
    async connect() {
      await websocketService.connect({
        onConnected: () => {
          this.isConnected = true
          this.reconnectError = false
        },
        onDisconnected: () => {
          this.isConnected = false
        },
        onError: () => {
          this.reconnectError = true
        }
      })
    },

    disconnect() {
      websocketService.disconnect()
      this.isConnected = false
    }
  }
})
```

**优点**:
- ✅ 零改动成本
- ✅ Pinia 集成
- ✅ 保持 Socket.IO 功能

**缺点**:
- ⚠️ 需要手动管理状态同步

---

## 🎯 我的最终建议

### 如果你的 Python 服务器使用 python-socketio

**推荐**: **方案 1** (保持 Socket.IO)

**理由**:
- 协议完全匹配
- 已有现代化 API
- 零风险，零成本

### 如果你的 Python 服务器使用原生 WebSocket

**推荐**: **方案 2** (使用 vue-native-websocket-vue3)

**步骤**:
1. 已安装 `vue-native-websocket-vue3`
2. 使用已创建的 WebSocket Store
3. 配置 `main.ts`
4. 测试连接

### 如果你不确定服务器使用什么

**首先**: **确认服务器协议**

```bash
# 检查 Python 依赖
cat /path/to/your/server/requirements.txt | grep -E "socketio|websockets"

# 或者检查代码
grep -r "socketio\|WebSocket" /path/to/your/server
```

---

## 📝 下一步行动

### 立即需要做的:

1. **确认服务器协议** 🔴
   - 检查 Python 代码
   - 确认使用 `python-socketio` 还是 `websockets`

2. **根据确认结果选择方案**
   - Socket.IO → 保持现状
   - Native WebSocket → 使用 vue-native-websocket-vue3

3. **告诉我结果**
   - 我会根据你的服务器协议提供具体实现

---

## 🤔 你需要回答的问题

1. **服务器端使用什么库？**
   - `python-socketio` (Flask-SocketIO, python-socketio)
   - `websockets` (原生 WebSocket)
   - 其他？

2. **是否可以改造服务器？**
   - 可以 (8-13 天开发时间)
   - 不可以 (保持现有协议)

3. **主要目的是什么？**
   - 减小包大小
   - Pinia 集成
   - 使用标准 WebSocket
   - 其他？

**请告诉我你的服务器情况，我会提供针对性的实现方案！**
