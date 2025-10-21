# OPUS 解码失败修复 - Corrupted Stream

## 🐛 问题描述

服务器反馈接收到的音频流数据报错:
```
ERROR - ❌ [VAD处理器] OPUS解码失败: b'corrupted stream'
```

## 🔍 根本原因分析

### 问题根源

客户端发送的是 **OPUS 在容器中的数据** (OGG/WebM 容器格式),而服务器的 VAD 处理器期望接收 **纯 OPUS 帧**(无容器)。

### 数据格式对比

```
❌ 当前发送 (MediaRecorder 输出):
┌─────────────────────────────────────────┐
│ OGG/WebM 容器头 (Container Header)     │
├─────────────────────────────────────────┤
│ 元数据 (Metadata)                        │
├─────────────────────────────────────────┤
│ OPUS 帧 1                                │
├─────────────────────────────────────────┤
│ OPUS 帧 2                                │
├─────────────────────────────────────────┤
│ OPUS 帧 3                                │
└─────────────────────────────────────────┘
      ↓
服务器 OPUS 解码器尝试解码
      ↓
❌ 错误: "corrupted stream"
   (解码器无法识别容器头)

✅ 应该发送 (Raw OPUS frames):
┌─────────────────────────────────────────┐
│ OPUS 帧 (Raw frame, 无容器头)           │
└─────────────────────────────────────────┘
      ↓
服务器 OPUS 解码器解码
      ↓
✅ 成功解码
```

### 技术细节

1. **MediaRecorder API**
   - MIME类型: `audio/ogg;codecs=opus` 或 `audio/webm;codecs=opus`
   - 输出: 完整的容器格式 (包含容器头、元数据、OPUS帧)
   - 用途: 适合保存音频文件,不适合实时流传输给 OPUS 解码器

2. **WebCodecs AudioEncoder API**
   - 编码器配置: `codec: 'opus', opus: { format: 'opus' }`
   - 输出: 纯 OPUS 帧 (无容器,直接可解码)
   - 用途: 适合实时音频流传输

3. **服务器期望**
   - VAD 处理器期望接收原始 OPUS 帧
   - 无法处理 OGG/WebM 容器格式
   - 当收到容器数据时,OPUS 解码器报错 "corrupted stream"

## ✅ 解决方案

修改 `audioRecording.ts`,使用 **WebCodecs AudioEncoder** 编码纯 OPUS 帧,而不是 MediaRecorder 的容器格式。

### 编码器优先级

```typescript
Priority 1: WebCodecs OPUS Encoder (推荐)
  - 输出: 纯 OPUS 帧 (raw frames)
  - 无容器头,直接可被服务器解码
  - 浏览器支持: Chrome 94+, Edge 94+, Opera 80+

Priority 2: MediaRecorder (降级)
  - 输出: OPUS 在 OGG/WebM 容器中
  - ⚠️ 服务器可能无法解码
  - 浏览器支持: Chrome, Firefox, Edge

Priority 3: PCM (最终降级)
  - 输出: 原始 PCM 数据
  - 需要服务器端重新编码
  - 浏览器支持: 所有现代浏览器
```

### 实现流程

```
麦克风输入
    ↓
MediaStream (PCM audio)
    ↓
ScriptProcessorNode (捕获 PCM)
    ↓
AudioBuffer → Float32Array
    ↓
WebCodecs AudioEncoder
    ↓
EncodedAudioChunk (Raw OPUS frame)
    ↓
ArrayBuffer
    ↓
WebSocket → 服务器
    ↓
✅ 服务器 OPUS 解码器成功解码
```

## 📋 修改的文件

### src/services/audioRecording.ts

#### 1. 添加 WebCodecs 支持

```typescript
import { OpusEncoder } from './opusEncoder'

export class AudioRecordingService {
  private opusEncoder: OpusEncoder | null = null
  private useWebCodecs = false
  // ...
}
```

#### 2. 修改初始化逻辑

```typescript
async initialize(): Promise<void> {
  // Priority 1: 尝试 WebCodecs OPUS 编码器
  this.opusEncoder = new OpusEncoder()
  if (this.opusEncoder.isOpusSupported()) {
    console.log('✅ WebCodecs OPUS encoder available')
    this.useWebCodecs = true
  }

  // Priority 2: 降级到 MediaRecorder
  if (!this.useWebCodecs) {
    this.useMediaRecorder = this.checkOpusSupport()
  }

  // 总是设置 AudioContext (WebCodecs 需要 PCM 输入)
  this.audioContext = new AudioContext({ ... })
  this.scriptProcessor = this.audioContext.createScriptProcessor(...)

  // 处理音频回调
  this.scriptProcessor.onaudioprocess = (event) => {
    if (this.isRecording) {
      this.processAudioData(event.inputBuffer)
    }
  }
}
```

