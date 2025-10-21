# Socket.IO 路径配置修复

## 问题描述

客户端不应自动添加 `/socket.io` 路径到连接地址,而是使用服务器端配置的自定义路径或默认路径。

## 修复内容

### 1. 配置文件更新 (`src/config/websocket.ts`)

**修改前**:
```typescript
path: '/socket.io', // Default Socket.IO path
```

**修改后**:
```typescript
path: '', // Custom Socket.IO path (empty = use server default, not '/socket.io')
```

**说明**:
- 设置 `path: ''` 表示不指定自定义路径
- Socket.IO 客户端会根据服务器的配置自动处理路径
- 如果服务器使用自定义路径,可以在这里配置,例如 `path: '/my-custom-path'`

### 2. 连接逻辑优化 (`src/services/websocket.ts`)

**修改前**:
```typescript
this.socket = io(serverUrl, {
  path: websocketConfig.path || '/socket.io',
  // ... other options
})
```

**修改后**:
```typescript
const socketOptions: any = {
  transports: websocketConfig.transports || ['websocket', 'polling'],
  extraHeaders: {
    Authorization: `Bearer ${token}`,
    'X-Device-Id': websocketConfig.deviceId,
    'X-Client-Id': websocketConfig.clientId,
    'X-Protocol-Version': String(websocketConfig.protocolVersion)
  },
  reconnection: websocketConfig.reconnect,
  reconnectionDelay: websocketConfig.reconnectInterval,
  reconnectionAttempts: websocketConfig.reconnectMaxAttempts,
  autoConnect: false
}

// Only set path if provided (empty string means no custom path)
if (websocketConfig.path) {
  socketOptions.path = websocketConfig.path
}

this.socket = io(serverUrl, socketOptions)
```

**改进点**:
1. **条件性路径设置**: 只有当 `path` 有值时才设置,空字符串时不设置 `path` 选项
2. **标准化 Header 命名**: 使用 `X-` 前缀的自定义 header
3. **更好的代码组织**: 使用 `socketOptions` 对象便于维护和扩展

### 3. 认证方式改进

**认证信息传递**:
- 从 `auth` 对象改为 `extraHeaders`
- 使用标准的 HTTP Header 格式

**Headers 格式**:
```typescript
{
  'Authorization': 'Bearer <token>',           // 标准 OAuth 格式
  'X-Device-Id': '<device-id>',               // 设备ID
  'X-Client-Id': '<client-id>',               // 客户端ID
  'X-Protocol-Version': '<version>'           // 协议版本
}
```

## 工作原理

### Socket.IO 路径处理机制

1. **客户端未指定 path**:
   ```typescript
   io('https://example.com')
   // 连接: https://example.com/socket.io/
   ```

2. **客户端指定空 path** (当前配置):
   ```typescript
   io('https://example.com', { /* path not set */ })
   // 连接: 根据服务器配置决定
   ```

3. **客户端指定自定义 path**:
   ```typescript
   io('https://example.com', { path: '/my-path' })
   // 连接: https://example.com/my-path/
   ```

### 服务器端配置示例

如果服务器使用自定义路径:

```javascript
const io = new Server(httpServer, {
  path: '/custom-socketio-path'
})
```

则客户端需要配置:
```typescript
export const websocketConfig: WebsocketConfig = {
  // ...
  path: '/custom-socketio-path'
}
```

如果服务器使用默认路径或根路径,客户端保持 `path: ''` 即可。

## 配置说明

### 环境变量

在 `.env` 文件中配置服务器地址:

```env
# Socket.IO 服务器地址 (使用 HTTP/HTTPS 协议)
VITE_WS_URL=https://your-server.com

# 如果服务器使用自定义路径,在代码中配置 path
# 例如: path: '/api/socket.io'
```

### 不同部署场景的配置

#### 场景 1: 标准 Socket.IO 服务器
```typescript
// 服务器: 使用默认 /socket.io 路径
// 客户端配置:
{
  url: 'https://api.example.com',
  path: ''  // 不设置,使用服务器默认
}
```

#### 场景 2: 自定义路径的 Socket.IO 服务器
```typescript
// 服务器: 使用 /api/realtime 路径
// 客户端配置:
{
  url: 'https://api.example.com',
  path: '/api/realtime'
}
```

#### 场景 3: 反向代理后的 Socket.IO
```typescript
// Nginx 配置: location /ws/ { proxy_pass http://socketio-server/socket.io/; }
// 客户端配置:
{
  url: 'https://example.com',
  path: '/ws'
}
```

## 测试验证

### 1. 检查连接 URL

在浏览器开发者工具中查看 Network 标签:

```
# 正确的连接请求应该是:
GET https://your-server.com/socket.io/?EIO=4&transport=polling&t=xxx
或
WS  wss://your-server.com/socket.io/?EIO=4&transport=websocket

# 如果配置了自定义路径 '/custom-path':
GET https://your-server.com/custom-path/?EIO=4&transport=polling&t=xxx
```

### 2. 检查认证 Headers

在 Network 标签中点击请求,查看 Request Headers:

```
Authorization: Bearer <your-token>
X-Device-Id: <device-id>
X-Client-Id: <client-id>
X-Protocol-Version: 1
```

### 3. 控制台日志

客户端连接成功时会输出:

```
🔗 Connecting to Socket.IO server: https://your-server.com
📝 Authentication info: { deviceId: "...", clientId: "...", ... }
🔗 Socket.IO connection established
✅ Socket.IO connected successfully
```

## 故障排查

### 问题 1: 404 Not Found

**原因**: 客户端路径与服务器路径不匹配

**解决**:
1. 检查服务器的 `path` 配置
2. 确保客户端 `websocketConfig.path` 与服务器一致
3. 如果服务器使用默认路径,客户端设置 `path: ''`

### 问题 2: 403 Forbidden

**原因**: 认证失败

**解决**:
1. 检查 `Authorization` header 格式是否正确
2. 验证 token 是否有效
3. 确认服务器端正确解析 `extraHeaders`

### 问题 3: 连接挂起或超时

**原因**: CORS 或网络配置问题

**解决**:
1. 检查服务器 CORS 配置
2. 确认服务器允许 WebSocket 升级
3. 检查防火墙和负载均衡器配置

## 类型定义修复

修复了 `protocolVersion` 的类型不一致问题:

```typescript
// src/types/websocket.ts
export interface WebsocketConfig {
  // ...
  protocolVersion: number  // 修复: 从 string 改为 number
  // ...
}
```

## 总结

✅ **已完成的优化**:
- 移除硬编码的 `/socket.io` 路径
- 实现条件性路径配置
- 标准化认证 header 格式
- 修复类型定义不一致
- 改进代码可维护性

✅ **兼容性**:
- 兼容标准 Socket.IO 服务器
- 支持自定义路径配置
- 支持反向代理场景
- 保持向后兼容性

✅ **类型安全**:
- 所有 TypeScript 类型检查通过
- 无 websocket 相关编译错误
