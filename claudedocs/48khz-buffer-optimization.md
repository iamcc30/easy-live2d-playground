# 48kHz 音频播放优化

## 🎯 优化目标

优化缓冲配置以支持 48kHz 高采样率音频的流畅播放。

## 📊 问题分析

### 48kHz vs 16kHz 的差异

```
音频块大小对比 (60ms):
16kHz: 960 samples × 4 bytes = 3,840 bytes
48kHz: 2,880 samples × 4 bytes = 11,520 bytes

差异: 48kHz 是 16kHz 的 3 倍!
```

### 缓冲需求分析

```
原配置 (针对 16kHz 设计):
- decodedMinChunks: 10 块
- 总缓冲量: 10 × 3.84KB = 38.4KB
- 时长: 10 × 60ms = 600ms

48kHz 的实际缓冲:
- 10 块 × 11.52KB = 115KB
- 时长: 10 × 60ms = 600ms (相同)
- 但数据量大 3 倍,解码和传输压力大!
```

## ✅ 优化方案

### 1. 增加默认缓冲配置

针对 48kHz 优化默认配置:

```typescript
private bufferConfig = {
  // 编码队列
  encodedMinChunks: 15,       // 10 → 15 (+50%)
  encodedMaxChunks: 60,       // 50 → 60 (+20%)

  // 解码队列 (关键!)
  decodedMinChunks: 15,       // 10 → 15 (+50%)
  decodedMaxChunks: 40,       // 30 → 40 (+33%)

  // 缓冲策略
  minBytes: 12288,            // 8KB → 12KB (+50%)
  timeoutMs: 5000,            // 4s → 5s (+25%)
  rebufferThreshold: 8        // 6 → 8 (+33%)
}
```

### 2. 动态缓冲调整

根据 AudioContext 的实际采样率动态调整:

```typescript
async initialize(): Promise<void> {
  this.audioContext = new AudioContext()
  const sampleRate = this.audioContext.sampleRate

  if (sampleRate >= 48000) {
    // 48kHz: 使用默认的大缓冲配置
    console.log('📊 Using 48kHz-optimized buffer')
  } else if (sampleRate >= 24000) {
    // 24kHz: 中等缓冲
    this.bufferConfig.decodedMinChunks = 12
    this.bufferConfig.decodedMaxChunks = 35
    this.bufferConfig.rebufferThreshold = 7
  } else {
    // 16kHz: 较小缓冲
    this.bufferConfig.decodedMinChunks = 10
    this.bufferConfig.decodedMaxChunks = 30
    this.bufferConfig.rebufferThreshold = 6
  }
}
```

## 📊 优化效果对比

### 缓冲容量

| 配置 | 16kHz 优化 | 48kHz 优化 | 提升 |
|------|-----------|-----------|------|
| decodedMinChunks | 10 块 | 15 块 | +50% |
| 初始缓冲时长 | 600ms | 900ms | +50% |
| 初始缓冲数据量 | 38KB | 173KB | +350% |
| rebufferThreshold | 6 块 | 8 块 | +33% |
| 重缓冲触发时长 | 360ms | 480ms | +33% |

### 内存占用

```
48kHz 配置内存占用:

编码队列:
- 最大 60 块 × 1.5KB = 90KB

解码队列:
- 最大 40 块 × 11.5KB = 460KB

总计: ~550KB

评估: 完全可接受,换来流畅播放
```

### 性能指标

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 初始缓冲量 | 10块 (~115KB) | 15块 (~173KB) | +50% |
| 缓冲安全边界 | 6块 (~69KB) | 8块 (~92KB) | +33% |
| 最大缓冲池 | 30块 (~345KB) | 40块 (~460KB) | +33% |
| 卡顿概率 | 中 | 极低 | 显著改善 |

## 🎯 预期改进

### 播放流程

**优化前 (10块缓冲):**
```
数据到达 → 编码队列(10块)
              ↓
          解码队列(10块) → 开始播放
              ↓
          队列降至6块 → 暂停重缓冲 ⚠️ 可能卡顿
```

**优化后 (15块缓冲):**
```
数据到达 → 编码队列(15块)
              ↓
          解码队列(15块) → 开始播放 ✅ 更充足
              ↓
          队列降至8块 → 暂停重缓冲 ✅ 更早预警
              ↓
          队列恢复至15块 → 恢复播放 ✅ 更平滑
```

### 缓冲安全区间

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0    8       15                40 (块数)
│    │        │                 │
空   触发     开始播放          满缓冲
     重缓冲   (充足)            (上限)

