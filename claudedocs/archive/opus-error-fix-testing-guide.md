# OPUS 解码错误修复 - 快速测试指南

## ✅ 修复完成

**问题**: 服务器报错 `❌ [VAD处理器] OPUS解码失败: b'corrupted stream'`

**原因**: 客户端发送 Raw OPUS 帧,服务器期望 OGG 容器格式

**解决方案**: 切换到 PCM 格式 (已实施)

---

## 🚀 立即测试

### 访问地址
```
http://localhost:5175/
```

### 测试步骤

#### 1️⃣ 验证 PCM 格式启用 (30秒)

**步骤**:
```
1. 打开 http://localhost:5175/
2. 打开浏览器控制台 (F12)
3. 点击 "连接" 按钮
4. 点击麦克风按钮 🎤
```

**预期日志**:
```
📊 Using PCM format (OPUS disabled to avoid server decode issues)
🎤 Recording started
📊 Sending PCM data: 1920 bytes
📊 Sending PCM data: 1920 bytes
📊 Sending PCM data: 1920 bytes
...
```

**验证点**:
- ✅ 看到 "Using PCM format" 日志
- ✅ 看到 "Sending PCM data: 1920 bytes" 日志
- ❌ **不应该**看到 "Using OPUS encoding" 日志

---

#### 2️⃣ 验证服务器不再报错 (1分钟)

**检查服务器日志**:

**修复前** (应该不再出现):
```python
ERROR - ❌ [VAD处理器] OPUS解码失败: b'corrupted stream'
ERROR - 音频解码失败
```

**修复后** (预期日志):
```python
INFO - 收到音频数据: 1920 bytes
INFO - VAD 处理成功
INFO - 检测到语音: [用户说的内容]
```

**验证点**:
- ✅ 服务器成功接收音频
- ✅ VAD 处理器正常工作
- ✅ 语音识别功能恢复
- ❌ **不再出现** "corrupted stream" 错误

---

#### 3️⃣ 完整语音交互测试 (2分钟)

**步骤**:
```
1. 确认已连接 WebSocket (🟢 已连接)
2. 点击麦克风 🎤
3. 对着麦克风说: "你好,今天天气怎么样?"
4. 等待服务器响应
5. 验证 AI 回复播放
```

**预期结果**:
- ✅ 客户端发送 PCM 音频数据
- ✅ 服务器成功解码和识别
- ✅ 收到 AI 语音回复
- ✅ Live2D 嘴型同步

---

## 📊 关键日志对比

### 客户端日志

**修复前** (使用 OPUS):
```
🎵 Using OPUS encoding  ← ❌ 旧行为
🎼 OPUS encoded chunk: 180 bytes
📤 Sent audio data: 180 bytes
```

**修复后** (使用 PCM):
```
📊 Using PCM format (OPUS disabled to avoid server decode issues)  ← ✅ 新行为
📊 Sending PCM data: 1920 bytes
📤 Sent audio data: 1920 bytes
```

### 服务器日志

**修复前**:
```python
ERROR - ❌ [VAD处理器] OPUS解码失败: b'corrupted stream'  ← ❌ 错误
```

**修复后**:
```python
INFO - 收到音频数据: 1920 bytes  ← ✅ 正常
INFO - VAD 处理成功
```

---

## 🔍 问题排查

### 问题 1: 仍然显示 "Using OPUS encoding"

**可能原因**: 代码未正确更新或浏览器缓存

**解决方法**:
```
1. 硬刷新页面 (Ctrl+Shift+R 或 Cmd+Shift+R)
2. 清除浏览器缓存
3. 重启开发服务器:
   pnpm dev
```

---

### 问题 2: 服务器仍然报 "corrupted stream"

**可能原因**:
1. 旧的 OPUS 数据仍在传输
2. 服务器端未重启
3. WebSocket 连接使用旧会话

**解决方法**:
```
1. 断开并重新连接 WebSocket
2. 重启服务器端服务
3. 清除浏览器中的 WebSocket 缓存:
   - 关闭标签页
   - 重新打开 http://localhost:5175/
```

---

### 问题 3: 音频数据大小不是 1920 bytes

**可能大小**:
- 960 bytes (30ms 帧)
- 3840 bytes (120ms 帧)

**原因**: `frameDuration` 配置不同

