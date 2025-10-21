# 采样率自动检测修复

## 问题描述

用户报告日志显示:
```
🔊 Playing audio buffer at 16.232s, 48000Hz, queue: 2
```

但配置中设置的是 16000Hz,为什么播放时是 48000Hz?

## 根本原因

### 问题分析

1. **配置 vs 实际**: 我们在配置中设置 `sampleRate: 16000`,但这**不会强制重采样**
2. **OPUS 编码特性**: OPUS 音频可以在多种采样率下编码 (8k, 12k, 16k, 24k, 48kHz)
3. **解码器行为**: WebCodecs AudioDecoder 解码时**输出原始采样率**,不会转换
4. **服务器实际发送**: 服务器 TTS 系统实际以 **48000Hz** 采样率编码 OPUS 音频

### 关键认知

```
配置中的 sampleRate: 16000
    ↓
用于 AudioDecoder config (无效)
    ↓
解码器忽略,使用 OPUS 流中的实际采样率
    ↓
输出 48000Hz 音频 ✅ 这是正确的!
```

**WebCodecs AudioDecoder 的 `sampleRate` 配置参数仅用于验证,不会强制重采样!**

## 解决方案

### 方案选择

有三种方案:
1. ✅ **自动检测** (推荐) - 让解码器和 AudioContext 自动处理
2. ❌ **强制重采样** - 在 AudioContext 中转换 (不必要的性能开销)
3. ❌ **修改服务器** - 让服务器发送 16kHz 音频 (服务端改动)

选择方案 1: **自动检测**

### 实施改动

#### 1. WebCodecs Decoder 配置

**修改前:**
```typescript
const config: AudioDecoderConfig = {
  codec: 'opus',
  sampleRate: this.sampleRate,  // ❌ 无效配置
  numberOfChannels: this.numberOfChannels
}
```

**修改后:**
```typescript
const config: AudioDecoderConfig = {
  codec: 'opus',
  // sampleRate: removed - auto-detect from stream ✅
  numberOfChannels: this.numberOfChannels
}
```

#### 2. AudioContext 配置

**修改前:**
```typescript
this.audioContext = new AudioContext({
  sampleRate: audioPlaybackConfig.sampleRate  // ❌ 强制 16kHz
})
```

**修改后:**
```typescript
this.audioContext = new AudioContext()
// ✅ 使用硬件原生采样率,通常是 48kHz
// 可以处理任何采样率的音频
```

### 为什么这样更好?

#### 优势

1. **兼容性**: 自动适配任何采样率的音频流
   - 服务器改用 16kHz: ✅ 能播放
   - 服务器改用 24kHz: ✅ 能播放
   - 服务器改用 48kHz: ✅ 能播放

2. **性能**: 无需重采样
   - 避免不必要的 CPU 开销
   - 浏览器硬件加速播放

3. **质量**: 保持原始音质
   - 48kHz 音质比 16kHz 更好
   - 无重采样引入的失真

#### 工作原理

```
服务器 OPUS (48kHz)
    ↓
WebCodecs AudioDecoder
    ↓
AudioData (48kHz) ✅ 自动检测
    ↓
AudioBuffer (48kHz)
    ↓
AudioContext (48kHz native)
    ↓
播放 ✅ 完美匹配
```

## 测试验证

### 预期日志

```
✅ AudioContext created with sample rate: 48000Hz
✅ WebCodecs AudioDecoder initialized
   Codec: OPUS
   Sample Rate: Auto-detect from stream
   Channels: 1

🔄 Decoding OPUS chunk: 1024 bytes
✅ Frame decoded:
   format: f32-planar
   sampleRate: 48000  ← 自动检测到的采样率
   numberOfFrames: 2880
   numberOfChannels: 1
   duration: 60000 (60ms)

🔊 Playing audio buffer at 0.160s, 48000Hz, queue: 9
```

### 验证要点

1. ✅ AudioContext 报告采样率: 48000Hz (硬件原生)
2. ✅ 解码后的 AudioData 采样率: 48000Hz (从 OPUS 流检测)
3. ✅ 播放的 AudioBuffer 采样率: 48000Hz (自动匹配)
4. ✅ 音频播放流畅,无失真

## 常见问题

### Q: 为什么配置是 16kHz 但播放是 48kHz?

**A**: 因为配置中的 `sampleRate` 只是期望值,实际采样率由 OPUS 流决定。服务器实际发送的是 48kHz 音频。

### Q: 需要统一采样率吗?

**A**: 不需要!现代浏览器可以完美处理不同采样率:
- 录音: 16kHz (足够语音识别)
- 播放: 48kHz (更好的音质)
- AudioContext: 48kHz (硬件原生)

### Q: 48kHz 会浪费带宽吗?

**A**: OPUS 编码非常高效:
- 16kHz OPUS: ~20-24 Kbps
- 48kHz OPUS: ~32-40 Kbps
- 带宽差异: ~10-20 Kbps (可忽略)
- 音质提升: 明显

### Q: 为什么不在 AudioContext 中重采样到 16kHz?

**A**: 因为:
1. **性能开销**: 实时重采样消耗 CPU
2. **音质损失**: 下采样引入失真
3. **无必要**: 硬件原生 48kHz,无需转换

## 配置更新建议

### 保留配置中的 16000

虽然播放时不使用,但保留配置有其价值:

```typescript
export const audioPlaybackConfig = {
  sampleRate: 16000,  // 期望的采样率 (实际由服务器决定)
  channels: 1,
  frameDuration: 60
}
```

**原因:**
1. **文档价值**: 说明预期采样率
2. **录音配置**: 录音仍使用 16kHz
3. **向后兼容**: 如果服务器改为 16kHz,无需修改代码

### 添加注释

```typescript
export const audioPlaybackConfig = {
  sampleRate: 16000,  // Expected sample rate (actual rate auto-detected from stream)
  channels: 1,
  frameDuration: 60
}
```

## 性能影响

### 内存占用

```
16kHz 音频: 60ms × 16000Hz × 4bytes = 3840 bytes
48kHz 音频: 60ms × 48000Hz × 4bytes = 11520 bytes

差异: +7680 bytes/chunk (+200%)
```

对于 30 块缓冲:
```
16kHz: 3840 × 30 = 115 KB
48kHz: 11520 × 30 = 345 KB

差异: +230 KB
```

**评估**: 完全可接受,换来更好的音质

### CPU 占用

- **无重采样**: 0 CPU 开销 (硬件直接播放)
- **如果重采样**: 需要实时计算,增加 5-10% CPU 使用

## 总结

### 关键改进

| 项目 | 改进前 | 改进后 |
|------|--------|--------|
| Decoder config | `sampleRate: 16000` | `sampleRate: auto-detect` |
| AudioContext | `{sampleRate: 16000}` | `{}` (使用原生) |
| 实际播放采样率 | 48000Hz (被忽略的配置) | 48000Hz (正确检测) |
| 兼容性 | 仅 16kHz | 任意采样率 |
| 音质 | 被强制降低 | 保持原始 |

### 效果

✅ **自动检测**: 解码器从 OPUS 流自动检测采样率
✅ **灵活兼容**: 支持服务器发送任意采样率音频
✅ **性能优化**: 无不必要的重采样开销
✅ **音质保持**: 48kHz 音质优于 16kHz
✅ **向前兼容**: 服务器改变采样率无需客户端修改

这是一个更健壮、更灵活的解决方案! 🎉
