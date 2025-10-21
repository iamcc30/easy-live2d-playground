# OPUS MediaRecorder 修复 - 快速测试指南

## 🎯 核心修复内容

将音频编码方式从 **WebCodecs (Raw OPUS)** 改为 **MediaRecorder (OGG/Opus 容器)**，解决服务器解码失败问题。

---

## 🚀 立即测试

### 1. 启动开发服务器

```bash
pnpm dev
```

### 2. 打开浏览器

访问: `http://localhost:5175/`

**推荐浏览器**: Chrome, Edge, Firefox (最新版本)

### 3. 打开开发者工具

按 **F12** 或右键 → 检查

切换到 **Console** 标签页

### 4. 测试步骤

#### 步骤 1: 检查初始化

点击"连接"按钮，观察控制台输出：

**预期成功日志**:
```
✅ Audio recording initialized: MediaRecorder (Opus/OGG)
✅ Supported MIME type: audio/ogg;codecs=opus
```

**如果看到降级**:
```
⚠️ No Opus MIME types supported, falling back to PCM
✅ Audio recording initialized: AudioContext (PCM)
```
→ 说明浏览器不支持 Opus，会自动使用 PCM (功能正常但带宽高)

#### 步骤 2: 开始录音

点击"开始录音"或激活语音识别

**预期日志 (MediaRecorder 模式)**:
```
🎤 Recording started with MediaRecorder (Opus/OGG)
🎵 Opus/OGG chunk: 234 bytes
📤 Sent audio data: 234 bytes
🎵 Opus/OGG chunk: 256 bytes
📤 Sent audio data: 256 bytes
...
```

**预期日志 (PCM 降级模式)**:
```
🎤 Recording started with AudioContext (PCM)
📊 Sending PCM data: 1920 bytes
📤 Sent audio data: 1920 bytes
...
```

#### 步骤 3: 验证数据格式

在控制台运行以下代码来拦截并检查数据:

```javascript
// 临时存储原始 send 方法
const originalSend = WebSocket.prototype.send

// 覆盖 send 方法来检查数据
WebSocket.prototype.send = function(data) {
  if (data instanceof ArrayBuffer) {
    const view = new Uint8Array(data)
    const header = Array.from(view.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    console.log('📊 WebSocket 发送数据:')
    console.log('   大小:', data.byteLength, 'bytes')
    console.log('   前4字节:', header)

    if (header === '4f 67 67 53') {
      console.log('   ✅ 格式: OGG/Opus 容器 (正确!)')
    } else {
      console.log('   ℹ️ 格式: 其他 (可能是 PCM)')
    }
  }

  return originalSend.call(this, data)
}

console.log('✅ WebSocket 数据拦截器已激活')
```

**预期输出 (成功)**:
```
📊 WebSocket 发送数据:
   大小: 234 bytes
   前4字节: 4f 67 67 53
   ✅ 格式: OGG/Opus 容器 (正确!)
```

---

## 🔍 服务器端验证

### Python 服务器日志

**成功情况**:
```python
INFO - 收到音频数据: 234 bytes
INFO - 格式检测: Ogg data, Opus audio
INFO - Opus 解码成功: 960 samples
INFO - VAD 处理完成
INFO - 语音识别结果: "你好"
```

**不应再出现**:
```python
ERROR - ❌ [VAD处理器] OPUS解码失败: b'corrupted stream'
```

### 服务器端额外检查 (可选)

如果有服务器端代码访问权限，可以添加以下验证:

```python
import magic

def verify_audio_format(audio_data: bytes):
    # 检查是否是 OGG 格式
    file_type = magic.from_buffer(audio_data)
    print(f"接收到的音频格式: {file_type}")

    # 验证 OGG 头部
    if audio_data[:4] == b'OggS':
        print("✅ OGG 容器头部验证成功")
    else:
        print(f"⚠️ 非 OGG 格式，头部: {audio_data[:4].hex()}")

    return file_type
```

---

## 📊 性能对比

### 数据大小验证

**MediaRecorder (Opus/OGG)**:
- 每块约 **200-400 bytes** (60ms @ 24kbps)
- 每分钟约 **200-400 KB**

**PCM 降级模式**:
- 每块约 **1920 bytes** (60ms @ 16kHz)
- 每分钟约 **1.8 MB**

**验证方法**:
在控制台观察 `📤 Sent audio data` 日志的字节数

---

## ⚠️ 常见问题排查

### 问题 1: 仍然显示 "corrupted stream"

**可能原因**:
1. 浏览器降级到 PCM，但服务器仍期望 Opus
2. 服务器端 Opus 解码器配置问题

**检查步骤**:
```javascript
// 在浏览器控制台检查编码器状态
const status = audioRecordingService.getEncoderStatus()
console.log('编码器状态:', status)
// 预期: { supported: true, state: 'recording', format: 'opus/ogg' }
```

### 问题 2: MediaRecorder 不支持

**症状**: 控制台显示 "⚠️ No Opus MIME types supported"

**解决方案**:
1. 更新浏览器到最新版本
2. 尝试不同的浏览器 (Chrome > Firefox > Edge)
3. 使用 PCM 模式 (自动降级，功能正常)

### 问题 3: 数据块太小或太大

**正常范围**: 200-400 bytes (Opus) 或 1920 bytes (PCM)

**异常情况**:
- 太小 (<100 bytes): 可能采样率配置错误
- 太大 (>5000 bytes): 可能时间片设置过大

**调整方法**:
修改 `src/config/websocket.ts`:
```typescript
export const audioRecordingConfig = {
  frameDuration: 60,  // 修改这个值 (20-200ms)
  // ...
}
```

---

## ✅ 成功标志

如果看到以下所有标志，说明修复成功:

- [x] 控制台显示 "MediaRecorder (Opus/OGG)" 初始化
- [x] 数据块大小约 200-400 bytes
- [x] WebSocket 数据头部为 "4f 67 67 53"
- [x] 服务器不再报 "corrupted stream" 错误
- [x] 语音识别功能正常工作

---

## 🎊 下一步

如果测试通过:
1. ✅ 标记修复完成
2. 📝 通知服务器端团队格式变更
3. 📈 监控生产环境性能指标

如果测试失败:
1. 📋 收集详细日志
2. 🔍 检查浏览器兼容性
3. 📞 联系开发团队协助排查

---

## 📞 技术支持

**修改的文件**: `src/services/audioRecording.ts`

**核心变更**:
- 移除 WebCodecs/OpusEncoder 依赖
- 添加 MediaRecorder API 支持
- 实现自动降级机制

**文档**:
- 完整技术文档: `claudedocs/opus-mediarecorder-fix.md`
- 原始问题诊断: `claudedocs/opus-decode-error-diagnosis.md`

**测试完成后请反馈结果!** 🙏
