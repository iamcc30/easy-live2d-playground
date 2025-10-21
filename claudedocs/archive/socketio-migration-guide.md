# Socket.IO 迁移指南

## 迁移概览

已将 WebSocket 原生实现迁移到 Socket.IO 客户端库,提供更强大的连接管理和跨浏览器兼容性。

## 迁移时间

**迁移日期**: 2025-10-15

## 主要变更

### 1. 依赖变更

**新增依赖**:
```json
{
  "socket.io-client": "^4.8.1"
}
```

### 2. 类型定义变更 (`src/types/websocket.ts`)

#### Transport 类型更新
```typescript
// 之前: 'websocket'
// 之后: 'socketio'
transport: 'socketio'
```

#### 新增配置选项
```typescript
export interface WebsocketConfig {
  // ... 现有字段 ...

  // Socket.IO 特有配置
  path?: string                              // Socket.IO 路径,默认 '/socket.io'
  transports?: ('websocket' | 'polling')[]   // 传输方式优先级
}
```

#### 新增类型导出
```typescript
export type SocketInstance = Socket  // Socket.IO 实例类型
```

### 3. 服务实现变更 (`src/services/websocket.ts`)

#### 连接方式变更

**之前 (原生 WebSocket)**:
```typescript
// 使用 WebSocket subprotocols 传递认证信息
const protocols = [
  `Authorization:${btoa(token)}`,
  `device-id:${deviceId}`,
  // ...
]
this.ws = new WebSocket(url, protocols)
```

**之后 (Socket.IO)**:
```typescript
// 使用 auth 对象传递认证信息
this.socket = io(serverUrl, {
  auth: {
    token,
    deviceId: websocketConfig.deviceId,
    clientId: websocketConfig.clientId,
    protocolVersion: websocketConfig.protocolVersion
  },
  // ... 其他配置
})
```

#### 事件监听变更

**之前 (原生 WebSocket)**:
```typescript
// 通过 message 事件接收所有消息
this.ws.addEventListener('message', (event) => {
  if (event.data instanceof ArrayBuffer) {
    // 处理音频数据
  } else {
    const message = JSON.parse(event.data)
    // 路由到不同处理器
  }
})
```

**之后 (Socket.IO)**:
```typescript
// 使用命名事件
this.socket.on('hello', (message: HelloMessage) => this.handleHelloResponse(message))
this.socket.on('tts', (message: TTSMessage) => this.handleTTSMessage(message))
this.socket.on('llm', (message: LLMMessage) => this.handleLLMMessage(message))
this.socket.on('mcp', (message: MCPMessage) => this.handleMCPMessage(message))
this.socket.on('audio', (data: ArrayBuffer) => this.handleAudioData(data))
```

#### 消息发送变更

**之前 (原生 WebSocket)**:
```typescript
// 发送 JSON 消息
this.ws.send(JSON.stringify(message))

// 发送二进制数据
this.ws.send(audioData)
```

**之后 (Socket.IO)**:
```typescript
// 使用命名事件发送消息
this.socket.emit('hello', helloMessage)
this.socket.emit('listen', listenMessage)
this.socket.emit('audio', audioData)
```

#### 重连管理变更

**之前**: 手动实现重连逻辑
**之后**: Socket.IO 内置自动重连

```typescript
// 配置自动重连
reconnection: true,
reconnectionDelay: 3000,
reconnectionAttempts: 10

// 监听重连事件
this.socket.on('reconnect_attempt', (attemptNumber) => { ... })
this.socket.on('reconnect', () => { ... })
this.socket.on('reconnect_failed', () => { ... })
```

### 4. 配置变更 (`src/config/websocket.ts`)

#### URL 格式变更

**之前**: WebSocket 协议
```typescript
url: 'wss://your-server.com/ws'
```

**之后**: HTTP 协议 (Socket.IO 会自动升级到 WebSocket)
```typescript
url: 'https://your-server.com'
```

#### 新增配置项
```typescript
export const websocketConfig: WebsocketConfig = {
  // ... 现有配置 ...

  // Socket.IO 特有配置
  path: '/socket.io',                      // Socket.IO 路径
  transports: ['websocket', 'polling']     // 传输方式优先级
}
```

## 服务器端需要的变更

### 1. 安装 Socket.IO 服务器

```bash
npm install socket.io
# 或
yarn add socket.io
# 或
pnpm add socket.io
```

### 2. 认证方式变更

**之前**: 从 WebSocket 握手头中读取 subprotocols
```javascript
// 解析 Sec-WebSocket-Protocol header
const protocols = request.headers['sec-websocket-protocol']
```

**之后**: 从 Socket.IO 的 auth 对象中读取
```javascript
const io = new Server(httpServer)

io.use((socket, next) => {
  const { token, deviceId, clientId, protocolVersion } = socket.handshake.auth

  // 验证认证信息
  if (!token) {
    return next(new Error('Authentication error'))
  }

  // 验证 token 并附加用户信息到 socket
  verifyToken(token)
    .then(user => {
      socket.data.user = user
      socket.data.deviceId = deviceId
      socket.data.clientId = clientId
      next()
    })
    .catch(err => next(new Error('Authentication failed')))
})
```

### 3. 事件处理变更

**之前**: 监听 message 事件并路由
```javascript
ws.on('message', (data) => {
  const message = JSON.parse(data)
  switch (message.type) {
    case 'hello':
      handleHello(message)
      break
    // ...
  }
})
```

