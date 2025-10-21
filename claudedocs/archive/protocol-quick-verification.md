# WebSocket 协议合规性 - 快速验证指南

## 🎯 关键发现

根据协议规范诊断，发现了**1个严重问题**和**2个中等问题**：

### 🔴 严重问题: HTTP Headers 认证限制

**协议要求**: 通过 HTTP Headers 传递认证信息
```
Authorization: Bearer <token>
Protocol-Version: 1
Device-Id: <device_id>
Client-Id: <client_id>
```

**当前实现**: 通过 URL 查询参数传递
```typescript
url.searchParams.set('token', token)
url.searchParams.set('deviceId', websocketConfig.deviceId)
// ...
```

**根本原因**: 浏览器原生 WebSocket API **不支持自定义 HTTP Headers**

---

## 🧪 立即验证步骤

### 步骤 1: 测试当前实现是否可用

**启动应用**:
```bash
pnpm dev
```

**打开浏览器控制台** (F12)，执行以下代码：

```javascript
// 测试连接
console.log('🧪 开始连接测试...')

websocketService.connect({
  onConnected: () => {
    console.log('✅ 连接成功！')
    console.log('说明: 服务器接受 URL 参数认证方式')
    console.log('结论: 当前实现可用，无需修改')
  },
  onError: (error) => {
    console.log('❌ 连接失败:', error.message)
    console.log('可能原因: 服务器要求 HTTP Headers 认证')
    console.log('需要: 修改认证方式')
  },
  onHello: (message) => {
    console.group('📨 Hello 响应分析')
    console.log('完整消息:', message)

    if (message.session_id) {
      console.log('✅ 服务器返回了 session_id:', message.session_id)
      console.log('⚠️ 与协议文档不符（文档说不返回）')
    } else {
      console.log('ℹ️ 服务器未返回 session_id')
      console.log('✅ 符合协议文档说明')
    }

    console.groupEnd()
  }
}).catch(error => {
  console.error('💥 连接异常:', error)
})
```

---

### 步骤 2: 检查网络请求

**Chrome DevTools → Network → WS (WebSocket)**

1. **检查请求 URL**:
   ```
   ws://your-server.com/?token=xxx&deviceId=xxx&clientId=xxx&protocolVersion=1
   ```
   确认参数是否正确附加

2. **检查请求 Headers**:
   ```
   看是否有 Authorization 等 headers
   （正常情况下不会有，因为浏览器 API 限制）
   ```

3. **检查握手响应**:
   ```
   HTTP/1.1 101 Switching Protocols
   Upgrade: websocket
   Connection: Upgrade
   ```
   - 如果看到 101 → 连接成功 ✅
   - 如果看到 40x → 认证失败 ❌

---

### 步骤 3: 服务器日志分析

**请求后端团队检查服务器日志**:

```python
# 服务器端应该记录
print(f"收到连接请求")
print(f"URL 参数: {request.query_params}")
print(f"Headers: {request.headers}")

# 检查是否从 URL 参数中提取了认证信息
if 'token' in request.query_params:
    print("✅ 服务器从 URL 参数获取 token")
else:
    print("❌ 服务器期望从 Headers 获取 token")
```

---

## 🔧 如果需要修改 - 解决方案

### 方案 A: 协商修改协议 ⭐ **最推荐**

**与后端团队协商**:
```
请求: 允许通过 URL 查询参数传递认证信息
理由: 浏览器 WebSocket API 不支持自定义 Headers
好处: 无需修改现有代码，立即可用
```

---

### 方案 B: WebSocket 子协议认证

**实现代码**:
```typescript
// src/services/websocket.ts
async connect(handlers: WebsocketEventHandlers = {}): Promise<void> {
  const token = getAccessToken()
  const wsUrl = websocketConfig.url.replace(/^http/, 'ws')

  // 方式 1: 使用子协议传递认证
  const protocols = [
    `auth.${token}`,
    `device.${websocketConfig.deviceId}`,
    `client.${websocketConfig.clientId}`,
    `version.${websocketConfig.protocolVersion}`
  ]

  // 创建连接时指定子协议
  this.ws = new WebSocket(wsUrl, protocols)

  // ... 其他代码
}
```

