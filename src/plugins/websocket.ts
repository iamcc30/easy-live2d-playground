/**
 * WebSocket Plugin for Vue 3
 *
 * Inspired by vue-native-websocket-vue3 design
 * Provides global WebSocket instance and methods
 */

import type { App } from 'vue'
import { websocketService } from '@/services/websocket'
import type { WebsocketService } from '@/services/websocket'

export interface WebSocketPluginOptions {
  /**
   * Auto-connect on app mount
   */
  autoConnect?: boolean

  /**
   * Connection URL (overrides config)
   */
  url?: string

  /**
   * Access token (overrides config)
   */
  accessToken?: string

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * WebSocket plugin for Vue 3
 *
 * @example
 * ```ts
 * // In main.ts
 * import { createWebSocketPlugin } from '@/plugins/websocket'
 *
 * app.use(createWebSocketPlugin({
 *   autoConnect: false,
 *   debug: true
 * }))
 *
 * // In component
 * const { $socket, $connect, $disconnect } = getCurrentInstance()!.appContext.config.globalProperties
 * ```
 */
export function createWebSocketPlugin(options: WebSocketPluginOptions = {}) {
  return {
    install(app: App) {
      // Expose WebSocket service instance
      app.config.globalProperties.$socket = websocketService

      // Expose convenient methods
      app.config.globalProperties.$connect = async () => {
        if (options.debug) {
          console.log('[WebSocketPlugin] Connecting...')
        }
        await websocketService.connect()
      }

      app.config.globalProperties.$disconnect = () => {
        if (options.debug) {
          console.log('[WebSocketPlugin] Disconnecting...')
        }
        websocketService.disconnect()
      }

      // Auto-connect if enabled
      if (options.autoConnect) {
        if (options.debug) {
          console.log('[WebSocketPlugin] Auto-connecting...')
        }

        // Wait for app to be mounted before connecting
        app.mixin({
          mounted() {
            // Only connect once (use a flag)
            if (!(window as any).__ws_auto_connected__) {
              (window as any).__ws_auto_connected__ = true
              websocketService.connect().catch(err => {
                console.error('[WebSocketPlugin] Auto-connect failed:', err)
              })
            }
          }
        })
      }

      if (options.debug) {
        console.log('[WebSocketPlugin] ✅ Installed successfully')
      }
    }
  }
}

// Type augmentation for global properties
declare module 'vue' {
  interface ComponentCustomProperties {
    $socket: WebsocketService
    $connect: () => Promise<void>
    $disconnect: () => void
  }
}
