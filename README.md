# Easy Live2D Playground

这是一个在线体验 easy-live2d 库的交互式演示平台。
你能够直接用这个 云IDE [StackBlitz](https://stackblitz.com/~/github.com/Panzer-Jack/easy-live2d-playground) 在你的浏览器上直接体验。

## 项目介绍

Easy Live2D Playground 是一个基于 Vue 3 和 TypeScript 构建的应用，用于展示和测试 easy-live2d 库的功能。通过该平台，用户可以直观地了解和体验 Live2D 模型在 Web 环境下的交互效果。

easy-live2d：[仓库地址](https://github.com/Panzer-Jack/easy-live2d)

## 特性

- 基于 Vue 3 + TypeScript + Vite 构建
- 集成 easy-live2d 库，简化 Live2D 模型的加载和控制
- 使用 PixiJS 作为渲染引擎
- 提供模型表情、动作等交互演示
- 支持鼠标跟踪等高级特性

## 技术栈

- Vue 3
- TypeScript
- Vite
- easy-live2d
- PixiJS

## 项目结构

```
public/
  ├── Core/             # Live2D Cubism 核心库（必需）
  │   └── live2dcubismcore.js  # Cubism SDK 核心文件
  └── Resources/        # Live2D 模型资源
      └── Hiyori/       # Hiyori 示例模型
src/
  ├── assets/           # 静态资源
  ├── components/       # Vue 组件
  ├── router/           # 路由配置
  ├── stores/           # Pinia 状态管理
  ├── views/            # 页面视图
  ├── App.vue           # 主应用组件
  └── main.ts           # 应用入口
```

## 开始使用

### 安装依赖

```bash
pnpm install
```

### 开发服务器

```bash
pnpm dev
```

### 构建项目

```bash
pnpm build
```

### 运行测试

```bash
pnpm test:unit
```

## 重要提示

### Cubism SDK 核心库引入

必须在 HTML 文件中引入 Live2D Cubism Core 库：

```html
<!-- 在 body 结束标签前引入 -->
<script src="/Core/live2dcubismcore.js"></script>
```

这一步是使用 Live2D 功能的必要条件，确保 easy-live2d 库能正常工作。

## 使用示例

以下是初始化 Live2D 模型的基本示例：

```typescript
import { Config, Live2DSprite, LogLevel } from 'easy-live2d'
import { Application, Ticker } from 'pixi.js'

// 设置全局配置
Config.MotionGroupIdle = 'Idle' // 设置默认的空闲动作组
Config.CubismLoggingLevel = LogLevel.LogLevel_Off // 设置日志级别

// 创建Live2D精灵并初始化
const live2DSprite = new Live2DSprite()
live2DSprite.init({
  modelPath: '/Resources/Hiyori/Hiyori.model3.json',
  ticker: Ticker.shared
})

// 监听点击事件
live2DSprite.onLive2D('hit', ({ hitAreaName, x, y }) => {
  console.log('hit', hitAreaName, x, y)
})

// 添加到PixiJS应用
const app = new Application()
app.init({
  view: canvasElement,
  backgroundAlpha: 0, // 透明背景
})
app.stage.addChild(live2DSprite)

// 设置表情
live2DSprite.setExpression({
  expressionId: 'normal',
})

// 释放资源
onUnmounted(() => {
  live2DSprite.destroy()
})
```

## 许可证

MPL-2.0

## 作者

Panzer_Jack - [个人网站](https://www.panzer-jack.cn)
