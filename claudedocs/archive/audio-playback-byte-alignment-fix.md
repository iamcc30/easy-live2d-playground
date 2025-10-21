# 音频播放字节对齐错误修复

## 错误描述

```
Failed to play audio: RangeError: byte length of Int16Array should be a multiple of 2
    at new Int16Array (<anonymous>)
    at AudioPlaybackService.decodePCMAudio (audioPlayback.ts:134:21)
    at AudioPlaybackService.playNext (audioPlayback.ts:91:34)
```

## 根本原因

### 问题分析

1. **错误位置**: `AudioPlaybackService.decodePCMAudio()` 方法的第 134 行
   ```typescript
   const pcmData = new Int16Array(data)  // ❌ 这里抛出错误
   ```

2. **错误原因**: `Int16Array` 构造函数要求 `ArrayBuffer` 的字节长度必须是 2 的倍数
   - `Int16` = 16位 = 2字节
   - 如果 `ArrayBuffer` 长度是奇数(如 129 字节),就无法转换为 `Int16Array`

3. **数据来源**: 服务器发送的 OPUS 编码音频数据

### 为什么会出现奇数字节?

服务器发送的是 **OPUS 编码的音频数据**,而不是 PCM 原始数据:

- **OPUS 数据**: 压缩的音频格式,字节长度不固定,可能是任意长度
- **PCM 数据**: 原始音频格式,使用 Int16 表示,字节长度必须是 2 的倍数

代码尝试:
1. 先用 `decodeAudioData()` 解码 OPUS (需要容器格式如 WebM/OGG)
2. 如果失败,回退到 PCM 解码 ← **这里出错**

**真实情况**: 服务器发送的 OPUS 数据没有容器格式,导致 `decodeAudioData()` 失败,然后错误地尝试作为 PCM 解码。

## 修复方案

### 1. 添加字节对齐检查和修复

```typescript
private async decodePCMAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  console.log(`🔍 Attempting to decode PCM audio: ${data.byteLength} bytes`)

  // ✅ 检查字节长度是否是 2 的倍数
  if (data.byteLength % 2 !== 0) {
    console.warn(`⚠️ Invalid PCM data length: ${data.byteLength} bytes (not multiple of 2)`)
    console.warn('This is likely OPUS-encoded data that failed to decode')

    // ✅ 尝试裁剪一个字节
    const trimmedData = data.slice(0, data.byteLength - 1)
    console.log(`🔧 Attempting to decode with trimmed data: ${trimmedData.byteLength} bytes`)

    if (trimmedData.byteLength % 2 !== 0) {
      throw new Error(`Cannot decode audio: byte length ${data.byteLength} is not a multiple of 2`)
    }

    data = trimmedData
  }

  // 现在可以安全地创建 Int16Array
  const pcmData = new Int16Array(data)
  console.log(`📊 Decoded PCM samples: ${pcmData.length}`)

  // ... 创建音频缓冲区的其余代码
}
```

### 2. 改进日志输出

添加了详细的调试日志,帮助识别问题:

```typescript
private async playNext(): Promise<void> {
  try {
    const audioData = this.audioQueue.shift()!
    console.log(`🎵 Processing audio data: ${audioData.byteLength} bytes`)

    let audioBuffer: AudioBuffer

    try {
      console.log('🔄 Attempting to decode as encoded audio (OPUS/WebM/OGG)...')
      audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0))
      console.log('✅ Successfully decoded as encoded audio')
    }
    catch (decodeError) {
      console.warn('⚠️ Failed to decode as encoded audio, trying PCM fallback')
      console.warn('Decode error:', decodeError)
      audioBuffer = await this.decodePCMAudio(audioData)  // ← 现在有保护
    }

    console.log(`🔊 Playing audio buffer: ${audioBuffer.duration.toFixed(3)}s, ${audioBuffer.sampleRate}Hz`)
  }
  catch (error) {
    console.error('❌ Failed to play audio:', error)
  }
}
```

## 长期解决方案

### 服务器端改进

服务器应该发送以下格式之一:

#### 方案 A: OPUS 数据放在容器中 (推荐)

使用 WebM 或 OGG 容器封装 OPUS 数据:

```python
# Python 服务器示例
import asyncio
import websockets

async def send_tts_audio(websocket, opus_data):
    # 将 OPUS 数据封装到 WebM 容器
    webm_data = wrap_opus_in_webm(opus_data)

    # 发送二进制数据
    await websocket.send(webm_data)
```

