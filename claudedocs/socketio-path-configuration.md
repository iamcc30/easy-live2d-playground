# Socket.IO 路径配置指南

## 问题症状

连接 URL 自动添加 `/socket.io` 路径:
```
配置: ws://111.230.57.211:8888
实际连接: ws://111.230.57.211:8888/socket.io/?EIO=4&transport=websocket
```

## 解决方案

### 方案 1: 在 URL 中指定路径 (推荐)

如果服务器不使用 `/socket.io` 路径,直接在 URL 中指定完整路径:

**.env**:
```env
# 服务器使用根路径
VITE_WS_URL=http://111.230.57.211:8888/

# 或服务器使用自定义路径
VITE_WS_URL=http://111.230.57.211:8888/api/ws
```

### 方案 2: 使用配置文件

在 `src/config/websocket.ts` 中设置:

```typescript
export const websocketConfig: WebsocketConfig = {
  url: 'http://111.230.57.211:8888',
  path: '/',  // 使用根路径,不是 /socket.io
  // ...
}
```

### 方案 3: 禁用 Socket.IO 默认路径

如果需要完全禁用默认的 `/socket.io` 路径,设置 `path: false`:

```typescript
path: false  // 禁用任何路径前缀
```

## 路径优先级

代码会按以下顺序决定使用的路径:

1. **config.path** (如果设置且不为空字符串)
2. **URL pathname** (如果 URL 包含路径部分)
3. **Socket.IO 默认** (`/socket.io`)

### 示例

| 配置 | 实际连接 |
|------|----------|
| `url: 'http://server.com'`<br>`path: ''` | `http://server.com/socket.io/` |
| `url: 'http://server.com/api'`<br>`path: ''` | `http://server.com/api/` |
| `url: 'http://server.com'`<br>`path: '/ws'` | `http://server.com/ws/` |
| `url: 'http://server.com/api'`<br>`path: '/ws'` | `http://server.com/ws/` (path 覆盖 URL) |

## 当前代码逻辑

```typescript
// 解析 URL
const url = new URL(websocketConfig.url)
const serverUrl = `${url.protocol}//${url.host}`
const urlPath = url.pathname && url.pathname !== '/' ? url.pathname : undefined

// 路径优先级
const finalPath = websocketConfig.path !== undefined && websocketConfig.path !== ''
  ? websocketConfig.path   // 优先使用配置
  : urlPath                // 然后使用 URL 路径
  // 否则 Socket.IO 使用默认 /socket.io

if (finalPath) {
  socketOptions.path = finalPath
}
```

## 调试日志

连接时会输出详细日志:

```
🔗 Connecting to Socket.IO server: http://111.230.57.211:8888
📝 URL path: /api/ws (或 (using Socket.IO default))
📝 Authentication info: { deviceId: "...", ... }
📍 Using custom path: /api/ws (或 Using Socket.IO default path (/socket.io))
```

## 针对你的情况

根据你看到的连接 `ws://111.230.57.211:8888/socket.io/`,有两种可能:

### 情况 A: 服务器确实使用 `/socket.io` 路径

如果你的服务器配置为使用 Socket.IO 默认路径,当前配置是正确的:

```env
VITE_WS_URL=http://111.230.57.211:8888
```

**这种情况不需要修改任何东西**。

### 情况 B: 服务器不使用路径(根路径)

如果你的服务器监听在根路径(不是 `/socket.io`),修改配置:

```env
# 方法 1: URL 中指定根路径
VITE_WS_URL=http://111.230.57.211:8888/

# 方法 2: 在配置文件中设置
```

或在 `src/config/websocket.ts` 中:
```typescript
path: false  // 完全禁用路径前缀
```

## 服务器端对应配置

### Node.js Socket.IO 服务器

```javascript
// 默认路径 /socket.io
const io = new Server(httpServer)

// 自定义路径
const io = new Server(httpServer, {
  path: '/api/ws'
})

// 根路径 (不推荐)
const io = new Server(httpServer, {
  path: '/'
})
```

### 如何确认服务器路径

1. **查看服务器日志**:服务器启动时通常会输出监听路径
2. **查看服务器代码**:检查 `new Server()` 的配置
3. **测试连接**:使用浏览器或 curl 测试:
   ```bash
   curl http://111.230.57.211:8888/socket.io/
   # 如果返回 "0" 或其他响应,说明路径正确
   # 如果 404,说明路径不对
   ```

## 建议

1. **先确认服务器路径配置**
2. **根据服务器配置调整客户端**
3. **查看浏览器控制台日志**,确认使用的路径
4. **如果仍有问题**,提供服务器端的 Socket.IO 配置代码
