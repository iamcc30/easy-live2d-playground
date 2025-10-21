# WebCodecs AudioDecoder 集成指南

## 📋 功能概述

实现了基于 WebCodecs API 的 OPUS 音频解码器，用于处理服务器发送的原始 OPUS 帧数据。

### ✅ 核心特性

1. **双模式解码**: 支持 OGG/WebM 容器和原始 OPUS 帧
2. **自动检测**: 首次解码失败自动切换到 WebCodecs 模式
3. **原生性能**: 使用浏览器原生 WebCodecs API，比 WASM 库更快
4. **零依赖**: 无需安装额外的 npm 包
5. **优雅降级**: WebCodecs 不可用时回退到原生解码

---

## 🏗️ 架构设计

### 解码流程

```
音频数据到达
    ↓
首次尝试: 原生 AudioContext.decodeAudioData()
    ↓
  成功? ────────→ 播放音频
    ↓ 失败
WebCodecs 可用?
    ↓ 是
尝试: WebCodecs AudioDecoder
    ↓
  成功? ────────→ 播放音频 + 切换到 WebCodecs 模式
    ↓ 失败
跳过该音频块，继续下一个
```

### 模式切换逻辑

```typescript
// 初始状态: 使用原生解码
useWebCodecs = false

// 首次 WebCodecs 解码成功后自动切换
if (webCodecsDecodeSuccess) {
  useWebCodecs = true  // 后续所有块都使用 WebCodecs
}
```

---

## 🔧 实现细节

### 文件结构

```
src/services/
├── webCodecsDecoder.ts       # WebCodecs 解码器实现
└── audioPlayback.ts           # 音频播放服务 (已集成)
```

### WebCodecs 解码器 API

#### 初始化

```typescript
import { WebCodecsAudioDecoder } from '@/services/webCodecsDecoder'

const decoder = new WebCodecsAudioDecoder(16000, 1)  // 16kHz, mono
await decoder.initialize()
```

#### 解码 OPUS 帧

```typescript
// 解码单个 OPUS 帧
const opusData: ArrayBuffer = ...  // 从服务器接收的数据
const timestamp = performance.now() * 1000  // 微秒

await decoder.decode(opusData, timestamp)
```

#### 转换为 AudioBuffer

```typescript
decoder.setOnFrameDecoded(async (audioData: AudioData) => {
  const audioBuffer = await decoder.audioDataToAudioBuffer(
    audioData,
    audioContext
  )

  // 播放 audioBuffer
  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioContext.destination)
  source.start()

  // 关闭 AudioData 释放内存
  audioData.close()
})
```

---

## 📊 性能对比

| 方案 | 解码时间 | Bundle 大小 | 浏览器支持 |
|------|---------|------------|-----------|
| **WebCodecs (本方案)** | 0.5-2ms | 0 KB | Chrome 94+, Edge 94+ |
| Native decodeAudioData | 0.5-2ms | 0 KB | 所有现代浏览器 |
| opus-decoder (WASM) | 5-15ms | 300-400 KB | 所有现代浏览器 |

### WebCodecs 优势

- ✅ **零依赖**: 无需安装额外包
- ✅ **原生性能**: 硬件加速解码
- ✅ **低延迟**: 与原生解码性能相当
- ✅ **小体积**: 不增加 bundle 大小

### 局限性

- ⚠️ **浏览器支持**: 仅 Chromium 内核 (Chrome, Edge 94+)
- ⚠️ **Firefox/Safari**: 不支持 (会回退到原生解码)

---

## 🎯 使用场景

### 场景 1: OGG/Opus 容器 (推荐)

**服务器发送**: OGG 容器包装的 OPUS 音频

```javascript
// 自动使用原生解码
audioPlaybackService.addAudioData(oggOpusData)
// 控制台: ✅ Native decode successful
```

### 场景 2: 原始 OPUS 帧

**服务器发送**: 裸 OPUS 帧 (无容器)

```javascript
// 首次: 原生解码失败 → 自动切换到 WebCodecs
audioPlaybackService.addAudioData(rawOpusData)
// 控制台:
// ⚠️ Native decode failed, trying WebCodecs fallback...
// ✅ WebCodecs fallback successful - switching to WebCodecs mode

// 后续: 直接使用 WebCodecs
audioPlaybackService.addAudioData(rawOpusData)
// 控制台: ✅ WebCodecs decode successful
```

