<script setup lang="ts">
import OpusTestComponent from '@/components/OpusTestComponent.vue'
</script>

<template>
  <div class="test-page">
    <div class="page-header">
      <h1>🧪 OPUS 编解码器测试页面</h1>
      <p class="page-description">
        此页面用于测试 WebCodecs OPUS 编码器和解码器的功能
      </p>
    </div>

    <OpusTestComponent />

    <div class="test-guide">
      <h2>📖 使用指南</h2>
      <div class="guide-steps">
        <div class="guide-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>初始化编解码器</h3>
            <p>点击"初始化编解码器"按钮,系统会检查浏览器是否支持 WebCodecs OPUS 编码/解码。</p>
            <ul>
              <li>✅ Chrome 94+ 完全支持</li>
              <li>✅ Edge 94+ 完全支持</li>
              <li>✅ Opera 80+ 完全支持</li>
              <li>⚠️ Firefox 暂不支持</li>
            </ul>
          </div>
        </div>

        <div class="guide-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>录音和编码</h3>
            <p>点击"开始录音"按钮,对着麦克风说话。音频会实时编码为 OPUS 格式。</p>
            <ul>
              <li>🎤 使用麦克风录制音频</li>
              <li>🔄 实时编码为 OPUS 帧 (16kHz, 单声道, 60ms帧)</li>
              <li>📦 每个 OPUS 帧约 50-80 bytes</li>
              <li>⏱️ 可以录制任意时长</li>
            </ul>
            <p>录音时会显示:</p>
            <ul>
              <li>编码帧数: 实时统计编码的 OPUS 帧数量</li>
              <li>数据大小: 总共编码了多少字节</li>
              <li>录音时长: 录音秒数</li>
            </ul>
          </div>
        </div>

        <div class="guide-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>保存数据 (可选)</h3>
            <p>点击"下载 OPUS 数据"按钮,将编码后的 OPUS 数据保存到本地文件。</p>
            <ul>
              <li>📥 下载纯 OPUS 帧数据 (无容器)</li>
              <li>💾 文件格式: .opus (原始帧,非 OGG 容器)</li>
              <li>🔍 可以用十六进制编辑器查看数据</li>
            </ul>
          </div>
        </div>

        <div class="guide-step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h3>解码和播放</h3>
            <p>点击"解码并播放"按钮,系统会解码 OPUS 数据并播放。</p>
            <ul>
              <li>🔊 使用 WebCodecs AudioDecoder 解码 OPUS 帧</li>
              <li>🎵 将解码后的 PCM 音频合并</li>
              <li>▶️ 通过 AudioContext 播放音频</li>
            </ul>
            <p>如果能正常听到录制的声音,说明编解码器工作正常!</p>
          </div>
        </div>
      </div>

      <div class="test-expectations">
        <h3>✅ 预期结果</h3>
        <ul>
          <li><strong>初始化成功</strong>: 看到"编解码器初始化完成"消息</li>
          <li><strong>录音成功</strong>: 日志中看到"收到 OPUS 帧"消息,帧数持续增加</li>
          <li><strong>编码正常</strong>: 每帧 50-80 bytes,约 60ms 时长</li>
          <li><strong>解码成功</strong>: 日志中看到"已解码 X/Y 帧"消息</li>
          <li><strong>播放正常</strong>: 能听到自己录制的声音,音质清晰</li>
        </ul>
      </div>

      <div class="test-troubleshooting">
        <h3>❌ 常见问题</h3>
        <div class="problem-item">
          <h4>浏览器不支持 WebCodecs</h4>
          <p><strong>症状</strong>: 初始化时提示"浏览器不支持 WebCodecs OPUS 编码"</p>
          <p><strong>解决</strong>: 使用 Chrome 94+、Edge 94+ 或 Opera 80+</p>
        </div>

        <div class="problem-item">
          <h4>没有 OPUS 帧生成</h4>
          <p><strong>症状</strong>: 录音时日志中没有"收到 OPUS 帧"消息</p>
          <p><strong>可能原因</strong>:</p>
          <ul>
            <li>麦克风权限未授予</li>
            <li>编码器初始化失败</li>
            <li>音频输入设备问题</li>
          </ul>
          <p><strong>解决</strong>: 检查浏览器控制台的错误消息,确认麦克风权限</p>
        </div>

        <div class="problem-item">
          <h4>解码失败</h4>
          <p><strong>症状</strong>: 播放时提示"解码帧 X 失败"</p>
          <p><strong>可能原因</strong>:</p>
          <ul>
            <li>OPUS 数据损坏</li>
            <li>编码参数不正确</li>
            <li>解码器配置不匹配</li>
          </ul>
          <p><strong>解决</strong>: 清理资源后重新初始化和录音</p>
        </div>

        <div class="problem-item">
          <h4>播放无声音</h4>
          <p><strong>症状</strong>: 解码成功但播放时听不到声音</p>
          <p><strong>可能原因</strong>:</p>
          <ul>
            <li>系统音量静音</li>
            <li>AudioContext 被浏览器暂停</li>
            <li>音频数据全为静音</li>
          </ul>
          <p><strong>解决</strong>: 检查系统音量,录音时确保对着麦克风说话</p>
        </div>
      </div>

      <div class="test-notes">
        <h3>📝 技术说明</h3>
        <ul>
          <li><strong>编码格式</strong>: OPUS, 16kHz, 单声道, 16kbps, 60ms帧</li>
          <li><strong>数据格式</strong>: 纯 OPUS 帧 (无 OGG/WebM 容器)</li>
          <li><strong>帧大小</strong>: 60ms @ 16kHz = 960 samples</li>
          <li><strong>编码大小</strong>: 约 50-80 bytes/帧 (取决于音频内容)</li>
          <li><strong>延迟</strong>: 约 60ms (单帧延迟)</li>
        </ul>

        <h4>为什么需要这个测试?</h4>
        <p>
          这个测试验证了完整的 OPUS 编解码流程,确保:
        </p>
        <ol>
          <li>WebCodecs AudioEncoder 能正确编码 PCM 音频为 OPUS 帧</li>
          <li>编码后的 OPUS 帧是纯帧 (无容器头),可以直接发送给服务器</li>
          <li>WebCodecs AudioDecoder 能正确解码 OPUS 帧为 PCM 音频</li>
          <li>解码后的音频可以正常播放,音质良好</li>
        </ol>

        <p>
          如果这个测试通过,说明客户端的 OPUS 编解码没有问题。
          如果服务器还是报错"corrupted stream",那么问题可能在于:
        </p>
        <ul>
          <li>网络传输过程中数据损坏</li>
          <li>服务器端的 OPUS 解码器配置不正确</li>
          <li>服务器端期望的数据格式与实际发送的不匹配</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.page-header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.page-header h1 {
  margin: 0 0 10px 0;
  font-size: 32px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.page-description {
  margin: 0;
  font-size: 16px;
  opacity: 0.9;
}

.test-guide {
  max-width: 1000px;
  margin: 30px auto;
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.test-guide h2 {
  margin: 0 0 20px 0;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 10px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.guide-step {
  display: flex;
  gap: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.step-number {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.step-content h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 18px;
}

.step-content p {
  margin: 0 0 10px 0;
  color: #666;
  line-height: 1.6;
}

.step-content ul {
  margin: 10px 0;
  padding-left: 20px;
  color: #666;
}

.step-content li {
  margin: 5px 0;
  line-height: 1.6;
}

.test-expectations {
  background: #e7f5ff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-expectations h3 {
  margin: 0 0 15px 0;
  color: #0066cc;
}

.test-expectations ul {
  margin: 0;
  padding-left: 20px;
}

.test-expectations li {
  margin: 8px 0;
  color: #333;
  line-height: 1.6;
}

.test-troubleshooting {
  background: #fff3cd;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-troubleshooting h3 {
  margin: 0 0 15px 0;
  color: #856404;
}

.problem-item {
  background: white;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.problem-item:last-child {
  margin-bottom: 0;
}

.problem-item h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
}

.problem-item p {
  margin: 5px 0;
  color: #666;
  line-height: 1.6;
}

.problem-item ul {
  margin: 5px 0;
  padding-left: 20px;
  color: #666;
}

.problem-item li {
  margin: 3px 0;
}

.test-notes {
  background: #d1ecf1;
  padding: 20px;
  border-radius: 8px;
}

.test-notes h3 {
  margin: 0 0 15px 0;
  color: #0c5460;
}

.test-notes h4 {
  margin: 15px 0 10px 0;
  color: #0c5460;
  font-size: 16px;
}

.test-notes p {
  margin: 10px 0;
  color: #333;
  line-height: 1.6;
}

.test-notes ul, .test-notes ol {
  margin: 10px 0;
  padding-left: 20px;
  color: #333;
}

.test-notes li {
  margin: 5px 0;
  line-height: 1.6;
}
</style>
