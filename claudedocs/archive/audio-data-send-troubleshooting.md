# 音频数据发送调试指南

## 问题描述

用户报告音频数据没有实际发送到服务器。

## 已添加的调试日志

为了帮助定位问题,我在关键位置添加了详细的调试日志:

### 1. WebSocket 发送 (`src/services/websocket.ts:411-426`)

```typescript
sendAudioData(data: ArrayBuffer): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    console.error('❌ Cannot send audio: not connected, readyState:', this.ws?.readyState)
    return
  }

  try {
    this.ws.send(data)
    this.sessionInfo.audioBytesSent += data.byteLength
    console.log(`📤 Sent audio data: ${data.byteLength} bytes (total: ${this.sessionInfo.audioBytesSent} bytes)`)
  }
  catch (error) {
    console.error('❌ Failed to send audio data:', error)
    this.handleError(error as Error)
  }
}
```

**日志说明**:
- `❌ Cannot send audio: not connected` - WebSocket 未连接或状态不是 OPEN
- `📤 Sent audio data: X bytes` - 成功发送音频数据,显示字节数和累计总数

### 2. 音频处理 (`src/services/audioRecording.ts:150-176`)

```typescript
private processAudioData(buffer: AudioBuffer): void {
  if (!this.onDataCallback) {
    console.warn('⚠️ No data callback set, skipping audio data')
    return
  }

  try {
    const channelData = buffer.getChannelData(0)

    if (this.useOpusEncoding && this.opusEncoder) {
      this.opusEncoder.encode(channelData, this.audioTimestamp)
      this.audioTimestamp += buffer.duration
      console.log(`🎵 Encoded OPUS frame: ${channelData.length} samples at ${this.audioTimestamp.toFixed(3)}s`)
    }
    else {
      const pcmData = this.float32ToInt16(channelData)
      console.log(`📊 Sending PCM data: ${pcmData.byteLength} bytes`)
      this.onDataCallback(pcmData.buffer)
    }
  }
  catch (error) {
    console.error('❌ Failed to process audio data:', error)
  }
}
```

**日志说明**:
- `⚠️ No data callback set` - 回调函数未设置
- `🎵 Encoded OPUS frame` - 使用 OPUS 编码,显示样本数和时间戳
- `📊 Sending PCM data` - 使用 PCM 回退,显示字节数

### 3. OPUS 编码器 (`src/services/opusEncoder.ts:118-137`)

```typescript
private handleEncodedChunk(chunk: EncodedAudioChunk): void {
  try {
    const buffer = new Uint8Array(chunk.byteLength)
    chunk.copyTo(buffer)

    console.log(`🎼 OPUS encoded chunk: ${buffer.byteLength} bytes, timestamp: ${chunk.timestamp}`)

    if (this.onDataCallback) {
      this.onDataCallback(buffer)
    }
    else {
      console.warn('⚠️ No callback set for encoded data')
    }
  }
  catch (error) {
    console.error('❌ Failed to handle encoded chunk:', error)
  }
}
```

**日志说明**:
- `🎼 OPUS encoded chunk` - OPUS 编码完成,显示字节数和时间戳
- `⚠️ No callback set for encoded data` - OPUS 编码器回调未设置

### 4. Chat Store 启动 (`src/stores/chat.ts:193-223`)

```typescript
async function startVoiceListen(mode: ListenMode = 'auto'): Promise<void> {
  if (!isConnected.value) {
    errorHandler.showErrorMessage('未连接', '请先连接到服务器')
    return
  }

  console.log('🎙️ Starting voice listen with mode:', mode)
  console.log('📡 WebSocket connection state:', websocketService.getConnectionState())
  console.log('🔌 WebSocket ready state:', websocketService.isConnected())

  try {
    await audioRecordingService.startRecording((audioData) => {
      console.log(`🔊 Audio callback triggered: ${audioData.byteLength} bytes`)
      websocketService.sendAudioData(audioData)
    })

    websocketService.startListen(mode)
    listenMode.value = mode
    isListening.value = true

    console.log('✅ Voice listening started successfully')
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errorHandler.showErrorMessage('启动录音失败', errorMessage)
    console.log('❌ Failed to start voice listening:', error)
    throw error
  }
}
```

**日志说明**:
- `🎙️ Starting voice listen` - 开始语音监听,显示模式
- `📡 WebSocket connection state` - 显示 WebSocket 连接状态
- `🔌 WebSocket ready state` - 显示 WebSocket 是否已连接
- `🔊 Audio callback triggered` - 音频数据回调被触发,显示字节数
- `✅ Voice listening started successfully` - 语音监听启动成功
- `❌ Failed to start voice listening` - 启动失败及错误信息

## 调试步骤

