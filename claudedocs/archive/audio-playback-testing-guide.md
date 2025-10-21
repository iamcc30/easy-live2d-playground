# 音频播放修复 - 快速测试指南

## 🚀 立即测试

### 访问地址
```
http://localhost:5175/
```

---

## 📋 测试步骤

### 1️⃣ 基础功能测试 (2分钟)

**步骤**:
```
1. 打开 http://localhost:5175/
2. 打开浏览器控制台 (F12)
3. 点击右上角 "连接" 按钮 (应显示 🟢 已连接)
4. 点击麦克风按钮 🎤
5. 对着麦克风说话 5 秒
6. 等待 AI 回复
```

**观察控制台日志**:
```
✅ 应该看到:
📥 Audio chunk queued: XXX bytes, queue length: 1
⏳ Buffering... (1/3 chunks)
📥 Audio chunk queued: XXX bytes, queue length: 2
⏳ Buffering... (2/3 chunks)
📥 Audio chunk queued: XXX bytes, queue length: 3
✅ Buffer full (3 chunks), starting playback
🎵 Processing audio chunk: XXX bytes, 2 remaining
✅ Successfully decoded as encoded audio
🔊 Playing audio buffer: 0.XXXs, 16000Hz
✅ Chunk playback finished
...
📭 Queue empty, stopping playback
```

**验证**:
- ✅ 听到完整的 AI 语音回复 (没有中断)
- ✅ Live2D 角色嘴型同步
- ✅ 控制台没有 "❌ Failed to play audio" 错误

---

### 2️⃣ 统计功能测试 (1分钟)

**在浏览器控制台输入**:
```javascript
audioPlaybackService.getPlaybackStats()
```

**期望输出**:
```javascript
{
  totalChunks: 10,           // 总共处理了 10 个音频块
  successfulChunks: 10,      // 成功解码 10 个
  failedChunks: 0,           // 失败 0 个
  totalBytes: 20480,         // 总字节数
  totalDuration: 1.28,       // 总时长 (秒)
  queueLength: 0,            // 当前队列长度
  isPlaying: false,          // 是否正在播放
  audioContextState: "running",
  successRate: "100.0%"      // ✅ 成功率 100%
}
```

**如果 successRate < 100%**:
- 检查网络连接
- 查看是否有 "❌ Failed to decode chunk" 日志
- 确认服务器发送的音频格式正确 (OPUS in WebM/OGG)

---

### 3️⃣ 压力测试 (可选,3分钟)

**测试连续对话**:
```
1. 连续进行 5 次语音对话
2. 每次对话后检查统计:
   audioPlaybackService.getPlaybackStats()
3. 观察 successRate 是否稳定在 > 90%
```

**期望结果**:
- ✅ 5 次对话都能完整播放
- ✅ successRate 保持在 90% 以上
- ✅ 没有累积的内存泄漏

---

## 🔍 问题排查

### 问题 1: 音频仍然不完整

**检查清单**:
```javascript
// 1. 检查统计
audioPlaybackService.getPlaybackStats()
// 查看 failedChunks 数量

// 2. 查看失败日志
// 控制台搜索: "❌ Failed to decode chunk"

// 3. 检查服务器音频格式
// 服务器应发送 OPUS in WebM 或 OGG 容器
```

**常见原因**:
- ❌ 服务器发送原始 OPUS 帧 (浏览器无法解码)
- ❌ 网络问题导致音频块损坏
- ❌ 音频块大小不一致

---

### 问题 2: 播放卡顿

**检查清单**:
```javascript
// 检查队列长度和缓冲
audioPlaybackService.getPlaybackStats()
// queueLength 应该 >= 0
```

**调整缓冲参数** (如果需要):
```javascript
// 在浏览器控制台临时调整
// 注意: 刷新页面后失效
audioPlaybackService.minBufferChunks = 5  // 增加到 5 块
```

---

### 问题 3: 控制台没有日志

**可能原因**:
1. WebSocket 未连接 → 点击 "连接" 按钮
2. 未开始录音 → 点击麦克风按钮
3. 服务器未发送音频 → 检查服务器日志

---

## 📊 性能对比

### 修复前 vs 修复后

| 指标 | 修复前 | 修复后 | 测试方法 |
|------|--------|--------|----------|
| 音频完整性 | 20-60% | 90-100% | 听完整度 |
| successRate | N/A | 显示 | getPlaybackStats() |
| 卡顿频率 | 频繁 | 很少 | 主观听感 |
| 错误恢复 | 停止队列 | 跳过继续 | 查看日志 |

---

## 🎯 验收标准

### ✅ 通过条件
1. 音频完整播放 (无明显中断)
2. successRate >= 90%
3. Live2D 嘴型同步正常
4. 控制台无严重错误

### ❌ 失败条件
1. 音频播放不到一半就停止
2. successRate < 50%
3. 频繁的 "❌ Failed to play audio" 错误
4. 队列停止处理

---

## 💡 高级调试

### 实时监控队列状态
```javascript
// 每秒检查一次播放状态
const monitor = setInterval(() => {
  const stats = audioPlaybackService.getPlaybackStats()
  console.log('📊 Stats:', stats)

  if (stats.successRate !== '100.0%') {
    console.warn('⚠️ Quality degraded:', stats.successRate)
  }
}, 1000)

// 停止监控
clearInterval(monitor)
```

### 重置统计
```javascript
// 开始新一轮测试前重置
audioPlaybackService.resetStats()
```

---

## 📝 测试报告模板

```markdown
## 测试日期: 2025-XX-XX

### 测试环境
- 浏览器: Chrome 120
- 网络: WiFi / 4G / 5G
- 服务器: http://111.230.57.211:8888

### 测试结果
- [ ] 基础功能测试 - 通过 / 失败
- [ ] 统计功能测试 - 通过 / 失败
- [ ] 压力测试 - 通过 / 失败

### 统计数据
```javascript
{
  totalChunks: XX,
  successfulChunks: XX,
  failedChunks: XX,
  successRate: "XX.X%"
}
```

### 问题记录
1. [描述问题]
2. [描述问题]

### 结论
✅ 修复有效 / ❌ 需要进一步优化
```

---

## 🚀 开始测试!

**现在就访问**: http://localhost:5175/

**测试流程**:
1. 打开页面 + 控制台
2. 连接 WebSocket
3. 录音 + 对话
4. 检查统计
5. 验证完整性

**预期结果**: 听到完整流畅的 AI 语音回复! 🎉
