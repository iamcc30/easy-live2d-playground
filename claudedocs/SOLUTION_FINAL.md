# Socket.IO 路径问题最终解决方案

## 问题

即使配置为空字符串,连接仍然使用 `/socket.io` 路径:
```
配置: VITE_WS_URL=http://111.230.57.211:8888
连接: ws://111.230.57.211:8888/socket.io/?EIO=4&transport=websocket
```

## 根本原因

Socket.IO 客户端的默认行为:
- **未设置 `path` 选项**:使用 `/socket.io` (默认值)
- **`path: ''`** (空字符串):也使用 `/socket.io` (默认值)
- **`path: '/'`**:使用根路径,**不添加** `/socket.io`

## 最终解决方案

已在 `src/config/websocket.ts:40` 修改:

```typescript
export const websocketConfig: WebsocketConfig = {
  // ...
  path: '/', // 明确设置为根路径,不使用 /socket.io
  // ...
}
```

## 路径配置规则

| 配置值 | 连接路径 | 说明 |
|-------|---------|------|
| `path: ''` | `/socket.io/` | Socket.IO 默认路径 |
| `path: '/'` | `/` | **根路径,无前缀** |
| `path: '/api'` | `/api/` | 自定义路径 |
| `path: undefined` | URL 路径或 `/socket.io/` | 使用 URL 中的路径 |

## 连接行为验证

启动应用后,在浏览器控制台查看:

```
🔗 Connecting to Socket.IO server: http://111.230.57.211:8888
📝 URL path: (using Socket.IO default)
📝 Authentication info: { ... }
📍 Using configured path: /
```

在 Network 标签查看实际请求:
```
# 之前 (错误)
ws://111.230.57.211:8888/socket.io/?EIO=4&transport=websocket

# 之后 (正确)
ws://111.230.57.211:8888/?EIO=4&transport=websocket
```

## 其他配置选项

### 选项 1: 保持当前配置 (推荐)

`src/config/websocket.ts`:
```typescript
path: '/',  // 使用根路径
```

### 选项 2: 通过 URL 配置

`.env` 或 `.env.local`:
```env
# URL 末尾添加斜杠
VITE_WS_URL=http://111.230.57.211:8888/
```

然后在配置文件中:
```typescript
path: undefined,  // 使用 URL 中的路径
```

### 选项 3: 使用 Socket.IO 默认路径

如果服务器确实使用 `/socket.io` 路径:
```typescript
path: '',  // 或 path: '/socket.io'
```

## 服务器端对应配置

确保服务器端配置与客户端匹配:

### 根路径 (对应 `path: '/'`)
```javascript
const io = new Server(httpServer, {
  path: '/'
})
```

### Socket.IO 默认路径 (对应 `path: ''`)
```javascript
const io = new Server(httpServer)
// 或
const io = new Server(httpServer, {
  path: '/socket.io'
})
```

### 自定义路径 (对应 `path: '/custom'`)
```javascript
const io = new Server(httpServer, {
  path: '/custom'
})
```

## 代码逻辑说明

`src/services/websocket.ts:84-114` 的路径处理逻辑:

```typescript
// 1. 如果 config.path 明确设置
if (websocketConfig.path !== undefined) {
  if (websocketConfig.path === '') {
    // 空字符串 → Socket.IO 默认 /socket.io
    finalPath = undefined
  } else {
    // 使用配置的路径 (如 '/' 或 '/custom')
    finalPath = websocketConfig.path
  }
}
// 2. 如果 URL 包含路径
else if (urlPath) {
  finalPath = urlPath
}
// 3. 否则使用 Socket.IO 默认
else {
  finalPath = undefined  // → /socket.io
}
```

## 故障排查

### 问题: 仍然连接到 `/socket.io`

**检查清单**:
1. ✅ 确认 `src/config/websocket.ts` 中 `path: '/'`
2. ✅ 重启开发服务器: `pnpm dev`
3. ✅ 清除浏览器缓存和 Service Workers
4. ✅ 查看控制台日志确认路径

### 问题: 连接失败

**可能原因**:
- 服务器不支持根路径连接
- CORS 配置问题
- 服务器期望 `/socket.io` 路径

**解决方案**:
1. 确认服务器配置的路径
2. 修改客户端配置以匹配服务器
3. 或修改服务器配置以支持根路径

## 完整配置示例

**.env.local**:
```env
VITE_WS_URL=http://111.230.57.211:8888
VITE_ACCESS_TOKEN=your-token-here
```

**src/config/websocket.ts**:
```typescript
export const websocketConfig: WebsocketConfig = {
  url: import.meta.env.VITE_WS_URL || 'http://localhost:8888',
  accessToken: import.meta.env.VITE_ACCESS_TOKEN || '',
  deviceId: localStorage.getItem('device_id') || generateDeviceId(),
  clientId: localStorage.getItem('client_id') || generateClientId(),
  protocolVersion: 1,
  reconnect: true,
  reconnectInterval: 3000,
  reconnectMaxAttempts: 10,

  // 关键配置: 使用根路径而不是 /socket.io
  path: '/',
  transports: ['websocket', 'polling']
}
```

## 总结

✅ **问题已解决**: 将 `path` 从 `''` (空字符串) 改为 `'/'` (根路径)

✅ **关键点**:
- `path: ''` = Socket.IO 默认 (`/socket.io`)
- `path: '/'` = 根路径 (无前缀)

✅ **验证**:
- 查看控制台日志: `📍 Using configured path: /`
- 查看 Network 标签: URL 不包含 `/socket.io`

现在连接应该直接到 `ws://111.230.57.211:8888/` 而不是 `ws://111.230.57.211:8888/socket.io/`!