安全播放区间: 8-40 块 (更大的缓冲余地)
```

## 🔍 诊断和监控

### 验证配置生效

```javascript
// 浏览器控制台运行
audioPlaybackService.getBufferConfig()

// 预期输出 (48kHz):
{
  encodedMinChunks: 15,
  encodedMaxChunks: 60,
  decodedMinChunks: 15,
  decodedMaxChunks: 40,
  minBytes: 12288,
  timeoutMs: 5000,
  rebufferThreshold: 8
}
```

### 监控队列状态

```javascript
// 实时监控
setInterval(() => {
  const stats = audioPlaybackService.getPlaybackStats()
  console.table({
    '编码队列': stats.encodedQueueLength,
    '解码队列': stats.decodedQueueLength,
    '是否播放': stats.isPlaying,
    '是否缓冲': stats.isBuffering,
    '解码成功率': stats.decodeSuccessRate
  })
}, 1000)

// 健康状态 (48kHz):
// 编码队列: 10-20 块
// 解码队列: 10-15 块 (保持在安全区间)
// 播放: true
// 缓冲: false
// 成功率: 100%
```

### 预期日志

**初始化:**
```
✅ AudioContext created with sample rate: 48000Hz
📊 Using 48kHz-optimized buffer configuration
🔧 Active buffer config: {
  decodedMinChunks: 15,
  decodedMaxChunks: 40,
  rebufferThreshold: 8
}
✅ WebCodecs AudioDecoder initialized
```

**播放过程:**
```
📥 Encoded chunk queued: 1024 bytes, encoded queue: 15, decoded queue: 0
🔄 Starting async decode pipeline...
⏳ Buffering... (decoded: 0/15)
...
📤 Decoded buffer added to queue: 0.060s, decoded queue: 15
✅ Decoded buffer ready (15 buffers), starting playback

🔊 Playing audio buffer, queue: 14
🔊 Playing audio buffer, queue: 13
...
🔊 Playing audio buffer, queue: 9  ← 安全区间
🔊 Playing audio buffer, queue: 8  ← 安全边界
🔊 Playing audio buffer, queue: 7  ← 低于阈值
⏸️ Pausing playback for re-buffering (7 < 8 buffers)
... 解码继续 ...
▶️ Resuming playback after re-buffering (15 buffers ready)
🔊 Playing audio buffer, queue: 14  ← 恢复流畅
```

## 📝 配置参数说明

### 采样率级别

| 采样率 | 应用场景 | 缓冲配置 |
|--------|---------|---------|
| 48kHz | 专业音频/TTS | decodedMinChunks: 15 |
| 24kHz | 高质量语音 | decodedMinChunks: 12 |
| 16kHz | 标准语音 | decodedMinChunks: 10 |

### 缓冲参数含义

```typescript
encodedMinChunks: 15
// 含义: 累积 15 块原始 OPUS 数据才启动解码管线
// 目的: 确保解码器有充足的原始数据

decodedMinChunks: 15
// 含义: 累积 15 块解码后的 PCM 数据才开始播放
// 目的: 保证播放启动时有充足缓冲
// 48kHz: 15块 × 60ms = 900ms 缓冲

decodedMaxChunks: 40
// 含义: 解码队列最多缓存 40 块
// 目的: 防止内存占用过高
// 48kHz: 40块 × 11.5KB ≈ 460KB

rebufferThreshold: 8
// 含义: 播放时队列降至 8 块以下触发重新缓冲
// 目的: 提前预警,避免播放中断
// 48kHz: 8块 × 60ms = 480ms 安全边界
```

## 🎉 总结

### 关键改进

1. ✅ **默认配置优化**: 针对 48kHz 优化默认缓冲参数
2. ✅ **动态调整**: 根据实际采样率自动调整缓冲
3. ✅ **更大缓冲**: decodedMinChunks 从 10 增加到 15 (+50%)
4. ✅ **更高阈值**: rebufferThreshold 从 6 增加到 8 (+33%)

### 预期效果

- 🎯 **初始缓冲**: 900ms (之前 600ms)
- 🎯 **安全边界**: 480ms (之前 360ms)
- 🎯 **最大缓冲**: 2400ms (之前 1800ms)
- 🎯 **播放流畅度**: 显著提升,几乎无卡顿

### 内存代价

- 内存增加: 175KB → 550KB (+375KB)
- 评估: 完全可接受,现代设备无压力

这个优化应该能够彻底解决 48kHz 音频播放不流畅的问题! 🚀
