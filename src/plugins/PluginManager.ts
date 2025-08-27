import {
  AdapterPlugin,
  PluginConfig,
  PluginContext,
  RequestContext,
  ResponseContext,
  ErrorContext,
  ProcessingContext,
} from './types';
import { LoggerInterface } from '../../src/logging/LoggerInterface';
import { StructuredLogger } from '../../src/logging/StructuredLogger';

export type PluginHook =
  | 'onInitialize'
  | 'onBeforeRequest'
  | 'onAfterResponse'
  | 'onError'
  | 'onDestroy';

/**
 * Plugin Manager for handling plugin lifecycle and execution
 */
export class PluginManager {
  private plugins: Map<string, AdapterPlugin> = new Map();
  private hooks: Map<PluginHook, AdapterPlugin[]> = new Map();
  private logger: LoggerInterface;

  public constructor(logger: LoggerInterface) {
    this.logger = logger;
    this.initializeHooks();
  }

  /**
   * Initialize plugin hooks
   */
  private initializeHooks(): void {
    const hookTypes: PluginHook[] = [
      'onInitialize',
      'onBeforeRequest',
      'onAfterResponse',
      'onError',
      'onDestroy',
    ];

    hookTypes.forEach(hook => {
      this.hooks.set(hook, []);
    });
  }

  /**
   * Register a plugin
   */
  public async register(plugin: AdapterPlugin, config?: PluginConfig): Promise<void> {
    try {
      // Validate plugin
      this.validatePlugin(plugin);

      // Initialize plugin if needed
      if (plugin.onInitialize) {
        const context: PluginContext = {
          tenantId: 'default',
          vendor: plugin.vendor ?? 'unknown',
          logger: this.logger,
          ...(config && { config }),
        };
        await plugin.onInitialize(context);
      }

      // Configure plugin if needed
      if (plugin.configure && config) {
        await plugin.configure(config);
      }

      // Register plugin
      this.plugins.set(plugin.name, plugin);

      // Register lifecycle hooks
      const lifecycleHooks: PluginHook[] = [
        'onInitialize',
        'onBeforeRequest',
        'onAfterResponse',
        'onError',
        'onDestroy',
      ];
      lifecycleHooks.forEach(hook => {
        if (plugin[hook]) {
          const hookPlugins = this.hooks.get(hook) ?? [];
          hookPlugins.push(plugin);
          this.hooks.set(hook, hookPlugins);
        }
      });

      this.logger.info(`Plugin registered: ${plugin.name}`, {
        plugin: plugin.name,
        version: plugin.version,
        vendor: plugin.vendor,
      });
    } catch (error: unknown) {
      this.logger.error(`Failed to register plugin: ${plugin.name}`, {
        error: error instanceof Error ? error.message : String(error),
        plugin: plugin.name,
      });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  public async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    try {
      // Remove from hooks
      const lifecycleHooks: PluginHook[] = [
        'onInitialize',
        'onBeforeRequest',
        'onAfterResponse',
        'onError',
        'onDestroy',
      ];
      lifecycleHooks.forEach(hook => {
        const hookPlugins = this.hooks.get(hook) ?? [];
        const filtered = hookPlugins.filter(p => p.name !== pluginName);
        this.hooks.set(hook, filtered);
      });

      // Cleanup plugin
      if (plugin.onDestroy) {
        const context: PluginContext = {
          tenantId: 'default',
          vendor: plugin.vendor ?? 'unknown',
          logger: this.logger,
        };
        await plugin.onDestroy(context);
      }

      // Remove plugin
      this.plugins.delete(pluginName);

      this.logger.info(`Plugin unregistered: ${pluginName}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to unregister plugin: ${pluginName}`, {
        error: error instanceof Error ? error.message : String(error),
        plugin: pluginName,
      });
      throw error;
    }
  }

  /**
   * Execute plugins for a specific hook
   */
  public async executeHook(
    hook: PluginHook,
    context: PluginContext | RequestContext | ResponseContext | ErrorContext
  ): Promise<void> {
    const hookPlugins = this.hooks.get(hook) ?? [];

    for (const plugin of hookPlugins) {
      try {
        if (hook === 'onInitialize' && 'vendor' in context && !('operation' in context)) {
          if (plugin.onInitialize) {
            await plugin.onInitialize(context as PluginContext);
          }
        } else if (
          hook === 'onBeforeRequest' &&
          'requestId' in context &&
          !('statusCode' in context)
        ) {
          if (plugin.onBeforeRequest) {
            await plugin.onBeforeRequest(context as RequestContext);
          }
        } else if (hook === 'onAfterResponse' && 'statusCode' in context) {
          if (plugin.onAfterResponse) {
            await plugin.onAfterResponse(context as ResponseContext);
          }
        } else if (hook === 'onError' && 'error' in context) {
          if (plugin.onError) {
            await plugin.onError((context as ErrorContext).error, context as ErrorContext);
          }
        } else if (hook === 'onDestroy' && 'vendor' in context && !('operation' in context)) {
          if (plugin.onDestroy) {
            await plugin.onDestroy(context as PluginContext);
          }
        }
      } catch (error: unknown) {
        this.logger.error(`Plugin execution failed for hook: ${hook}`, {
          plugin: plugin.name,
          hook,
          error: error instanceof Error ? error.message : String(error),
        });
        // Do not rethrow errors from onError hooks to prevent loops
        if (hook !== 'onError') {
          throw error;
        }
      }
    }
  }

  /**
   * Get registered plugin
   */
  public getPlugin(name: string): AdapterPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  public getPlugins(): AdapterPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins for a specific hook
   */
  public getHookPlugins(hook: PluginHook): AdapterPlugin[] {
    return this.hooks.get(hook) ?? [];
  }

  /**
   * Get plugins by vendor
   */
  public getPluginsByVendor(vendor: string): AdapterPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.vendor === vendor);
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: AdapterPlugin): void {
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }

    if (!plugin.version) {
      throw new Error('Plugin must have a version');
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
  }

  /**
   * Get plugin statistics
   */
  public getStats(): {
    totalPlugins: number;
    pluginsByHook: Record<PluginHook, number>;
    plugins: Array<{ name: string; version: string; vendor?: string }>;
  } {
    const pluginsByHook = {} as Record<PluginHook, number>;

    this.hooks.forEach((plugins, hook) => {
      pluginsByHook[hook] = plugins.length;
    });

    const plugins = Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      ...(plugin.vendor && { vendor: plugin.vendor }),
    }));

    return {
      totalPlugins: this.plugins.size,
      pluginsByHook,
      plugins,
    };
  }
}