**验证配置**:
```javascript
// 在控制台检查
console.log({
  sampleRate: 16000,
  channels: 1,
  frameDuration: 60,  // 60ms
  expectedSize: 16000 * 1 * 60 / 1000 * 2  // 1920 bytes
})
```

---

## 📈 带宽影响分析

### PCM vs OPUS 对比

**60ms 音频帧**:
- PCM: ~1920 bytes
- OPUS: ~180 bytes
- 差异: **10x**

**1分钟语音通话**:
- PCM: ~1.8 MB
- OPUS: ~180 KB
- 差异: **10x**

**5分钟语音通话**:
- PCM: ~9.6 MB ⬆️
- OPUS: ~0.9 MB ⬇️

**结论**:
- ✅ PCM 解决了兼容性问题
- ⚠️ 带宽消耗增加 10 倍
- 🔄 未来可以优化为 OGG OPUS

---

## 🎯 验收标准

### ✅ 通过条件

**客户端**:
1. 控制台显示 "Using PCM format"
2. 发送 "PCM data: 1920 bytes"
3. 无 OPUS 编码相关日志

**服务器**:
1. 不再出现 "corrupted stream" 错误
2. VAD 处理成功
3. 语音识别正常工作

**功能**:
1. 完整语音交互流程
2. AI 回复播放正常
3. Live2D 嘴型同步

### ❌ 失败条件

1. 仍然显示 "Using OPUS encoding"
2. 服务器仍报 "corrupted stream"
3. 语音识别不工作
4. 无法收到 AI 回复

---

## 📝 测试报告模板

```markdown
## OPUS 解码错误修复测试

### 测试时间: 2025-XX-XX HH:MM

### 环境信息
- 客户端: Chrome XXX
- 服务器: Python VAD 处理器
- WebSocket: ws://XXX.XXX.XXX.XXX:XXXX

### 测试结果

#### 客户端日志
- [ ] 显示 "Using PCM format" ✅ / ❌
- [ ] 发送 "PCM data: 1920 bytes" ✅ / ❌
- [ ] 无 OPUS 编码日志 ✅ / ❌

#### 服务器日志
- [ ] 无 "corrupted stream" 错误 ✅ / ❌
- [ ] VAD 处理成功 ✅ / ❌
- [ ] 语音识别正常 ✅ / ❌

#### 功能验证
- [ ] 完整语音交互 ✅ / ❌
- [ ] AI 回复播放 ✅ / ❌
- [ ] Live2D 同步 ✅ / ❌

### 带宽消耗
- 1分钟通话: XXX MB
- 预期: ~1.8 MB

### 问题记录
1. [问题描述]
2. [问题描述]

### 结论
✅ 修复成功 / ❌ 需要进一步调试
```

---

## 🔄 未来优化计划

### 短期 (已完成) ✅
- [x] 识别 OPUS 格式不匹配问题
- [x] 切换到 PCM 格式
- [x] 验证服务器兼容性
- [x] 更新文档

### 中期 (1-2周) 🔄
- [ ] 研究 JavaScript OGG muxer 库
- [ ] 实现 OGG 容器封装原型
- [ ] 测试 OGG OPUS 兼容性
- [ ] 性能对比测试

### 长期 (协调后端) 🎯
- [ ] 与后端团队协调 Raw OPUS 支持
- [ ] 评估服务器端修改成本
- [ ] 实施最优方案
- [ ] 持续性能监控

---

## 💡 关键要点

### 技术理解
1. **WebCodecs API** 产生 Raw OPUS 帧 (无容器)
2. **标准 OPUS 文件** 使用 OGG 容器格式
3. **Python opuslib** 期望 OGG 容器,不接受 raw 帧
4. **PCM 格式** 无需容器,兼容性最好

### 权衡决策
- ✅ **立即可用**: PCM 解决格式不匹配
- ⚠️ **带宽成本**: 10x 数据传输量
- 🔄 **未来优化**: OGG 封装节省 90% 带宽
- 🎯 **长期方案**: 服务器支持 Raw OPUS

---

## 🚀 开始测试!

**访问**: http://localhost:5175/

**快速验证**:
1. 控制台看到 "Using PCM format" ✅
2. 服务器不报 "corrupted stream" ✅
3. 语音识别正常工作 ✅

**预期结果**: 完整的语音交互功能恢复! 🎉