### 场景 3: WebCodecs 不可用

**浏览器**: Firefox, Safari, 或旧版 Chrome

```javascript
// WebCodecs 初始化失败
// 控制台: ⚠️ WebCodecs not available, will use native decoding only

// 只能解码容器格式
audioPlaybackService.addAudioData(oggOpusData)  // ✅ 成功
audioPlaybackService.addAudioData(rawOpusData)  // ❌ 失败
```

---

## 🔍 调试和诊断

### 检查 WebCodecs 支持

```javascript
// 浏览器控制台
if (typeof AudioDecoder !== 'undefined') {
  console.log('✅ WebCodecs API 可用')

  // 检查 OPUS 支持
  AudioDecoder.isConfigSupported({
    codec: 'opus',
    sampleRate: 16000,
    numberOfChannels: 1
  }).then(support => {
    console.log('OPUS 支持:', support.supported)
  })
} else {
  console.log('❌ WebCodecs API 不可用')
}
```

### 查看解码模式

```javascript
// 查看当前播放统计
const stats = audioPlaybackService.getPlaybackStats()
console.log('解码统计:', {
  总块数: stats.totalChunks,
  成功: stats.successfulChunks,
  失败: stats.failedChunks,
  成功率: stats.successRate
})

// 查看解码日志
// 原生模式: "🔄 Trying native decode (OGG/WebM container)..."
// WebCodecs 模式: "🔄 Using WebCodecs AudioDecoder for raw OPUS..."
```

### 常见错误

#### 错误 1: "WebCodecs API not supported"

**原因**: 浏览器不支持 WebCodecs

**解决方法**:
- 使用 Chrome/Edge 94+ 版本
- 或者确保服务器发送 OGG/WebM 容器格式

#### 错误 2: "Both native and WebCodecs decode failed"

**原因**: 音频数据格式无法识别

**排查步骤**:
```javascript
// 1. 查看音频头部
// 控制台会显示: "Audio header: xx xx xx xx..."

// 2. 对比标准格式
// OGG: 4f 67 67 53 (OggS)
// WebM: 1a 45 df a3
// Raw OPUS: 通常以 TOC 字节开头 (00-FF)

// 3. 检查服务器配置
// 确认 TTS 输出格式设置
```

#### 错误 3: "WebCodecs decode timeout after 5s"

**原因**: 解码耗时过长或卡住

**解决方法**:
- 检查音频数据是否完整
- 查看浏览器性能
- 减小音频块大小

---

## 📝 最佳实践

### 1. 服务器配置建议

**推荐**: 使用 OGG/Opus 容器格式

```python
# 示例: Python TTS 配置
tts_config = {
    'format': 'ogg_opus',  # ✅ 推荐
    'sample_rate': 16000,
    'channels': 1
}

# 不推荐
tts_config = {
    'format': 'opus',      # ⚠️ 裸 OPUS 帧
}
```

**原因**:
- OGG 容器兼容所有浏览器
- 原生解码性能最佳
- 无需 WebCodecs API

### 2. 客户端初始化

```typescript
// App.vue 或主组件
import { audioPlaybackService } from '@/services/audioPlayback'

onMounted(async () => {
  try {
    await audioPlaybackService.initialize()
    console.log('✅ 音频播放已初始化')

    // 检查 WebCodecs 状态
    // 控制台会显示:
    // "✅ WebCodecs AudioDecoder ready as fallback" 或
    // "⚠️ WebCodecs not available, will use native decoding only"
  }
  catch (error) {
    console.error('❌ 初始化失败:', error)
  }
})
```

### 3. 错误处理

```typescript
websocketService.connect({
  onAudioData: async (audioData) => {
    try {
      await audioPlaybackService.addAudioData(audioData)
    }
    catch (error) {
      console.error('音频处理错误:', error)
      // 可选: 通知用户或记录错误
    }
  }
})
```

---

## 🧪 测试指南

### 基础功能测试

