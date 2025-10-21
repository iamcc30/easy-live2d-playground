# 🔧 音频缓冲队列配置指南

## 📋 功能概述

实现了智能音频缓冲策略,在开始播放前积累一定数量的音频数据,避免播放中断和卡顿。

### ✅ 核心改进

1. **双重缓冲阈值**: 同时支持块数和字节数阈值
2. **防溢出保护**: 自动丢弃最旧的块防止内存溢出
3. **智能缓冲**: 缓冲超时机制避免无限等待
4. **重缓冲检测**: 播放中检测队列低水位
5. **实时监控**: 完整的缓冲状态监控工具

---

## ⚙️ 缓冲参数说明

### 默认配置

```typescript
bufferConfig = {
  minChunks: 3,           // 最小块数: 缓冲至少 3 块才开始播放
  minBytes: 1024,         // 最小字节: 缓冲至少 1 KB 才开始播放
  maxChunks: 10,          // 最大块数: 队列最多 10 块,防止内存溢出
  timeoutMs: 500,         // 缓冲超时: 500ms 后即使未满也开始播放
  rebufferThreshold: 1    // 重缓冲阈值: 队列 ≤ 1 块时提示低水位
}
```

### 参数详解

#### `minChunks` (最小块数)

**作用**: 开始播放前需要缓冲的最小音频块数

**推荐值**:
- **低延迟** (实时对话): `2`
- **平衡** (默认): `3`
- **高缓冲** (不稳定网络): `5-8`

**影响**:
- ⬆️ 增加 → 更流畅,但延迟更高
- ⬇️ 减少 → 延迟更低,但可能卡顿

#### `minBytes` (最小字节数)

**作用**: 开始播放前需要缓冲的最小字节数

**推荐值**:
- **低延迟**: `512 bytes`
- **平衡**: `1024 bytes` (1 KB)
- **高缓冲**: `2048-4096 bytes` (2-4 KB)

**影响**:
- 与 `minChunks` 同时满足才开始播放
- 防止接收到很多小块但总量不足的情况

#### `maxChunks` (最大块数)

**作用**: 队列可容纳的最大音频块数

**推荐值**:
- **内存紧张**: `5-8`
- **平衡**: `10`
- **内存充足**: `15-20`

**影响**:
- 超过此值会自动丢弃最旧的块
- 防止内存溢出
- 不应小于 `minChunks + 2`

#### `timeoutMs` (缓冲超时)

**作用**: 缓冲超时时间,超时后即使未满也开始播放

**推荐值**:
- **低延迟**: `300ms`
- **平衡**: `500ms`
- **高缓冲**: `1000-1500ms`

**影响**:
- ⬆️ 增加 → 等待更久,缓冲更充分
- ⬇️ 减少 → 更快开始,但可能缓冲不足

#### `rebufferThreshold` (重缓冲阈值)

**作用**: 播放中队列低于此值时提示低水位

**推荐值**:
- **低延迟**: `1`
- **平衡**: `1-2`
- **高缓冲**: `2-3`

**影响**:
- 仅用于监控和日志,不影响播放
- 帮助诊断缓冲不足问题

---

## 🎯 使用场景配置

### 场景 1: 实时对话 (低延迟优先)

```javascript
audioPlaybackService.setBufferConfig({
  minChunks: 2,
  minBytes: 512,
  maxChunks: 5,
  timeoutMs: 300,
  rebufferThreshold: 1
})
```

**特点**:
- ✅ 延迟最低 (~300-500ms)
- ⚠️ 可能偶尔卡顿
- 📱 适合: 实时语音对话

### 场景 2: 平衡模式 (默认)

```javascript
audioPlaybackService.setBufferConfig({
  minChunks: 3,
  minBytes: 1024,
  maxChunks: 10,
  timeoutMs: 500,
  rebufferThreshold: 1
})
```

**特点**:
- ✅ 延迟适中 (~500-800ms)
- ✅ 播放流畅
- 📱 适合: 大多数场景

### 场景 3: 不稳定网络 (高缓冲)

```javascript
audioPlaybackService.setBufferConfig({
  minChunks: 5,
  minBytes: 2048,
  maxChunks: 15,
  timeoutMs: 1000,
  rebufferThreshold: 2
})
```

**特点**:
- ✅ 播放非常流畅
- ⚠️ 延迟较高 (~1-2s)
- 📱 适合: 弱网环境

### 场景 4: 极不稳定网络 (超高缓冲)

```javascript
audioPlaybackService.setBufferConfig({
  minChunks: 8,
  minBytes: 4096,
  maxChunks: 20,
  timeoutMs: 1500,
  rebufferThreshold: 3
})
```

**特点**:
- ✅ 最流畅
- ⚠️ 延迟最高 (~2-3s)
- 📱 适合: 极差网络,录播内容

---

## 📊 实时监控

### 启动监控

