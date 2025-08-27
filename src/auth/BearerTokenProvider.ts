/**
 * Bearer Token Authentication Provider
 *
 * Handles Bearer token authentication for EHR systems that use
 * pre-issued bearer tokens or JWT tokens.
 */

import { BaseAuthProvider } from './AuthProvider';
import { AuthToken, TenantContext, BearerTokenConfig } from '../types/auth';
import { AuthenticationError, ConfigurationError } from '../types/errors';
import { LoggerInterface } from '../logging/LoggerInterface';

export class BearerTokenProvider extends BaseAuthProvider {
  private config: BearerTokenConfig;
  private logger: LoggerInterface;

  public constructor(config: BearerTokenConfig, logger: LoggerInterface) {
    super({
      type: 'bearer',
      vendor: 'generic',
      supportsRefresh: false,
      supportsRevocation: false,
      scopes: [],
      endpoints: {},
    });

    this.config = config;
    this.logger = logger;
    this.validateConfig();
  }

  private validateConfig(): void {
    const errors: string[] = [];

    if (!this.config.token) {
      errors.push('Bearer token is required');
    }

    if (errors.length > 0) {
      throw new ConfigurationError(
        `Invalid Bearer token configuration: ${errors.join(', ')}`,
        'bearer',
        'config',
        this.config,
        'bearer_validation'
      );
    }
  }

