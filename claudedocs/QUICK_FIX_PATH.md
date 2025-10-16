# 快速配置指南 - 移除 /socket.io 路径

## 问题

连接地址自动添加 `/socket.io`:
```
配置: http://111.230.57.211:8888
连接: http://111.230.57.211:8888/socket.io/
```

## 解决方案

### 选项 1: 在 URL 末尾添加斜杠 (最简单)

**.env** 或 **.env.local**:
```env
# 添加斜杠表示使用根路径
VITE_WS_URL=http://111.230.57.211:8888/
```

### 选项 2: 指定完整的服务器路径

如果服务器使用自定义路径,例如 `/api/ws`:
```env
VITE_WS_URL=http://111.230.57.211:8888/api/ws
```

### 选项 3: 使用配置文件

在 `src/config/websocket.ts` 中:
```typescript
export const websocketConfig: WebsocketConfig = {
  url: 'http://111.230.57.211:8888',
  path: false,  // 禁用所有路径前缀
  // ...
}
```

## 连接结果

| 配置 | 实际连接路径 |
|------|-------------|
| `http://server.com` | `/socket.io/` (Socket.IO 默认) |
| `http://server.com/` | `/` (根路径) |
| `http://server.com/api` | `/api/` |
| `path: false` | 无路径前缀 |

## 验证

启动应用后,在浏览器控制台查看日志:

```
🔗 Connecting to Socket.IO server: http://111.230.57.211:8888
📝 URL path: / (或其他路径)
📍 Using custom path: / (或 Using Socket.IO default path (/socket.io))
```

在 Network 标签查看实际请求 URL。

## 推荐配置

**如果服务器使用 Socket.IO 默认配置**:
```env
VITE_WS_URL=http://111.230.57.211:8888
```

**如果服务器不使用 `/socket.io` 路径**:
```env
VITE_WS_URL=http://111.230.57.211:8888/
```

## 还有问题?

检查你的服务器配置:
```javascript
// 服务器代码
const io = new Server(httpServer, {
  path: '/socket.io'  // 这是默认值
  // 或
  path: '/'  // 根路径
  // 或
  path: '/api/ws'  // 自定义路径
})
```

客户端的 `VITE_WS_URL` 应该与服务器的 `path` 配置匹配。