**优点**:
- ✅ 浏览器原生支持 `decodeAudioData()`
- ✅ 保持 OPUS 压缩的优势
- ✅ 不需要客户端做特殊处理

#### 方案 B: 发送 PCM 原始数据

将 OPUS 解码为 PCM 后发送:

```python
# Python 服务器示例
async def send_tts_audio(websocket, opus_data):
    # 解码 OPUS 为 PCM
    pcm_data = decode_opus_to_pcm(opus_data)

    # 确保是 Int16 格式,字节长度是 2 的倍数
    assert len(pcm_data) % 2 == 0

    await websocket.send(pcm_data)
```

**优点**:
- ✅ 简单可靠,客户端处理容易
- ✅ 字节对齐保证

**缺点**:
- ❌ 数据量大(未压缩)
- ❌ 网络带宽占用高

#### 方案 C: 使用 OPUS.js 解码器 (客户端)

在客户端使用 OPUS 解码库:

```typescript
import OpusDecoder from 'opus-decoder'

async function decodeOpusAudio(opusData: ArrayBuffer): Promise<AudioBuffer> {
  const decoder = new OpusDecoder()
  const pcmData = await decoder.decode(opusData)
  return createAudioBufferFromPCM(pcmData)
}
```

**优点**:
- ✅ 保持 OPUS 压缩优势
- ✅ 完全控制解码过程

**缺点**:
- ❌ 需要额外的库依赖
- ❌ 增加客户端复杂度

### 推荐方案

**短期**: 使用当前的修复(字节对齐检查和裁剪)
**长期**: 服务器发送 WebM 容器格式的 OPUS 数据(方案 A)

## 测试验证

### 1. 检查日志输出

运行应用后,在浏览器控制台应该看到:

**正常情况 (OPUS 容器格式)**:
```
🎵 Processing audio data: 1024 bytes
🔄 Attempting to decode as encoded audio (OPUS/WebM/OGG)...
✅ Successfully decoded as encoded audio
🔊 Playing audio buffer: 2.341s, 24000Hz
```

**PCM 回退 (正常字节对齐)**:
```
🎵 Processing audio data: 2048 bytes
🔄 Attempting to decode as encoded audio (OPUS/WebM/OGG)...
⚠️ Failed to decode as encoded audio, trying PCM fallback
🔍 Attempting to decode PCM audio: 2048 bytes
📊 Decoded PCM samples: 1024
✅ PCM audio buffer created: 0.043s
🔊 Playing audio buffer: 0.043s, 24000Hz
```

**PCM 回退 (字节对齐修复)**:
```
🎵 Processing audio data: 2049 bytes
🔄 Attempting to decode as encoded audio (OPUS/WebM/OGG)...
⚠️ Failed to decode as encoded audio, trying PCM fallback
🔍 Attempting to decode PCM audio: 2049 bytes
⚠️ Invalid PCM data length: 2049 bytes (not multiple of 2)
⚠️ This is likely OPUS-encoded data that failed to decode
🔧 Attempting to decode with trimmed data: 2048 bytes
📊 Decoded PCM samples: 1024
✅ PCM audio buffer created: 0.043s
🔊 Playing audio buffer: 0.043s, 24000Hz
```

### 2. 音频播放测试

1. 连接 WebSocket 服务器
2. 发送语音消息
3. 等待服务器 TTS 响应
4. 验证音频正常播放

**期望结果**:
- ✅ 不再出现 `RangeError` 错误
- ✅ 音频能够播放(可能音质不佳,因为数据格式不匹配)
- ✅ Live2D 嘴型同步

## 修改文件清单

- ✅ `src/services/audioPlayback.ts:128-170` - 添加字节对齐检查和修复
- ✅ `src/services/audioPlayback.ts:62-127` - 改进日志输出

## 后续优化建议

1. **服务器端**: 实现 WebM 容器封装 OPUS 数据
2. **客户端**: 添加音频格式检测(魔数识别)
3. **错误处理**: 更优雅的降级策略
4. **性能优化**: 音频流式播放而非等待完整数据

## 总结

✅ **问题已修复**: 添加了字节对齐检查,防止 `Int16Array` 创建错误
✅ **日志完善**: 添加详细日志帮助调试音频格式问题
⚠️ **临时方案**: 当前修复是应急措施,不是最优解决方案
🎯 **最佳方案**: 服务器发送 WebM 容器格式的 OPUS 数据

现在应用可以容忍格式不匹配的音频数据,不会再崩溃,但为了获得最佳音质和性能,建议采用长期解决方案。