  public async authenticate(tenantContext?: TenantContext): Promise<AuthToken> {
    try {
      // Parse JWT token if it looks like one to extract expiration
      let expiresAt: Date | undefined;
      let expiresIn: number | undefined;
      let metadata: Record<string, unknown> = {};

      if (this.isJWT(this.config.token)) {
        try {
          const payload = this.parseJWTPayload(this.config.token);
          if (payload) {
            metadata = { ...payload };

            if (typeof payload.exp === 'number') {
              expiresAt = new Date(payload.exp * 1000);
              expiresIn = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
            }
          }
        } catch (_error) {
          // If JWT parsing fails, treat as regular bearer token
          metadata = { parseError: 'Failed to parse JWT payload' };
        }
      }

      const token: AuthToken = {
        accessToken: this.config.token,
        tokenType: 'Bearer',
        ...(expiresIn !== undefined && { expiresIn }),
        ...(expiresAt && { expiresAt }),
        metadata: {
          prefix: this.config.prefix ?? 'Bearer',
          isJWT: this.isJWT(this.config.token),
          ...metadata,
        },
      };

      this.storeToken(token, tenantContext);
      return token;
    } catch (error) {
      throw new AuthenticationError(
        `Bearer token authentication failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'bearer',
        tenantContext?.tenantId,
        { operation: 'authenticate' },
        error instanceof Error ? error : undefined
      );
    }
  }

  public async refreshToken(tenantContext?: TenantContext): Promise<AuthToken> {
    // Bearer tokens typically can't be refreshed, just return the current token
    const currentToken = this.getCurrentToken(tenantContext);
    if (currentToken) {
      return currentToken;
    }

    // If no current token, authenticate again
    return this.authenticate(tenantContext);
  }

  public isTokenValid(tenantContext?: TenantContext): boolean {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      return false;
    }

    // Check if token matches the configured token
    if (token.accessToken !== this.config.token) {
      return false;
    }

    // Check expiration if available
    if (token.expiresAt) {
      return new Date() < token.expiresAt;
    }

    return true;
  }

  public getHeaders(tenantContext?: TenantContext): Record<string, string> {
    const token = this.getCurrentToken(tenantContext);
    if (!token) {
      throw new AuthenticationError(
        'No valid bearer token available',
        'bearer',
        tenantContext?.tenantId
      );
    }

    const prefix = this.config.prefix ?? 'Bearer';
    return {
      Authorization: `${prefix} ${token.accessToken}`,
    };
  }

  /**
   * Update the bearer token (useful for token rotation)
   */
  public updateToken(newToken: string, tenantContext?: TenantContext): void {
    this.config.token = newToken;

    // Re-authenticate with the new token
    this.authenticate(tenantContext).catch((_error: Error) => {
      const message = _error.message ?? 'Unknown error';
      // Log the error instead of throwing, as this is an async operation
      this.logger.error(
        `Failed to update bearer token: ${message}`,
        new AuthenticationError(
          `Failed to update bearer token: ${message}`,
          'bearer',
          tenantContext?.tenantId,
          { operation: 'update_token' },
          _error
        )
      );
    });
  }

  /**
   * Check if a token looks like a JWT
   */
  private isJWT(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Parse JWT payload (without verification)
   */
  private parseJWTPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      throw new Error('Invalid JWT format');
    }

    try {
      // Decode base64url
      const payload = parts[1];
      const decoded = this.base64UrlDecode(payload);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch (_error) {
      throw new Error('Failed to parse JWT payload');
    }
  }

  /**
   * Decode base64url string
   */
  private base64UrlDecode(str: string): string {
    // Add padding if needed
    str += '='.repeat((4 - (str.length % 4)) % 4);

    // Replace URL-safe characters
    str = str.replace(/-/g, '+').replace(/_/g, '/');

    // Decode base64
    try {
      // In Node.js environment
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf-8');
      }

      // In browser environment
      if (typeof atob !== 'undefined') {
        return atob(str);
      }

      throw new Error('No base64 decoder available');
    } catch (error) {
      throw new Error('Failed to decode base64url string');
    }
  }

  /**
   * Get token information without exposing the actual token
   */
  public getTokenInfo(tenantContext?: TenantContext): {
    hasToken: boolean;
    isJWT: boolean;
    expiresAt?: Date;
    isExpired: boolean;
    claims?: Record<string, unknown>;
  } {
    const token = this.getCurrentToken(tenantContext);

    if (!token) {
      return {
        hasToken: false,
        isJWT: false,
        isExpired: true,
      };
    }

    const isJWT = this.isJWT(token.accessToken);
    let claims: Record<string, unknown> | undefined;

    if (isJWT) {
      try {
        const payload = this.parseJWTPayload(token.accessToken);
        if (payload) {
          // Remove sensitive information
          const safeClaims = { ...payload };
          delete safeClaims.signature;
          claims = safeClaims;
        }
      } catch (_error) {
        // Ignore parsing errors
      }
    }

    const info: {
      hasToken: boolean;
      isJWT: boolean;
      expiresAt?: Date;
      isExpired: boolean;
      claims?: Record<string, unknown>;
    } = {
      hasToken: true,
      isJWT,
      isExpired: token.expiresAt ? new Date() >= token.expiresAt : false,
    };

    if (token.expiresAt) {
      info.expiresAt = token.expiresAt;
    }
    if (claims) {
      info.claims = claims;
    }

    return info;
  }

  /**
   * Validate JWT token structure and basic claims
   */
  public validateJWT(tenantContext?: TenantContext): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const token = this.getCurrentToken(tenantContext);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!token) {
      errors.push('No token available');
      return { isValid: false, errors, warnings };
    }

    if (!this.isJWT(token.accessToken)) {
      errors.push('Token is not a valid JWT');
      return { isValid: false, errors, warnings };
    }

    try {
      const payload = this.parseJWTPayload(token.accessToken) as Record<string, any>;
      if (payload) {
        // Check required claims
        if (!payload.iss) {
          warnings.push('Missing issuer (iss) claim');
        }

        if (!payload.sub) {
          warnings.push('Missing subject (sub) claim');
        }

        if (!payload.aud) {
          warnings.push('Missing audience (aud) claim');
        }

        if (!payload.exp) {
          warnings.push('Missing expiration (exp) claim');
        }

        if (!payload.iat) {
          warnings.push('Missing issued at (iat) claim');
        }

        // Check expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          errors.push('Token has expired');
        }

        // Check not before
        if (payload.nbf && payload.nbf * 1000 > Date.now()) {
          errors.push('Token is not yet valid (nbf claim)');
        }

        // Check issued at is not in the future
        if (payload.iat && payload.iat * 1000 > Date.now() + 60000) {
          // Allow 1 minute clock skew
          warnings.push('Token issued at time is in the future');
        }
      }
    } catch (error) {
      errors.push(
        `Failed to parse JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get bearer token configuration (without exposing the actual token)
   */
  public getConfig(): Omit<BearerTokenConfig, 'token'> & { hasToken: boolean } {
    const config: Omit<BearerTokenConfig, 'token'> & { hasToken: boolean } = {
      type: 'bearer',
      hasToken: !!this.config.token,
    };
    if (this.config.prefix) {
      config.prefix = this.config.prefix;
    }
    return config;
  }
}
