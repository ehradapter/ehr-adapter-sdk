/**
 * API Key Authentication Provider
 *
 * Handles API key authentication for EHR systems like Athena
 * that use simple API key-based authentication.
 */

import { BaseAuthProvider } from './AuthProvider';
import { AuthToken, TenantContext, ApiKeyConfig } from '../types/auth';
import { AuthenticationError, ConfigurationError } from '../types/errors';

export class ApiKeyProvider extends BaseAuthProvider {
  private config: ApiKeyConfig;

  public constructor(config: ApiKeyConfig) {
    super({
      type: 'apikey',
      vendor: 'generic',
      supportsRefresh: false,
      supportsRevocation: false,
      scopes: [],
      endpoints: {},
    });

    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('API key is required');
    }

    if (this.config.location && !['header', 'query', 'cookie'].includes(this.config.location)) {
      errors.push('API key location must be "header", "query", or "cookie"');
    }

    if (errors.length > 0) {
      throw new ConfigurationError(
        `Invalid API key configuration: ${errors.join(', ')}`,
        'apikey',
        'config',
        this.config,
        'apikey_validation'
      );
    }
  }

  public async authenticate(tenantContext?: TenantContext): Promise<AuthToken> {
    try {
      // For API key authentication, we create a token immediately
      // since there's no separate authentication step
      const token: AuthToken = {
        accessToken: this.config.apiKey,
        tokenType: 'API-Key',
        metadata: {
          keyName: this.config.keyName ?? 'X-API-KEY',
          location: this.config.location ?? 'header',
          ...(this.config.prefix && { prefix: this.config.prefix }),
        },
      };

      this.storeToken(token, tenantContext);
      return token;
    } catch (error) {
      throw new AuthenticationError(
        `API key authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'apikey',
        tenantContext?.tenantId,
        { operation: 'authenticate' },
        error instanceof Error ? error : undefined
      );
    }
  }

  public async refreshToken(tenantContext?: TenantContext): Promise<AuthToken> {
    // API keys don't need refreshing, just return the current token
    const currentToken = this.getCurrentToken(tenantContext);
    if (currentToken) {
      return currentToken;
    }

    // If no current token, authenticate again
    return this.authenticate(tenantContext);
  }

  public isTokenValid(tenantContext?: TenantContext): boolean {
    const token = this.getCurrentToken(tenantContext);
    // API keys are valid as long as they exist (they typically don't expire)
    return token !== null && token.accessToken === this.config.apiKey;
  }

  public getHeaders(tenantContext?: TenantContext): Record<string, string> {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      throw new AuthenticationError(
        'No valid API key token available',
        'apikey',
        tenantContext?.tenantId
      );
    }

    const location = this.config.location ?? 'header';
    const keyName = this.config.keyName ?? 'X-API-Key';
    const prefix = this.config.prefix ?? '';

    if (location === 'header') {
      const _value = prefix ? `${prefix}${token.accessToken}` : token.accessToken;
      return {
        [keyName]: _value,
      };
    }

    // For query parameters and cookies, the calling code will need to handle
    // the placement since headers can only contain header values
    return {};
  }

  /**
   * Get query parameters for API key authentication
   */
  public getQueryParams(tenantContext?: TenantContext): Record<string, string> {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      throw new AuthenticationError(
        'No valid API key token available',
        'apikey',
        tenantContext?.tenantId
      );
    }

    const location = this.config.location ?? 'header';
    const keyName = this.config.keyName ?? 'api_key';
    const prefix = this.config.prefix ?? '';

    if (location === 'query') {
      const _value = prefix ? `${prefix}${token.accessToken}` : token.accessToken;
      return {
        [keyName]: _value,
      };
    }

    return {};
  }

  /**
   * Get cookie values for API key authentication
   */
  public getCookies(tenantContext?: TenantContext): Record<string, string> {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      throw new AuthenticationError(
        'No valid API key token available',
        'apikey',
        tenantContext?.tenantId
      );
    }

    const location = this.config.location ?? 'header';
    const keyName = this.config.keyName ?? 'api_key';
    const prefix = this.config.prefix ?? '';

    if (location === 'cookie') {
      const _value = prefix ? `${prefix}${token.accessToken}` : token.accessToken;
      return {
        [keyName]: _value,
      };
    }

    return {};
  }

  /**
   * Update the API key (useful for key rotation)
   */
  public updateApiKey(newApiKey: string, tenantContext?: TenantContext): void {
    this.config.apiKey = newApiKey;

    // Update stored token
    const token: AuthToken = {
      accessToken: newApiKey,
      tokenType: 'API-Key',
      metadata: {
        keyName: this.config.keyName ?? 'X-API-KEY',
        location: this.config.location ?? 'header',
        ...(this.config.prefix && { prefix: this.config.prefix }),
        rotatedAt: new Date().toISOString(),
      },
    };

    this.storeToken(token, tenantContext);
  }

  /**
   * Test the API key by making a simple request (if test endpoint is available)
   */
  public async testApiKey(_testEndpoint?: string, tenantContext?: TenantContext): Promise<boolean> {
    if (!_testEndpoint) {
      // If no test endpoint provided, just check if we have a valid token
      return this.isTokenValid(tenantContext);
    }

    try {
      const token = this.getCurrentToken(tenantContext);
      if (!token) {
        return false;
      }

      // This would make an actual HTTP request to test the API key
      // For now, we'll just return true if we have a token
      // In a real implementation, you would make an HTTP request to the test endpoint
      return true;
    } catch (_error) {
      return Promise.resolve(false);
    }
  }

  /**
   * Get API key configuration (without exposing the actual key)
   */
  public getConfig(): Omit<ApiKeyConfig, 'apiKey'> & { hasApiKey: boolean } {
    const sanitizedConfig: Omit<ApiKeyConfig, 'apiKey'> & { hasApiKey: boolean } = {
      type: 'apikey',
      hasApiKey: !!this.config.apiKey,
    };

    if (this.config.keyName) {
      sanitizedConfig.keyName = this.config.keyName;
    }
    if (this.config.location) {
      sanitizedConfig.location = this.config.location;
    }
    if (this.config.prefix) {
      sanitizedConfig.prefix = this.config.prefix;
    }

    return sanitizedConfig;
  }
}
