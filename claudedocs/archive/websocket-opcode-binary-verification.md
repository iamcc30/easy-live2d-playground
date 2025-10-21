# WebSocket Opcode 二进制音频数据处理 - 验证文档

## ✅ 当前实现正确性确认

### WebSocket 配置

**文件**: `src/services/websocket.ts:76`

```typescript
this.ws.binaryType = 'arraybuffer'
```

**效果**:
- WebSocket 接收的二进制帧 (opcode 0x02) 会自动转换为 `ArrayBuffer`
- 无需手动处理 Blob 或其他格式
- 性能最优，直接内存访问

---

## 📡 WebSocket Opcode 说明

### WebSocket 帧类型

| Opcode | 类型 | 说明 | 客户端处理 |
|--------|------|------|----------|
| 0x00 | Continuation | 延续帧 | - |
| 0x01 | Text | 文本数据 | `typeof data === 'string'` |
| **0x02** | **Binary** | **二进制数据** | `data instanceof ArrayBuffer` |
| 0x08 | Close | 关闭连接 | `onclose` 事件 |
| 0x09 | Ping | 心跳 ping | 自动响应 pong |
| 0x0A | Pong | 心跳 pong | - |

**服务器音频数据**: 使用 **opcode 0x02 (Binary)**

---

## 🔍 数据流分析

### 服务器端发送

```python
# Python 服务器端示例
import websockets

async def send_audio(websocket, audio_data: bytes):
    # 发送二进制数据 (WebSocket opcode 0x02)
    await websocket.send(audio_data)
    # audio_data 可以是:
    # - OGG/Opus 容器格式
    # - WebM/Opus 容器格式
    # - Raw PCM 数据
```

**WebSocket 帧结构**:
```
FIN: 1 (最后一帧)
RSV: 000
Opcode: 0010 (Binary)
Mask: 0 (服务器到客户端不需要掩码)
Payload length: [数据长度]
Payload: [音频数据]
```

### 客户端接收

**当前实现** (`src/services/websocket.ts:164-179`):

```typescript
private handleMessage(event: MessageEvent): void {
  if (event.data instanceof ArrayBuffer) {
    // ✅ 二进制帧 (opcode 0x02)
    // binaryType = 'arraybuffer' 确保这里接收到 ArrayBuffer
    this.handleAudioData(event.data)
  }
  else if (typeof event.data === 'string') {
    // ✅ 文本帧 (opcode 0x01)
    const message = JSON.parse(event.data)
    this.handleJsonMessage(message)
  }
}
```

**数据类型验证**:
```typescript
console.log('收到数据类型:', event.data.constructor.name)
// 输出: ArrayBuffer (正确! ✅)

// 如果 binaryType = 'blob'，则会输出: Blob (不推荐)
```

---

## 🎵 音频数据处理

### 音频播放服务处理流程

**文件**: `src/services/audioPlayback.ts:52-148`

```typescript
async addAudioData(data: ArrayBuffer): Promise<void> {
  // 1. 添加到队列
  this.audioQueue.push(data)

  // 2. 缓冲策略 (等待3个chunk或500ms)
  if (!this.isPlaying) {
    if (this.audioQueue.length >= 3) {
      await this.playNext()  // 立即播放
    } else {
      setTimeout(() => this.playNext(), 500)  // 延迟播放
    }
  }
}

private async playNext(): Promise<void> {
  const audioData = this.audioQueue.shift()!

  try {
    // 尝试解码为编码音频 (OPUS/OGG/WebM)
    audioBuffer = await this.audioContext.decodeAudioData(audioData)
    console.log('✅ 成功解码为编码音频')
  }
  catch (decodeError) {
    // 降级到 PCM
    audioBuffer = await this.decodePCMAudio(audioData)
  }

  // 播放
  this.currentSource.buffer = audioBuffer
  this.currentSource.start()
}
```

### 支持的音频格式

| 格式 | 容器 | 编解码器 | 浏览器支持 | 服务器推荐 |
|------|------|---------|----------|----------|
| **OGG/Opus** | OGG | Opus | Chrome, Firefox, Edge | ✅ **推荐** |
| **WebM/Opus** | WebM | Opus | Chrome, Edge | ✅ 推荐 |
| WAV | WAV | PCM | 全部 | ⚠️ 文件大 |
| MP3 | MP3 | MP3 | 全部 | ⚠️ 延迟高 |
| **Raw PCM** | 无 | PCM | 手动解码 | ⚠️ 带宽大 |

---

## 🧪 验证测试

### 测试 1: 验证 binaryType 配置

在浏览器控制台执行:

```javascript
// 查找 WebSocket 实例
const ws = websocketService.ws

console.log('WebSocket binaryType:', ws.binaryType)
// 预期输出: "arraybuffer" ✅

console.log('WebSocket readyState:', ws.readyState)
// 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
```

### 测试 2: 拦截并检查接收数据

