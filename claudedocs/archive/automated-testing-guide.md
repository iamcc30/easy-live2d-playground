# 🧪 自动化功能测试 - 快速开始

## 📋 测试准备

### 步骤 1: 启动应用

```bash
pnpm dev
```

### 步骤 2: 打开浏览器

访问: `http://localhost:5175/`

### 步骤 3: 打开开发者工具

按 **F12** 或 **Ctrl+Shift+I** (Mac: **Cmd+Option+I**)

切换到 **Console** 标签页

---

## 🚀 运行自动化测试

### 方法 1: 使用测试脚本（推荐）

**在控制台执行以下代码**:

```javascript
// 1. 加载测试脚本
const script = document.createElement('script')
script.src = '/scripts/test-voice-interaction.js'
document.head.appendChild(script)

// 2. 等待脚本加载完成（约1秒后）
setTimeout(() => {
  // 3. 运行完整测试
  runVoiceTests()
}, 1000)
```

**或者直接复制粘贴脚本内容后执行** `runVoiceTests()`

---

### 方法 2: 手动逐步测试

#### 测试 1: 连接和 Hello 消息 (2分钟)

```javascript
console.clear()
console.log('🧪 测试 1: WebSocket 连接与 Hello 消息\n')

await websocketService.connect({
  onConnected: () => {
    console.log('✅ WebSocket 连接成功')
  },
  onHello: (message) => {
    console.log('✅ Hello 消息交换成功')
    console.log('协议版本:', message.version)
    console.log('Session ID:', websocketService.getSessionInfo().sessionId)
  },
  onError: (error) => {
    console.error('❌ 连接错误:', error)
  }
})
```

**预期结果**:
```
✅ WebSocket 连接成功
✅ Hello 消息交换成功
协议版本: 1
Session ID: XX:XX:XX:XX:XX:XX-1234567890-abc123
```

---

#### 测试 2: 音频录制与发送 (10秒)

```javascript
console.clear()
console.log('🧪 测试 2: 音频录制与发送\n')

// 初始化录音
await audioRecordingService.initialize()
console.log('✅ 录音服务初始化完成')

// 检查编码器
const status = audioRecordingService.getEncoderStatus()
console.log('音频格式:', status.format)
console.log('是否支持:', status.supported)

// 开始监听
websocketService.startListen('auto')
console.log('✅ 已发送 Listen 消息')

// 开始录音（10秒）
let chunkCount = 0
await audioRecordingService.startRecording((audioData) => {
  chunkCount++
  websocketService.sendAudioData(audioData)

  if (chunkCount === 1) {
    console.log('📤 首个音频块:', audioData.byteLength, 'bytes')
  }
})

console.log('🎤 录音中... 请说话')
console.log('⏱️  将在 10 秒后停止')

// 10秒后停止
await new Promise(resolve => setTimeout(resolve, 10000))

await audioRecordingService.stopRecording()
websocketService.stopListen()

console.log('✅ 录音完成')
console.log('📊 发送音频块数:', chunkCount)

const session = websocketService.getSessionInfo()
console.log('📊 总发送字节:', session.audioBytesSent)
```

**预期结果**:
```
✅ 录音服务初始化完成
音频格式: opus/ogg
是否支持: true
✅ 已发送 Listen 消息
🎤 录音中... 请说话
📤 首个音频块: 234 bytes
✅ 录音完成
📊 发送音频块数: 15
📊 总发送字节: 3500
```

---

#### 测试 3: TTS 接收与播放 (等待响应)

```javascript
console.clear()
console.log('🧪 测试 3: TTS 音频接收与播放\n')

// 初始化播放
await audioPlaybackService.initialize()
console.log('✅ 播放服务初始化完成')

// 设置监听器
websocketService.connect({
  onTTS: (message) => {
    console.log('🔊 TTS 消息:', message.state, message.text || '')
  },
  onAudioData: (audioData) => {
    console.log('🎵 收到音频:', audioData.byteLength, 'bytes')
    audioPlaybackService.addAudioData(audioData)
  }
})

console.log('⏳ 等待服务器 TTS 响应...')
console.log('💡 提示: 需要先发送语音输入')

// 30秒后显示统计
setTimeout(() => {
  const stats = audioPlaybackService.getPlaybackStats()
  console.log('\n📊 播放统计:')
  console.log('总块数:', stats.totalChunks)
  console.log('成功解码:', stats.successfulChunks)
  console.log('成功率:', stats.successRate)
  console.log('总时长:', stats.totalDuration.toFixed(2) + 's')
}, 30000)
```

**预期结果**:
```
✅ 播放服务初始化完成
⏳ 等待服务器 TTS 响应...
🔊 TTS 消息: start
🎵 收到音频: 345 bytes
🎵 收到音频: 378 bytes
...
📊 播放统计:
总块数: 25
成功解码: 25
成功率: 100%
总时长: 2.34s
```

---

#### 测试 4: 端到端流程 (完整测试)