#### 3. 修改录音启动逻辑

```typescript
async startRecording(onData: (data: ArrayBuffer) => void): Promise<void> {
  // Priority 1: 使用 WebCodecs
  if (this.useWebCodecs && this.opusEncoder) {
    await this.opusEncoder.initialize((data: Uint8Array) => {
      console.log(`🎵 Raw OPUS frame: ${data.byteLength} bytes`)
      this.onDataCallback(data.buffer)
    })
    console.log('🎤 Recording with WebCodecs (Raw OPUS frames)')
    return
  }

  // Priority 2: 使用 MediaRecorder (降级)
  if (this.useMediaRecorder) {
    this.mediaRecorder = new MediaRecorder(...)
    console.warn('⚠️ Using MediaRecorder - server may have issues!')
    return
  }

  // Priority 3: PCM 降级
  console.log('🎤 Recording with PCM fallback')
}
```

#### 4. 修改音频处理逻辑

```typescript
private processAudioData(buffer: AudioBuffer): void {
  const channelData = buffer.getChannelData(0)

  // Priority 1: WebCodecs 编码
  if (this.useWebCodecs && this.opusEncoder) {
    const timestamp = performance.now()
    this.opusEncoder.encode(channelData, timestamp)
    // 编码后的数据会通过回调发送
    return
  }

  // Priority 2: 发送 PCM (降级)
  const pcmData = this.float32ToInt16(channelData)
  this.onDataCallback(pcmData.buffer)
}
```

## 🔍 验证方法

### 1. 检查客户端日志

启动录音后,应该看到以下日志:

```bash
# 初始化阶段
✅ WebCodecs OPUS encoder available - will use raw OPUS frames
✅ Audio recording initialized: WebCodecs (Raw OPUS frames)

# 录音阶段
🎤 Recording started with WebCodecs OPUS encoder (Raw OPUS frames)
🔄 Encoding PCM audio: 960 frames, 60000µs
✅ OPUS chunk encoded: { type: 'key', timestamp: 123456, byteLength: 50 }
🎵 Raw OPUS frame: 50 bytes
📤 Sent audio data: 50 bytes (total: 50 bytes)
```

### 2. 检查服务器端

服务器应该能成功解码,不再报 "corrupted stream" 错误:

```bash
# 之前 (错误)
ERROR - ❌ [VAD处理器] OPUS解码失败: b'corrupted stream'

# 修复后 (成功)
INFO - ✅ [VAD处理器] OPUS解码成功: 960 samples
INFO - ✅ [VAD处理器] 检测到语音活动
```

### 3. 编码器状态检查

```javascript
// 浏览器控制台运行
audioRecordingService.getEncoderStatus()

// 预期输出
{
  supported: true,
  state: 'recording',
  format: 'webcodecs-opus (raw frames)'  // ✅ 纯 OPUS 帧
}

// 错误输出 (如果还在用 MediaRecorder)
{
  supported: true,
  state: 'recording',
  format: 'mediarecorder-opus (container)'  // ❌ 容器格式
}
```

### 4. 数据大小验证

```javascript
// WebCodecs OPUS (正确)
🎵 Raw OPUS frame: 50-80 bytes  // 纯 OPUS 帧,小体积

// MediaRecorder (错误)
🎵 Opus/OGG chunk: 2000-4000 bytes  // 包含容器头,大体积
```

## 📊 浏览器兼容性

### WebCodecs 支持

| 浏览器 | 版本 | OPUS 编码 |
|--------|------|-----------|
| Chrome | 94+ | ✅ 支持 |
| Edge | 94+ | ✅ 支持 |
| Opera | 80+ | ✅ 支持 |
| Safari | 16.4+ | ✅ 支持 (实验性) |
| Firefox | ❌ | 不支持 |

### 降级策略

```
浏览器检测
    ↓
WebCodecs 可用?
    ├─ 是 → 使用 WebCodecs (Raw OPUS) ✅
    │
    └─ 否 → MediaRecorder 可用?
            ├─ 是 → 使用 MediaRecorder (Container) ⚠️
            │       (服务器可能报错)
            │
            └─ 否 → 使用 PCM 降级 📊
                    (需要服务器端重新编码)
```

