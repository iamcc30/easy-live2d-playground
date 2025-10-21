# Claude 开发文档索引

本目录包含了开发过程中 Claude 生成的当前活跃文档。历史诊断文档已归档至 `archive/` 目录。

## 📚 当前活跃文档 (8份)

### 🎵 音频播放系统

1. **dual-queue-audio-architecture.md** ⭐
   - 双队列异步解码架构完整实现
   - 编码队列 + 解码队列 + 后台解码管线
   - 核心架构文档

2. **smooth-audio-playback-optimization.md**
   - 平滑播放缓冲策略优化
   - 从 2块 → 5块 的第一次优化
   - 智能重新缓冲机制

3. **aggressive-buffering-strategy.md** ⭐
   - 激进缓冲策略 (所有阈值翻倍)
   - decodedMinChunks: 10, rebufferThreshold: 6
   - 最终缓冲配置

4. **sample-rate-auto-detection-fix.md**
   - 采样率自动检测修复
   - 解决 16kHz 配置 vs 48kHz 播放的问题
   - AudioContext 和 WebCodecs 配置优化

### 🔌 WebSocket 连接

5. **native-websocket-migration.md** ⭐
   - 从 Socket.IO 迁移到原生 WebSocket
   - 核心连接架构文档

6. **websocket-connection-fix.md**
   - WebSocket 连接问题修复
   - 认证和协议实现

### 🎙️ 核心功能

7. **listen-modes-feature.md**
   - 监听模式功能实现 (auto/manual/wake)
   - 用户交互模式设计

8. **auto-mode-voice-chat-guide.md**
   - 自动模式语音聊天使用指南
   - 用户操作说明

## 📁 归档文档 (42份)

所有历史诊断和已解决问题的文档已移至 `archive/` 目录,包括:

- **音频相关** (9份): 早期音频播放问题诊断
- **OPUS 编解码** (7份): 早期 OPUS 编解码问题
- **WebSocket** (15份): 早期 WebSocket 连接和协议问题
- **Socket.IO** (3份): Socket.IO 实现和迁移记录
- **其他** (8份): UI、测试、诊断工具等

查看归档文档: `claudedocs/archive/`

## 🎯 快速导航

### 理解音频播放系统
1. 先读: **dual-queue-audio-architecture.md**
2. 再读: **aggressive-buffering-strategy.md**
3. 了解: **sample-rate-auto-detection-fix.md**

### 理解 WebSocket 连接
1. 主要参考: **native-websocket-migration.md**
2. 问题排查: **websocket-connection-fix.md**

### 实现新功能
1. 监听模式: **listen-modes-feature.md**
2. 自动聊天: **auto-mode-voice-chat-guide.md**

## 📊 文档统计

- **当前活跃**: 8 份 (主目录)
- **已归档**: 42 份 (archive/ 目录)
- **总计**: 50 份

## 🔧 维护建议

1. **新增文档**: 重要文档添加到主目录,更新此 README
2. **定期清理**: 已解决问题的文档移至 archive/
3. **版本标记**: 重要文档添加创建日期
4. **保持精简**: 主目录只保留当前相关的核心文档

---

*最后更新: 2025-01 (清理归档)*
