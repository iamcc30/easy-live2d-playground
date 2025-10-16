# 设备ID传输问题修复

## 问题诊断

服务器日志显示:
```json
{
  "device_id": "unknown",
  "session_id": "ecc3d56b-ce76-4b77-8192-960bf34d4180",
  "disconnect_reason": "normal"
}
```

**问题**: 服务器收到 `"device_id": "unknown"`,说明客户端没有正确传递设备ID。

## 根本原因

Socket.IO 的认证信息传递有三种方式:

1. **`auth` 对象** ✅ - 在握手时发送,服务器可以通过 `socket.handshake.auth` 访问
2. **`extraHeaders`** ❌ - 只在 HTTP 轮询时有效,WebSocket 升级后不可用
3. **`headers`** ❌ - 不是 Socket.IO 的标准选项

## 解决方案

已将认证方式改为使用 `auth` 对象:

### 客户端修改 (`src/services/websocket.ts:69-83`)

**之前 (错误)**:
```typescript
const socketOptions = {
  headers: { /* ... */ },      // ❌ 非标准选项
  extraHeaders: { /* ... */ }  // ❌ WebSocket 不支持
}
```

**之后 (正确)**:
```typescript
const socketOptions = {
  auth: {
    token,                      // ✅ 服务器可以访问
    device_id: websocketConfig.deviceId,
    client_id: websocketConfig.clientId,
    protocol_version: websocketConfig.protocolVersion
  }
}
```

## 服务器端对应修改

服务器需要从 `socket.handshake.auth` 中读取认证信息:

### Node.js + Socket.IO 服务器示例

```javascript
const { Server } = require('socket.io')

const io = new Server(httpServer, {
  path: '/',  // 对应客户端 path: '/'
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// 认证中间件
io.use((socket, next) => {
  // 从 auth 对象中读取认证信息
  const { token, device_id, client_id, protocol_version } = socket.handshake.auth

  console.log('🔐 Auth info:', {
    device_id,
    client_id,
    protocol_version,
    has_token: !!token
  })

  // 验证必需字段
  if (!token) {
    return next(new Error('Authentication error: missing token'))
  }

  if (!device_id) {
    return next(new Error('Authentication error: missing device_id'))
  }

  // 验证 token (示例)
  try {
    // const user = verifyToken(token)
    // socket.data.user = user
    socket.data.device_id = device_id
    socket.data.client_id = client_id
    socket.data.protocol_version = protocol_version
    next()
  } catch (err) {
    next(new Error('Authentication failed'))
  }
})

// 连接处理
io.on('connection', (socket) => {
  const { device_id, client_id } = socket.data

  console.log('✅ Client connected:', {
    socket_id: socket.id,
    device_id,
    client_id
  })

  // 现在可以在整个会话中访问 device_id
  socket.on('hello', (message) => {
    console.log('👋 Hello from device:', device_id)
    // 处理 hello 消息
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', {
      device_id,
      reason
    })
  })
})
```

### Python + python-socketio 服务器示例

```python
import socketio

sio = socketio.Server(
    cors_allowed_origins='*',
    path='/'  # 对应客户端 path: '/'
)

@sio.event
def connect(sid, environ, auth):
    """连接时的认证"""
    # auth 参数包含客户端的 auth 对象
    token = auth.get('token')
    device_id = auth.get('device_id')
    client_id = auth.get('client_id')
    protocol_version = auth.get('protocol_version')

    print(f'🔐 Auth info: device_id={device_id}, client_id={client_id}')

    # 验证必需字段
    if not token:
        return False  # 拒绝连接

    if not device_id:
        return False

    # 验证 token
    # user = verify_token(token)

    # 保存到 session
    with sio.session(sid) as session:
        session['device_id'] = device_id
        session['client_id'] = client_id
        session['protocol_version'] = protocol_version

    print(f'✅ Client connected: {sid}, device: {device_id}')
    return True

@sio.event
def hello(sid, data):
    """处理 hello 消息"""
    with sio.session(sid) as session:
        device_id = session.get('device_id')

    print(f'👋 Hello from device: {device_id}')
    sio.emit('hello', {'type': 'hello', 'status': 'ok'}, to=sid)

@sio.event
def disconnect(sid):
    """断开连接"""
    with sio.session(sid) as session:
        device_id = session.get('device_id')

    print(f'🔌 Client disconnected: {sid}, device: {device_id}')
```