## 🎯 关键改进

### 修复前

```typescript
// ❌ 使用 MediaRecorder 发送容器格式
this.mediaRecorder = new MediaRecorder(this.mediaStream, {
  mimeType: 'audio/ogg;codecs=opus',  // 容器格式
  audioBitsPerSecond: 16000
})

// 发送的数据包含容器头
event.data.arrayBuffer().then((buffer) => {
  // buffer 包含 OGG 容器头 + OPUS 帧
  websocket.send(buffer)  // ❌ 服务器无法解码
})
```

### 修复后

```typescript
// ✅ 使用 WebCodecs 编码纯 OPUS 帧
this.opusEncoder = new OpusEncoder()
await this.opusEncoder.initialize((data: Uint8Array) => {
  // data 是纯 OPUS 帧,无容器头
  websocket.send(data.buffer)  // ✅ 服务器可以直接解码
})

// 处理 PCM 音频
this.scriptProcessor.onaudioprocess = (event) => {
  const pcm = event.inputBuffer.getChannelData(0)
  this.opusEncoder.encode(pcm, timestamp)  // 编码为纯 OPUS
}
```

## 🔄 数据流对比

### 修复前 (MediaRecorder)

```
麦克风 → MediaRecorder
              ↓
    OPUS 编码 + OGG 容器封装
              ↓
    ArrayBuffer (包含容器头)
              ↓
    WebSocket → 服务器
              ↓
    ❌ OPUS 解码器: "corrupted stream"
```

### 修复后 (WebCodecs)

```
麦克风 → ScriptProcessor (PCM)
              ↓
    WebCodecs AudioEncoder
              ↓
    EncodedAudioChunk (纯 OPUS 帧)
              ↓
    ArrayBuffer (无容器头)
              ↓
    WebSocket → 服务器
              ↓
    ✅ OPUS 解码器: 成功解码
```

## 📝 配置说明

### OPUS 编码器配置

```typescript
// src/services/opusEncoder.ts
const config: AudioEncoderConfig = {
  codec: 'opus',
  sampleRate: 16000,          // 16kHz (语音质量)
  numberOfChannels: 1,        // 单声道
  bitrate: 16000,             // 16 kbps
  opus: {
    format: 'opus',           // ✅ 关键: 输出纯 OPUS,无容器
    frameDuration: 60000,     // 60ms 帧 (µs)
    complexity: 5,            // 0-10, 质量 vs 速度
    packetlossperc: 0,
    useinbandfec: true,       // 前向纠错
    usedtx: false             // 不使用 DTX
  }
}
```

### 音频参数

```typescript
// src/config/websocket.ts
export const audioRecordingConfig = {
  sampleRate: 16000,    // 16kHz (与服务器匹配)
  channels: 1,          // 单声道
  frameDuration: 60,    // 60ms 帧
  format: 'opus'        // OPUS 编码
}
```

## 🎉 总结

### 问题

- 客户端使用 MediaRecorder 发送 OPUS 在 OGG/WebM 容器中
- 服务器的 OPUS 解码器无法识别容器格式
- 报错: "corrupted stream"

### 解决方案

- 使用 WebCodecs AudioEncoder 编码纯 OPUS 帧
- 无容器头,直接可被服务器的 OPUS 解码器解码
- 保留 MediaRecorder 和 PCM 作为降级方案

### 关键改进

1. ✅ **优先使用 WebCodecs**: 输出纯 OPUS 帧
2. ✅ **保留降级方案**: MediaRecorder → PCM
3. ✅ **清晰的日志**: 标识使用的编码方式
4. ✅ **浏览器兼容**: 自动检测和降级

### 预期效果

- Chrome/Edge/Opera: 使用 WebCodecs (纯 OPUS) ✅
- Firefox: 使用 MediaRecorder (容器) ⚠️ 或 PCM 降级
- 所有浏览器: 至少有 PCM 降级方案 📊

### 验证成功标志

- 客户端日志显示: "WebCodecs (Raw OPUS frames)"
- 服务器不再报 "corrupted stream" 错误
- 编码器状态显示: "webcodecs-opus (raw frames)"
- 音频帧大小: 50-80 bytes (不是 2000-4000 bytes)

现在应该可以正常发送和解码音频流了! 🚀