```javascript
// 1. 加载监控脚本
const script = document.createElement('script')
script.src = '/scripts/monitor-audio-buffer.js'
document.head.appendChild(script)

// 2. 启动实时监控
startBufferMonitor()
```

### 监控界面

```
📊 音频缓冲监控 - 实时状态
======================================================================

⚙️  缓冲配置:
   最小块数: 3 块
   最小字节: 1024 bytes
   最大块数: 10 块
   缓冲超时: 500 ms
   重缓冲阈值: 1 块

📈 当前状态:
   播放状态: ✅ 播放中
   缓冲状态: ✅ 就绪
   AudioContext: running

📦 队列状态:
   队列长度: 5 / 10 块 (50.0%)
   [██████████░░░░░░░░░░]
   队列字节: 2.34 KB

🎵 播放统计:
   总块数: 25
   成功解码: 25
   失败块数: 0
   成功率: 100%
   总字节: 12.45 KB
   总时长: 2.34 s

💊 缓冲健康度: 优秀 ✅
    播放流畅,缓冲充足

======================================================================
```

### 监控命令

```javascript
// 启动监控
startBufferMonitor()

// 停止监控
stopBufferMonitor()

// 调整缓冲参数
adjustBuffer({ minChunks: 5, minBytes: 2048 })

// 应用预设配置
applyPreset('lowLatency')      // 低延迟
applyPreset('balanced')        // 平衡 (默认)
applyPreset('highBuffer')      // 高缓冲
applyPreset('veryHighBuffer')  // 超高缓冲

// 查看预设配置
console.log(BUFFER_PRESETS)
```

---

## 🔍 缓冲日志详解

### 正常缓冲流程

```
📥 Audio chunk queued: 345 bytes, queue length: 1
⏳ Buffering... (1/3 chunks, 345/1024 bytes)

📥 Audio chunk queued: 378 bytes, queue length: 2
⏳ Buffering... (2/3 chunks, 723/1024 bytes)

📥 Audio chunk queued: 412 bytes, queue length: 3
✅ Buffer ready (3 chunks, 1135 bytes), starting playback

🔄 Decoding audio as OPUS/OGG container...
✅ Successfully decoded audio
🔊 Playing audio buffer: 0.123s, 16000Hz
```

### 超时触发

```
📥 Audio chunk queued: 345 bytes, queue length: 1
⏳ Buffering... (1/3 chunks, 345/1024 bytes)

(500ms 后仍未满足条件)

⏰ Buffer timeout (500ms), starting playback with 1 chunks
🔄 Decoding audio as OPUS/OGG container...
```

### 队列溢出

```
📥 Audio chunk queued: 345 bytes, queue length: 10
⚠️ Buffer overflow: queue has 10 chunks (max: 10), dropping oldest chunk
📥 Audio chunk queued: 378 bytes, queue length: 10
```

### 队列低水位

```
✅ Chunk playback finished
🔄 Queue low (1 chunks), continue buffering...
```

---

## 🎛️ 动态调整示例

### 根据网络状况调整

```javascript
// 检测网络状况
navigator.connection.addEventListener('change', () => {
  const effectiveType = navigator.connection.effectiveType

  switch(effectiveType) {
    case '4g':
      applyPreset('lowLatency')
      break
    case '3g':
      applyPreset('balanced')
      break
    case '2g':
    case 'slow-2g':
      applyPreset('highBuffer')
      break
  }
})
```

### 根据播放统计调整

```javascript
setInterval(() => {
  const stats = audioPlaybackService.getPlaybackStats()
  const successRate = parseFloat(stats.successRate)

  // 如果成功率低,增加缓冲
  if (successRate < 80 && stats.totalChunks > 10) {
    console.log('⚠️ 解码成功率低,切换到高缓冲模式')
    applyPreset('highBuffer')
  }
}, 10000) // 每 10 秒检查一次
```

### 根据队列状况调整

```javascript
setInterval(() => {
  const stats = audioPlaybackService.getPlaybackStats()

  // 如果频繁出现队列低水位,增加缓冲
  if (stats.isPlaying && stats.queueLength <= 1) {
    console.log('⚠️ 队列频繁低水位,增加缓冲')
    adjustBuffer({ minChunks: stats.bufferConfig.minChunks + 1 })
  }
}, 5000) // 每 5 秒检查一次
```

---

## ⚠️ 注意事项

### 1. 延迟与流畅度的权衡

- **低缓冲**: 低延迟,但可能卡顿
- **高缓冲**: 流畅播放,但延迟增加

**建议**: 根据实际使用场景选择

### 2. 内存使用

每个音频块约 200-500 bytes (OPUS)

**内存占用估算**:
```
内存 = maxChunks × 平均块大小
10 块 × 350 bytes = 3.5 KB (可忽略)
20 块 × 350 bytes = 7 KB (可忽略)
```