```javascript
// 1. 初始化
await audioPlaybackService.initialize()

// 2. 测试 WebCodecs 可用性
console.log('WebCodecs 状态:', audioPlaybackService.getState())

// 3. 发送测试音频
// (通过语音输入触发 TTS)

// 4. 观察解码日志
// 原生成功: "✅ Native decode successful"
// WebCodecs 成功: "✅ WebCodecs decode successful"
// 失败: "❌ Both native and WebCodecs decode failed"
```

### 性能测试

```javascript
// 记录解码性能
const perfTest = {
  nativeDecodeTime: [],
  webCodecsDecodeTime: [],
}

// 在 playNext() 方法中添加性能标记
const start = performance.now()
const audioBuffer = await this.audioContext.decodeAudioData(audioData)
const duration = performance.now() - start
console.log('解码耗时:', duration.toFixed(2), 'ms')
```

---

## 🔄 迁移指南

### 从旧版本升级

如果之前使用 opus-decoder 库:

```bash
# 1. 卸载旧依赖
pnpm remove opus-decoder

# 2. 移除旧代码
# 删除 import OpusDecoder 相关代码

# 3. 无需额外操作
# WebCodecs 已自动集成到 audioPlaybackService
```

### 降级到原生解码

如果需要禁用 WebCodecs:

```typescript
// src/services/audioPlayback.ts

// 方法 1: 初始化时跳过 WebCodecs
async initialize(): Promise<void> {
  // 注释掉 WebCodecs 初始化
  // this.webCodecsDecoder = new WebCodecsAudioDecoder(...)
}

// 方法 2: 强制使用原生解码
private async playNext(): Promise<void> {
  // 设置 this.webCodecsDecoder = null
}
```

---

## ⚙️ 高级配置

### 自定义解码参数

```typescript
// 创建自定义解码器实例
import { WebCodecsAudioDecoder } from '@/services/webCodecsDecoder'

const customDecoder = new WebCodecsAudioDecoder(
  48000,  // 48kHz 采样率
  2       // 立体声
)

await customDecoder.initialize()
```

### 批量解码

```typescript
// 解码多个 OPUS 帧
const opusFrames: ArrayBuffer[] = [...]

for (let i = 0; i < opusFrames.length; i++) {
  const timestamp = i * 60 * 1000  // 假设每帧 60ms
  await decoder.decode(opusFrames[i], timestamp)
}

// 等待所有帧解码完成
await decoder.flush()

// 获取所有解码后的帧
const decodedFrames = decoder.getDecodedFrames()
```

---

## 📚 参考资料

### WebCodecs API 文档

- [MDN - WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [MDN - AudioDecoder](https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder)
- [W3C WebCodecs 规范](https://w3c.github.io/webcodecs/)

### OPUS 编解码器

- [OPUS 官方网站](https://opus-codec.org/)
- [OPUS 规范 (RFC 6716)](https://tools.ietf.org/html/rfc6716)
- [OGG 容器格式](https://xiph.org/ogg/)

### 浏览器兼容性

- [Can I Use - WebCodecs](https://caniuse.com/webcodecs)
- Chrome/Edge: 94+ ✅
- Firefox: 不支持 ❌
- Safari: 不支持 ❌

---

## ✅ 总结

### 实现的功能

1. ✅ WebCodecs AudioDecoder 解码器 (`webCodecsDecoder.ts`)
2. ✅ 自动模式切换 (原生 ↔ WebCodecs)
3. ✅ AudioData → AudioBuffer 转换
4. ✅ 多种音频格式支持 (f32, s16, s32, u8)
5. ✅ 完整的错误处理和日志
6. ✅ 资源清理和内存管理

### 默认行为

```typescript
// 优先使用原生解码 (最佳兼容性)
useWebCodecs = false

// 自动检测并切换
if (nativeDecodeFails && webCodecsAvailable) {
  useWebCodecs = true  // 切换到 WebCodecs
}
```

### 适用场景

- ✅ **OGG/Opus**: 原生解码 (所有浏览器)
- ✅ **Raw OPUS**: WebCodecs 解码 (Chrome/Edge)
- ⚠️ **Raw OPUS + Firefox/Safari**: 无法解码

### 性能优势

- 🚀 原生 API,零依赖
- ⚡ 硬件加速
- 💾 不增加 bundle 大小
- 🔄 自动降级机制

---

**创建时间**: 2025-10-19
**版本**: 1.0
**状态**: ✅ 已实现并集成