```javascript
// 拦截 WebSocket onmessage
const originalOnMessage = websocketService.ws.onmessage

websocketService.ws.onmessage = function(event) {
  console.group('📥 WebSocket 消息拦截')
  console.log('数据类型:', event.data.constructor.name)

  if (event.data instanceof ArrayBuffer) {
    console.log('✅ 二进制数据 (opcode 0x02)')
    console.log('数据大小:', event.data.byteLength, 'bytes')

    // 查看前几个字节
    const view = new Uint8Array(event.data)
    const header = Array.from(view.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
    console.log('数据头部:', header)

    // 检测格式
    if (header.startsWith('4f 67 67 53')) {
      console.log('🎵 格式: OGG/Opus')
    } else if (header.startsWith('1a 45 df a3')) {
      console.log('🎵 格式: WebM')
    } else {
      console.log('📊 格式: 可能是 PCM 或其他')
    }
  }
  else if (typeof event.data === 'string') {
    console.log('📝 文本数据 (opcode 0x01)')
    console.log('内容:', event.data.substring(0, 100))
  }

  console.groupEnd()

  // 调用原始处理函数
  return originalOnMessage.call(this, event)
}

console.log('✅ WebSocket 消息拦截器已激活')
```

### 测试 3: 验证音频解码

```javascript
// 监听音频播放统计
setInterval(() => {
  const stats = audioPlaybackService.getPlaybackStats()
  console.log('📊 播放统计:', stats)
  // 查看:
  // - totalChunks: 总接收块数
  // - successfulChunks: 成功解码数
  // - failedChunks: 失败块数
  // - successRate: 成功率
}, 5000)
```

---

## 🔧 故障排查

### 问题 1: 接收到 Blob 而不是 ArrayBuffer

**症状**:
```javascript
console.log(event.data.constructor.name)
// 输出: Blob ❌
```

**原因**: `binaryType` 未设置或设置错误

**解决**:
```typescript
this.ws.binaryType = 'arraybuffer'  // 确保在 onopen 之前设置
```

### 问题 2: 音频解码失败

**症状**:
```
⚠️ Failed to decode as encoded audio
❌ Failed to decode chunk (both OPUS and PCM)
```

**可能原因**:
1. 服务器发送的不是有效的音频格式
2. 音频数据损坏
3. 格式不受浏览器支持

**调试**:
```javascript
// 保存接收到的音频数据用于分析
const audioChunks = []
websocketService.ws.onmessage = function(event) {
  if (event.data instanceof ArrayBuffer) {
    audioChunks.push(event.data)

    // 保存前几个chunk用于分析
    if (audioChunks.length === 5) {
      // 创建 Blob 并下载
      const blob = new Blob(audioChunks, { type: 'audio/ogg' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'received_audio.ogg'
      a.click()

      console.log('✅ 已保存前5个音频块到 received_audio.ogg')
    }
  }
}
```

### 问题 3: 音频播放延迟高

**症状**: 听到的音频有明显延迟

**原因**: 缓冲策略过于保守

**调整**:
```typescript
// src/services/audioPlayback.ts
private minBufferChunks = 3  // 减少到 1-2
private bufferTimeout = 500   // 减少到 100-200ms
```

---

## 📊 性能监控

### 关键指标

```javascript
// 实时监控
const monitor = setInterval(() => {
  console.group('🎵 音频性能监控')

  // WebSocket 统计
  const sessionInfo = websocketService.getSessionInfo()
  console.log('WebSocket 接收:', {
    totalBytes: sessionInfo.audioBytesReceived,
    avgRate: (sessionInfo.audioBytesReceived /
             ((Date.now() - sessionInfo.startTime.getTime()) / 1000)).toFixed(0) + ' bytes/s'
  })

  // 播放统计
  const playStats = audioPlaybackService.getPlaybackStats()
  console.log('音频播放:', {
    queueLength: playStats.queueLength,
    successRate: playStats.successRate,
    totalDuration: playStats.totalDuration.toFixed(2) + 's'
  })

  console.groupEnd()
}, 3000)

// 停止监控
// clearInterval(monitor)
```

### 预期性能

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 接收速率 | 10-50 KB/s | 取决于音频质量 |
| 解码成功率 | >95% | 偶尔失败可接受 |
| 队列长度 | 0-5 | 过大说明播放慢于接收 |
| 播放延迟 | <500ms | 从接收到播放的延迟 |

---

## ✅ 总结

### 当前实现优势

1. **正确使用 binaryType**
   - ✅ 设置为 `'arraybuffer'`
   - ✅ 直接内存访问，性能最优
   - ✅ 兼容所有音频格式

2. **智能格式检测**
   - ✅ 优先尝试 OPUS/OGG/WebM 解码
   - ✅ 自动降级到 PCM
   - ✅ 错误处理完善

3. **缓冲策略**
   - ✅ 平衡延迟和流畅度
   - ✅ 防止播放卡顿
   - ✅ 可配置参数

### 无需修改

**当前 WebSocket 实现完全正确处理 opcode 0x02 二进制帧！** ✅

唯一需要确认的是**服务器发送的音频格式**:
- 推荐: **OGG/Opus** 或 **WebM/Opus**
- 备用: **Raw PCM** (Int16, 单声道, 16kHz)

---

## 📚 参考资料

- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WebSocket Protocol - RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [Web Audio API - decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [ArrayBuffer vs Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

**验证完成！当前实现正确处理 WebSocket opcode 二进制音频数据。** ✅
