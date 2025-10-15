# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Easy Live2D Playground is a Vue 3 + TypeScript web application that demonstrates the easy-live2d library for interactive Live2D model rendering using PixiJS.

## Essential Commands

```bash
# Install dependencies (requires pnpm)
pnpm install

# Start development server
pnpm dev

# Build for production (includes type checking)
pnpm build

# Run unit tests
pnpm test:unit

# Preview production build
pnpm preview

# Type checking only
pnpm type-check
```

## Architecture & Key Patterns

### Live2D Integration Architecture

The application integrates Live2D models through a specific architecture:

1. **Cubism Core Loading**: The Live2D Cubism SDK core library must be loaded via script tag in `index.html:19` before any Live2D functionality
2. **PixiJS Application**: Creates the WebGL rendering context for Live2D models
3. **Live2DSprite**: Main class from easy-live2d that wraps Live2D functionality
4. **Model Configuration**: Models are configured via JSON files (e.g., `/Resources/Hiyori/Hiyori.model3.json`)

### Critical Implementation Pattern

All Live2D initialization must follow this sequence in `App.vue`:

```typescript
// 1. Configure easy-live2d settings
Config.MotionGroupIdle = 'Idle'

// 2. Create and initialize Live2DSprite
const live2DSprite = new Live2DSprite()
live2DSprite.init({
  modelPath: '/Resources/[ModelName]/[ModelName].model3.json',
  ticker: Ticker.shared
})

// 3. Initialize PixiJS application
const app = new Application()
await app.init({ view: canvasElement })

// 4. Add sprite to stage and configure
app.stage.addChild(live2DSprite)
```

### Resource Structure

Live2D models require specific directory structure in `public/Resources/`:
```
[ModelName]/
├── [ModelName].model3.json    # Model configuration
├── [ModelName].moc3          # Model geometry
├── motions/                   # Animation data
├── sounds/                    # Audio files
└── [ModelName].2048/         # Texture assets
```

## Development Environment

- **Package Manager**: pnpm (enforced via `preinstall` script)
- **Node Version**: ^18.0.0 || >=20.0.0
- **TypeScript**: Strict mode enabled with Vue-specific configuration
- **Auto-imports**: Vue APIs, VueUse, Pinia, and Vue Router automatically imported
- **Path Alias**: `@` maps to `./src`

## Testing Approach

- **Framework**: Vitest with Vue Test Utils
- **DOM Environment**: jsdom for component testing
- **Test Location**: `src/components/__tests__/`
- **Run Single Test**: `pnpm test:unit -- [test-file-name]`

## Code Style & Standards

- **ESLint**: Anthony Fu's configuration with TypeScript support
- **Console Logs**: Allowed for development (useful for Live2D debugging)
- **Component Registration**: Automatic via unplugin-vue-components
- **Styling**: UnoCSS with utility-first approach