**结论**: 内存占用极小,可放心设置较大的 `maxChunks`

### 3. 首次播放延迟

初次播放需要等待缓冲:

```
首次延迟 = min(
  块缓冲时间,  // 等待 minChunks 块到达
  timeoutMs    // 缓冲超时
)
```

**示例**:
- 低延迟配置: ~300ms
- 平衡配置: ~500ms
- 高缓冲配置: ~1000ms

### 4. AudioContext 暂停问题

如果 AudioContext 处于 `suspended` 状态,即使缓冲充足也无法播放:

```javascript
// 检查并恢复
const ctx = audioPlaybackService.audioContext
if (ctx && ctx.state === 'suspended') {
  await ctx.resume()
  console.log('✅ AudioContext 已恢复')
}
```

---

## 📈 性能优化建议

### 1. 根据服务器 TTS 速度调整

**快速 TTS** (响应快,但可能卡顿):
- 使用低缓冲配置
- minChunks: 2-3

**慢速 TTS** (响应慢,数据流稳定):
- 使用平衡或高缓冲配置
- minChunks: 3-5

### 2. 根据音频块大小调整

检查实际音频块大小:

```javascript
websocketService.connect({
  onAudioData: (data) => {
    console.log('音频块大小:', data.byteLength, 'bytes')
  }
})
```

**小块** (< 200 bytes):
- 增加 minChunks (5-8)
- 增加 minBytes (2048-4096)

**大块** (> 500 bytes):
- 可以减少 minChunks (2-3)
- minBytes 可以保持默认

### 3. 移动端优化

移动设备可能内存受限:

```javascript
// 检测移动设备
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

if (isMobile) {
  adjustBuffer({
    maxChunks: 8,  // 减少最大缓冲
    minChunks: 2   // 降低首次播放延迟
  })
}
```

---

## 🧪 测试建议

### 1. 基础功能测试

```javascript
// 1. 启动监控
startBufferMonitor()

// 2. 触发 TTS
// (发送语音输入或调用 TTS API)

// 3. 观察监控界面
// - 缓冲过程
// - 播放启动
// - 队列变化
```

### 2. 极限测试

```javascript
// 测试低缓冲
applyPreset('lowLatency')
// 发送 TTS,观察是否卡顿

// 测试高缓冲
applyPreset('veryHighBuffer')
// 发送 TTS,观察延迟和流畅度

// 测试队列溢出
adjustBuffer({ maxChunks: 3, minChunks: 2 })
// 快速发送大量音频,观察溢出处理
```

### 3. 性能对比

```javascript
// 记录不同配置下的性能
const configs = ['lowLatency', 'balanced', 'highBuffer']

for (const config of configs) {
  applyPreset(config)
  // 发送相同的 TTS
  // 记录:
  // - 首次播放延迟
  // - 是否出现卡顿
  // - 解码成功率
}
```

---

## 📝 FAQ

### Q1: 如何选择合适的配置?

**A**: 根据使用场景:
- 实时对话 → `lowLatency`
- 一般使用 → `balanced`
- 网络不稳定 → `highBuffer` 或 `veryHighBuffer`

### Q2: 调整参数后需要重启吗?

**A**: 不需要,实时生效。但已缓冲的数据会继续按旧配置播放。

### Q3: 如何知道当前配置是否合适?

**A**: 观察监控界面的"缓冲健康度":
- ✅ 优秀/良好 → 配置合适
- 🟡 警告 → 考虑增加缓冲
- 🔴 危险 → 需要调整或排查问题

### Q4: 内存会溢出吗?

**A**: 不会,有 `maxChunks` 保护,超过会自动丢弃旧块。

### Q5: 为什么有 minChunks 和 minBytes 两个阈值?

**A**: 同时满足才开始播放,防止:
- 很多小块但总量不足
- 很少大块但数量不足

---

## ✅ 总结

### 核心功能

1. ✅ **智能缓冲**: 双重阈值 + 超时机制
2. ✅ **防溢出**: 自动丢弃旧数据
3. ✅ **实时监控**: 完整的状态监控工具
4. ✅ **灵活配置**: 多种预设 + 自定义
5. ✅ **零延迟调整**: 运行时动态修改

### 默认配置

```javascript
{
  minChunks: 3,
  minBytes: 1024,
  maxChunks: 10,
  timeoutMs: 500,
  rebufferThreshold: 1
}
```

### 快速开始

```javascript
// 1. 加载监控脚本
const script = document.createElement('script')
script.src = '/scripts/monitor-audio-buffer.js'
document.head.appendChild(script)

// 2. 启动监控
startBufferMonitor()

// 3. (可选) 调整配置
applyPreset('balanced')  // 或其他预设

// 4. 开始使用
// (正常使用 TTS 功能即可)
```

---

**修改时间**: 2025-10-19
**版本**: 1.0
**状态**: ✅ 已实现
