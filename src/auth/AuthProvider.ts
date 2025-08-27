/**
 * Authentication Provider Interface
 *
 * Defines the contract for authentication providers that handle
 * different authentication mechanisms (OAuth2, API keys, etc.)
 */

import { AuthToken, TenantContext, AuthProviderMetadata } from '../types/auth';

/**
 * Base authentication provider interface
 */
export interface AuthProvider {
  /**
   * Authenticate and obtain an access token
   */
  authenticate(tenantContext?: TenantContext): Promise<AuthToken>;

  /**
   * Refresh an existing token
   */
  refreshToken(tenantContext?: TenantContext): Promise<AuthToken>;

  /**
   * Check if the current token is valid
   */
  isTokenValid(tenantContext?: TenantContext): boolean;

  /**
   * Get authentication headers for HTTP requests
   */
  getHeaders(tenantContext?: TenantContext): Record<string, string>;

  /**
   * Get the current token
   */
  getCurrentToken(tenantContext?: TenantContext): AuthToken | null;

  /**
   * Clear/revoke the current token
   */
  clearToken(tenantContext?: TenantContext): Promise<void>;

  /**
   * Get authentication metadata
   */
  getMetadata(): AuthProviderMetadata;
}

/**
 * Abstract base class for authentication providers
 */
export abstract class BaseAuthProvider implements AuthProvider {
  protected tokens = new Map<string, AuthToken>();
  protected metadata: AuthProviderMetadata;

  public constructor(metadata: AuthProviderMetadata) {
    this.metadata = metadata;
  }

  abstract authenticate(tenantContext?: TenantContext): Promise<AuthToken>;

  public async refreshToken(tenantContext?: TenantContext): Promise<AuthToken> {
    if (!this.metadata.supportsRefresh) {
      throw new Error(`${this.metadata.type} authentication does not support token refresh`);
    }

    // Default implementation - subclasses should override
    return this.authenticate(tenantContext);
  }

  public isTokenValid(tenantContext?: TenantContext): boolean {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {return false;}

    if (token.expiresAt) {
      return new Date() < token.expiresAt;
    }

    return true;
  }

  public getHeaders(tenantContext?: TenantContext): Record<string, string> {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const prefix = token.tokenType === 'Bearer' ? 'Bearer' : token.tokenType;
    return {
      Authorization: `${prefix} ${token.accessToken}`,
    };
  }

  public getCurrentToken(tenantContext?: TenantContext): AuthToken | null {
    const key = this.getTokenKey(tenantContext);
    return this.tokens.get(key) ?? null;
  }

  public async clearToken(tenantContext?: TenantContext): Promise<void> {
    const key = this.getTokenKey(tenantContext);
    this.tokens.delete(key);
  }

  public getMetadata(): AuthProviderMetadata {
    return this.metadata;
  }

  protected storeToken(token: AuthToken, tenantContext?: TenantContext): void {
    const key = this.getTokenKey(tenantContext);
    this.tokens.set(key, token);
  }

  protected getTokenKey(tenantContext?: TenantContext): string {
    return tenantContext?.tenantId ?? 'default';
  }

  protected calculateExpirationDate(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }
}