**之后**: 使用命名事件
```javascript
io.on('connection', (socket) => {
  socket.on('hello', (message) => handleHello(socket, message))
  socket.on('listen', (message) => handleListen(socket, message))
  socket.on('mcp', (message) => handleMCP(socket, message))
  socket.on('audio', (data) => handleAudio(socket, data))

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', reason)
  })
})
```

### 4. 消息发送变更

**之前**: 发送原始数据
```javascript
ws.send(JSON.stringify({ type: 'tts', state: 'start' }))
ws.send(audioBuffer)
```

**之后**: 使用命名事件
```javascript
socket.emit('tts', { type: 'tts', state: 'start', text: '...' })
socket.emit('audio', audioBuffer)
```

### 5. 房间和广播 (可选)

Socket.IO 提供了强大的房间和广播功能:

```javascript
// 加入房间
socket.join(`session:${sessionId}`)

// 向房间广播
io.to(`session:${sessionId}`).emit('tts', message)

// 向所有客户端广播(除了发送者)
socket.broadcast.emit('user_joined', userId)

// 向所有客户端广播(包括发送者)
io.emit('system_message', message)
```

## Socket.IO 的优势

### 1. 自动重连
- 内置智能重连机制
- 指数退避算法
- 可配置的重连策略

### 2. 传输降级
- 优先使用 WebSocket
- 自动降级到长轮询(polling)
- 确保在各种网络环境下都能工作

### 3. 心跳机制
- 自动发送 ping/pong
- 检测连接健康状态
- 自动断开死连接

### 4. 二进制数据支持
- 原生支持 ArrayBuffer 和 Blob
- 无需手动序列化
- 自动优化传输

### 5. 房间和命名空间
- 轻松实现多房间功能
- 命名空间隔离不同功能
- 高效的消息路由

### 6. 跨浏览器兼容
- 兼容所有现代浏览器
- 兼容旧版浏览器(通过 polling)
- 移动端友好

## 测试清单

### 客户端测试

- [ ] 基本连接
  - [ ] 成功连接到服务器
  - [ ] 连接日志正确输出
  - [ ] 认证信息正确传递

- [ ] 消息收发
  - [ ] hello 消息发送和接收
  - [ ] listen 消息发送
  - [ ] TTS 消息接收
  - [ ] LLM 情感消息接收
  - [ ] MCP 消息收发

- [ ] 音频传输
  - [ ] 音频数据发送
  - [ ] 音频数据接收
  - [ ] 二进制数据完整性

- [ ] 重连机制
  - [ ] 断网后自动重连
  - [ ] 重连成功后恢复会话
  - [ ] 重连失败处理

- [ ] 错误处理
  - [ ] 认证失败处理
  - [ ] 连接超时处理
  - [ ] 消息发送失败处理

### 服务器端测试

- [ ] 认证中间件
  - [ ] Token 验证
  - [ ] 设备ID验证
  - [ ] 无效认证拒绝

- [ ] 事件处理
  - [ ] 所有消息类型正确处理
  - [ ] 音频数据正确接收
  - [ ] 错误情况正确处理

- [ ] 连接管理
  - [ ] 客户端连接追踪
  - [ ] 客户端断开清理
  - [ ] 会话状态管理

## 环境变量配置

确保 `.env` 文件中的配置正确:

```env
# Socket.IO 服务器 URL (使用 HTTP/HTTPS,不是 WS/WSS)
VITE_WS_URL=https://your-server.com

# 访问令牌
VITE_ACCESS_TOKEN=your-access-token
```

## 兼容性说明

### 向后兼容
- API 接口保持不变
- 外部调用无需修改
- 仅内部实现变更

### 服务器要求
- 需要服务器端同步升级到 Socket.IO
- 原生 WebSocket 服务器不兼容
- 需要实现新的认证和事件处理机制

## 故障排查

### 连接失败

1. **检查 URL 格式**
   - 应该是 `https://` 而不是 `wss://`
   - 不需要包含 `/ws` 路径

2. **检查认证配置**
   - Token 是否正确设置
   - DeviceId 和 ClientId 是否生成

3. **检查服务器端**
   - Socket.IO 服务器是否运行
   - 认证中间件是否正确配置
   - CORS 设置是否允许跨域

### 消息接收失败

1. **检查事件名称**
   - 客户端和服务器端事件名称必须一致
   - 区分大小写

2. **检查消息格式**
   - Socket.IO 会自动序列化 JSON
   - 无需手动 stringify/parse

### 音频传输问题

1. **检查二进制数据类型**
   - 应该是 ArrayBuffer
   - Socket.IO 原生支持二进制传输

2. **检查数据大小**
   - Socket.IO 有默认的消息大小限制
   - 可能需要在服务器端调整 `maxHttpBufferSize`

## 迁移完成确认

- [x] Socket.IO 客户端库已安装
- [x] 类型定义已更新
- [x] 服务实现已重构
- [x] 配置文件已更新
- [ ] 服务器端已同步升级
- [ ] 连接测试通过
- [ ] 消息收发测试通过
- [ ] 音频传输测试通过
- [ ] 重连机制测试通过

## 参考资料

- [Socket.IO 官方文档](https://socket.io/docs/v4/)
- [Socket.IO 客户端 API](https://socket.io/docs/v4/client-api/)
- [Socket.IO 服务器 API](https://socket.io/docs/v4/server-api/)
- [认证中间件示例](https://socket.io/docs/v4/middlewares/)