## 客户端发送的数据格式

现在客户端发送的认证数据:

```javascript
{
  auth: {
    token: "your-access-token",
    device_id: "AB:CD:EF:12:34:56",
    client_id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    protocol_version: 1
  }
}
```

## 服务器接收方式

### 握手时 (认证中间件)
```javascript
const { token, device_id, client_id, protocol_version } = socket.handshake.auth
```

### 连接后 (从 socket.data 读取)
```javascript
const device_id = socket.data.device_id
const client_id = socket.data.client_id
```

## 验证方法

### 客户端验证

在浏览器控制台查看连接日志:
```
🔗 Connecting to Socket.IO server: http://111.230.57.211:8888
📝 Authentication info: {
  deviceId: "AB:CD:EF:12:34:56",
  clientId: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  protocolVersion: 1,
  authTokenLength: 32
}
🚀 Connecting to Socket.IO server... {
  auth: {
    token: "...",
    device_id: "AB:CD:EF:12:34:56",
    client_id: "...",
    protocol_version: 1
  }
}
```

### 服务器端验证

服务器日志应该显示:
```json
{
  "event": "client_connected",
  "device_id": "AB:CD:EF:12:34:56",  // ✅ 不再是 "unknown"
  "client_id": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "session_id": "ecc3d56b-ce76-4b77-8192-960bf34d4180"
}
```

## 与之前方法的对比

| 方法 | WebSocket | Polling | 服务器访问方式 | 推荐 |
|------|-----------|---------|---------------|------|
| `auth` 对象 | ✅ | ✅ | `socket.handshake.auth` | ✅ 推荐 |
| `extraHeaders` | ❌ | ✅ | `socket.handshake.headers` | ❌ 不可靠 |
| `headers` | ❌ | ❌ | 不支持 | ❌ 错误 |

## 重要提示

### 客户端
- ✅ 使用 `auth` 对象传递所有认证信息
- ✅ 字段名使用 snake_case (`device_id`,不是 `deviceId`)
- ✅ 重连时会自动重新发送 `auth` 数据

### 服务器端
- ✅ 从 `socket.handshake.auth` 读取认证信息
- ✅ 在认证中间件中验证所有必需字段
- ✅ 将认证信息保存到 `socket.data` 供后续使用
- ✅ 记录详细的认证和连接日志

## 故障排查

### 问题: 服务器仍然收到 "unknown"

**检查清单**:
1. ✅ 确认客户端已更新为使用 `auth` 对象
2. ✅ 重启客户端应用 (`pnpm dev`)
3. ✅ 清除浏览器缓存
4. ✅ 检查服务器是否从 `socket.handshake.auth` 读取

### 问题: 连接失败

**可能原因**:
- Token 验证失败
- 缺少必需的 auth 字段
- 服务器认证中间件返回错误

**调试方法**:
```javascript
// 客户端监听认证错误
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message)
})
```

## 完整的认证流程

1. **客户端**: 创建 Socket.IO 连接,传递 `auth` 对象
2. **服务器**: 认证中间件从 `socket.handshake.auth` 读取
3. **服务器**: 验证 token 和必需字段
4. **服务器**: 将认证信息保存到 `socket.data`
5. **服务器**: 调用 `next()` 允许连接,或 `next(error)` 拒绝
6. **客户端**: 连接成功触发 `connect` 事件
7. **整个会话**: 服务器可以从 `socket.data` 访问认证信息

现在 `device_id` 应该正确传递到服务器了!