**服务器端需要配合**:
```python
# 服务器端解析子协议
def on_connect(websocket, path):
    protocols = websocket.request_headers.get('Sec-WebSocket-Protocol', '')
    for protocol in protocols.split(', '):
        if protocol.startswith('auth.'):
            token = protocol[5:]  # 提取 token
        elif protocol.startswith('device.'):
            device_id = protocol[7:]
        # ...
```

---

### 方案 C: Hello 消息中包含认证 ⭐ **次推荐**

**修改 Hello 消息**:
```typescript
// src/services/websocket.ts
private async sendHello(): Promise<void> {
  const helloMessage = {
    type: 'hello',
    version: websocketConfig.protocolVersion,
    transport: 'websocket',

    // 添加认证信息
    auth: {
      token: getAccessToken(),
      deviceId: websocketConfig.deviceId,
      clientId: websocketConfig.clientId
    },

    features: {
      mcp: true
    },
    audio_params: {
      format: audioRecordingConfig.format,
      sample_rate: audioRecordingConfig.sampleRate,
      channels: audioRecordingConfig.channels,
      frame_duration: audioRecordingConfig.frameDuration
    }
  }

  this.send(helloMessage)
}
```

**优点**:
- ✅ 不依赖 URL 参数或子协议
- ✅ 认证信息在应用层传递，更安全
- ✅ 易于扩展

**缺点**:
- ⚠️ 需要服务器先接受未认证的连接
- ⚠️ 然后在 Hello 消息中验证

---

## 📊 验证结果判断

### 场景 1: 连接成功 ✅

**控制台输出**:
```
✅ 连接成功！
说明: 服务器接受 URL 参数认证方式
结论: 当前实现可用，无需修改
```

**后续行动**:
- 无需修改认证代码
- 只需处理 Session ID 语义问题
- 验证音频格式兼容性

---

### 场景 2: 连接失败 - 认证错误 ❌

**控制台输出**:
```
❌ 连接失败: Connection failed
或
❌ WebSocket error
```

**Network 面板显示**:
```
Status Code: 401 Unauthorized
或
Status Code: 403 Forbidden
```

**后续行动**:
1. 与后端团队确认是否支持 URL 参数认证
2. 如果不支持，选择方案 B 或 C
3. 修改代码并测试

---

### 场景 3: 连接超时 ⏱️

**控制台输出**:
```
❌ 连接失败: Connection timeout
```

**可能原因**:
- 网络问题
- 服务器地址错误
- 防火墙阻止

**后续行动**:
1. 检查服务器 URL 配置
2. 验证网络连通性
3. 检查防火墙设置

---

## 🎯 验证清单

运行测试后，请确认以下各项：

- [ ] WebSocket 连接状态（成功/失败）
- [ ] 服务器是否接受 URL 参数认证
- [ ] 服务器是否返回 session_id
- [ ] Hello 消息是否正确发送
- [ ] Hello 响应是否正确接收
- [ ] 音频编码格式（opus/ogg 或 pcm）
- [ ] 音频数据是否能正确发送
- [ ] 服务器音频响应是否能正确接收

---

## 📞 需要帮助？

### 如果验证失败

**收集以下信息**:
1. 浏览器控制台完整日志
2. Network → WS 请求详情（截图）
3. 服务器端日志（如果有权限）
4. 错误消息和状态码

**提供给后端团队**:
- 协议诊断报告: `claudedocs/protocol-compliance-diagnosis.md`
- 当前实现说明
- 期望的认证方式

---

## ✅ 下一步行动

1. **立即执行**: 运行步骤 1 的验证脚本
2. **记录结果**: 截图保存连接状态和 Hello 响应
3. **分析问题**: 根据结果判断是否需要修改
4. **与后端沟通**: 如果需要修改认证方式
5. **应用修复**: 选择合适的解决方案

**预计时间**: 10-15 分钟

**成功标志**: 看到 "✅ 连接成功！" 消息

---

生成时间: 2025-10-19
文档版本: 1.0
相关文档: `claudedocs/protocol-compliance-diagnosis.md`
