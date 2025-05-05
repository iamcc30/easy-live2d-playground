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
  import { Application, Ticker } from 'pixi.js';
  import { Live2DSprite, Config, Priority } from 'easy-live2d';

  // Configure basic settings
  Config.MotionGroupIdle = 'Idle'; // Set default idle motion group
  Config.MouseFollow = false; // Disable mouse following
  // Create Live2D sprite
  const live2dSprite = new Live2DSprite();
  live2dSprite.init({
    modelPath: '/Resources/Hiyori/Hiyori.model3.json',
    ticker: Ticker.shared
  });

  const init = async () => {
    // Create application
    const app = new Application();
    await app.init({
      view: document.getElementById('live2d'),
      backgroundAlpha: 0, // Set alpha to 0 for transparency if needed
    });
    // Live2D sprite size
    live2DSprite.width = canvasRef.value.clientWidth * window.devicePixelRatio
    live2DSprite.height = canvasRef.value.clientHeight * window.devicePixelRatio
    // Add to stage
    app.stage.addChild(live2dSprite);
    console.log('easy-live2d initialized successfully!');
  }
  init()
```

## 许可证

MPL-2.0

## 作者

Panzer_Jack - [个人网站](https://www.panzer-jack.cn)