### 步骤 1: 检查 WebSocket 连接

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 点击界面上的"连接"按钮 (🟢)
4. 查看日志:

**期望看到**:
```
🔗 Connecting to WebSocket server: ws://111.230.57.211:8888
📝 Authentication info: { ... }
🔗 WebSocket connection established
👋 Server hello response: { ... }
✅ WebSocket connected successfully
```

**如果看到错误**:
- `Connection timeout` - 服务器未响应
- `Connection failed` - 无法连接到服务器
- 检查 `.env.local` 中的 `VITE_WS_URL` 配置
- 确认服务器正在运行

### 步骤 2: 启动语音监听

1. 确保已连接 (状态显示 🟢 已连接)
2. 点击麦克风按钮 (🎤)
3. 查看日志:

**期望看到**:
```
🎙️ Starting voice listen with mode: auto
📡 WebSocket connection state: connected
🔌 WebSocket ready state: true
✅ Audio recording initialized
🎵 Using OPUS encoding (或 📊 Using PCM fallback)
🎤 Started listening in auto mode
✅ Voice listening started successfully
```

**如果看到错误**:
- `⚠️ WebCodecs API not supported` - 浏览器不支持 WebCodecs,将使用 PCM
- `Failed to initialize audio recording` - 麦克风权限问题或音频设备问题
- `未连接` - WebSocket 未连接,先连接

### 步骤 3: 检查音频数据流

说话后,应该看到以下日志循环出现:

**OPUS 模式 (Chrome/Edge)**:
```
🎵 Encoded OPUS frame: 960 samples at 0.064s
🎼 OPUS encoded chunk: 128 bytes, timestamp: 64000
🔊 Audio callback triggered: 128 bytes
📤 Sent audio data: 128 bytes (total: 128 bytes)
```

**PCM 模式 (Safari/不支持 WebCodecs)**:
```
📊 Sending PCM data: 1920 bytes
🔊 Audio callback triggered: 1920 bytes
📤 Sent audio data: 1920 bytes (total: 1920 bytes)
```

### 步骤 4: 常见问题诊断

#### 问题 A: 看到 `⚠️ No data callback set, skipping audio data`

**原因**: 音频数据回调未正确设置

**检查**:
1. `startRecording` 是否被正确调用?
2. 回调函数是否正确传递?

#### 问题 B: 看到 `❌ Cannot send audio: not connected`

**原因**: WebSocket 连接已断开

**解决**:
1. 检查 WebSocket 连接状态
2. 查看是否有断开连接的日志
3. 尝试重新连接

#### 问题 C: 看到音频处理日志但没有发送日志

**原因**: 可能是 WebSocket 在音频处理和发送之间断开

**检查**:
1. 查看 `WebSocket ready state` 日志
2. 检查网络连接
3. 查看服务器日志

#### 问题 D: 什么日志都没有

**原因**: 麦克风权限未授予或音频设备问题

**解决**:
1. 检查浏览器地址栏,是否显示麦克风权限请求
2. 在浏览器设置中检查麦克风权限
3. 确认系统音频设备正常工作

## 验证音频发送成功

### 浏览器端验证

1. 打开 Network 标签
2. 筛选 WS (WebSocket)
3. 点击 WebSocket 连接
4. 切换到 Messages 或 Binary 标签
5. 应该看到不断发送的二进制数据帧

### 服务器端验证

在 Python 服务器中添加日志:

```python
async def handle_client(websocket, path):
    async for message in websocket:
        if isinstance(message, bytes):
            print(f"🎵 Received audio: {len(message)} bytes")
        elif isinstance(message, str):
            data = json.loads(message)
            print(f"📨 Message: {data['type']}")
```

## 数据流完整性检查

完整的数据流应该是:

```
用户说话
  ↓
麦克风采集 (每64ms)
  ↓
🎵 Encoded OPUS frame (或 📊 Sending PCM data)
  ↓
🎼 OPUS encoded chunk (仅 OPUS 模式)
  ↓
🔊 Audio callback triggered
  ↓
📤 Sent audio data
  ↓
服务器接收 (🎵 Received audio)
```

如果中间任何环节中断,请检查对应的日志和错误信息。

## 性能指标

**正常情况下**:
- 音频帧间隔: ~64ms
- OPUS 编码大小: 100-200 bytes/frame
- PCM 数据大小: ~2KB/frame
- 总发送速率: ~15-30 KB/s

如果发送速率显著偏离这个范围,可能存在问题。

## 总结

现在代码中已经添加了完整的调试日志。请:

1. 重新加载页面
2. 打开浏览器开发者工具的 Console
3. 按照上述步骤操作
4. 观察日志输出
5. 根据日志信息定位具体问题

如果仍有问题,请提供控制台的完整日志输出!