```javascript
console.clear()
console.log('🧪 测试 4: 端到端语音对话流程\n')

// 1. 初始化
await audioRecordingService.initialize()
await audioPlaybackService.initialize()
console.log('✅ 音频系统初始化完成')

// 2. 设置监听
let ttsReceived = false
websocketService.connect({
  onTTS: (message) => {
    if (message.state === 'start') {
      ttsReceived = true
      console.log('✅ 收到 TTS 响应')
    }
  },
  onAudioData: (data) => {
    audioPlaybackService.addAudioData(data)
  }
})

// 3. 开始录音
websocketService.startListen('auto')
await audioRecordingService.startRecording((data) => {
  websocketService.sendAudioData(data)
})

console.log('🎤 录音启动，请说话...')
console.log('⏱️  5秒后自动停止')

// 4. 等待5秒
await new Promise(resolve => setTimeout(resolve, 5000))

// 5. 停止录音
await audioRecordingService.stopRecording()
websocketService.stopListen()
console.log('✅ 录音已停止')

// 6. 等待TTS响应
console.log('⏳ 等待服务器处理...')

const checkTTS = setInterval(() => {
  if (ttsReceived) {
    clearInterval(checkTTS)
    console.log('✅ 端到端测试完成！')

    // 显示最终统计
    const session = websocketService.getSessionInfo()
    const playStats = audioPlaybackService.getPlaybackStats()

    console.log('\n📊 最终统计:')
    console.log('发送字节:', session.audioBytesSent)
    console.log('接收字节:', session.audioBytesReceived)
    console.log('播放成功率:', playStats.successRate)
  }
}, 1000)

// 15秒超时
setTimeout(() => {
  if (!ttsReceived) {
    clearInterval(checkTTS)
    console.log('⏱️ 等待超时（15秒）')
    console.log('💡 服务器可能没有返回 TTS 响应')
  }
}, 15000)
```

**预期结果**:
```
✅ 音频系统初始化完成
🎤 录音启动，请说话...
⏱️  5秒后自动停止
✅ 录音已停止
⏳ 等待服务器处理...
✅ 收到 TTS 响应
✅ 端到端测试完成！

📊 最终统计:
发送字节: 5600
接收字节: 8900
播放成功率: 100%
```

---

## 📊 快速诊断命令

### 检查连接状态
```javascript
console.log('连接状态:', websocketService.getConnectionState())
console.log('是否连接:', websocketService.isConnected())
```

### 检查Session信息
```javascript
const session = websocketService.getSessionInfo()
console.log('Session ID:', session.sessionId)
console.log('消息数:', session.messageCount)
console.log('已发送:', session.audioBytesSent, 'bytes')
console.log('已接收:', session.audioBytesReceived, 'bytes')
```

### 检查录音状态
```javascript
console.log('录音中:', audioRecordingService.getIsRecording())
const status = audioRecordingService.getEncoderStatus()
console.log('编码器:', status)
```

### 检查播放状态
```javascript
const stats = audioPlaybackService.getPlaybackStats()
console.log('播放统计:', stats)
```

---

## ⚠️ 常见问题

### 问题1: 无法录音

**症状**: 没有音频发送

**检查**:
```javascript
// 1. 检查麦克风权限
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ 麦克风权限已授予'))
  .catch(e => console.log('❌ 麦克风权限被拒绝:', e))

// 2. 检查录音状态
console.log('录音中:', audioRecordingService.getIsRecording())
```

### 问题2: 无法播放

**症状**: 收到音频但不播放

**检查**:
```javascript
// 1. 检查 AudioContext 状态
console.log('AudioContext:', audioPlaybackService.getAudioContextState())

// 2. 如果是 suspended，需要用户交互
document.addEventListener('click', () => {
  const ctx = audioPlaybackService.audioContext
  if (ctx && ctx.state === 'suspended') {
    ctx.resume()
    console.log('✅ AudioContext resumed')
  }
}, { once: true })
```

### 问题3: 解码失败

**症状**: 播放成功率低

**检查**:
```javascript
const stats = audioPlaybackService.getPlaybackStats()
console.log('成功率:', stats.successRate)
console.log('失败块数:', stats.failedChunks)

// 查看接收的音频格式
// 在 onAudioData 中添加:
const view = new Uint8Array(audioData)
const header = Array.from(view.slice(0, 4))
  .map(b => b.toString(16).padStart(2, '0'))
  .join(' ')
console.log('音频头部:', header)
// 4f 67 67 53 = OGG
// 1a 45 df a3 = WebM
```

---

## ✅ 测试检查清单

完成测试后确认：

- [ ] WebSocket 连接成功
- [ ] Hello 消息交换正常
- [ ] Session ID 正确生成
- [ ] 音频录制启动成功
- [ ] 音频格式为 opus/ogg（或 pcm 降级）
- [ ] 音频数据正常发送
- [ ] Listen 消息发送成功
- [ ] 收到 TTS 消息
- [ ] 收到音频数据
- [ ] 音频播放成功
- [ ] 播放成功率 > 80%
- [ ] 完整对话流程通畅

---

## 🎯 下一步

### 如果测试全部通过 ✅

**恭喜！系统运行正常！**

可以：
1. 集成到 UI 界面
2. 添加可视化效果
3. 优化用户体验

### 如果有问题 ⚠️

1. 记录错误日志
2. 参考相关文档
3. 检查服务器端日志
4. 联系后端团队

---

**准备好了吗？开始测试吧！** 🚀
