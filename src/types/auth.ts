/**
 * Authentication Types for EHR Adapter SDK
 *
 * Defines authentication interfaces and types for various EHR vendors
 * with support for OAuth2, API keys, bearer tokens, and custom auth flows.
 */

// Base authentication token interface
export interface AuthToken {
  accessToken: string;
  tokenType: 'Bearer' | 'Basic' | 'API-Key' | 'Custom';
  expiresIn?: number; // seconds
  expiresAt?: Date;
  refreshToken?: string;
  scope?: string;
  metadata?: Record<string, any>;
}

// Authentication configuration types
export type AuthConfig =
  | OAuth2Config
  | ApiKeyConfig
  | BearerTokenConfig
  | BasicAuthConfig
  | CustomAuthConfig;

export interface OAuth2Config {
  type: 'oauth2';
  clientId: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  audience?: string;
  grantType?: 'authorization_code' | 'client_credentials' | 'password' | 'refresh_token';
  pkce?: boolean;
  state?: string;
  additionalParams?: Record<string, string>;
}

export interface ApiKeyConfig {
  type: 'apikey';
  apiKey: string;
  keyName?: string; // Header name or query parameter name
  location?: 'header' | 'query' | 'cookie';
  prefix?: string; // e.g., "Bearer ", "API-Key ", etc.
}

export interface BearerTokenConfig {
  type: 'bearer';
  token: string;
  prefix?: string; // Usually "Bearer"
}

export interface BasicAuthConfig {
  type: 'basic';
  username: string;
  password: string;
}

export interface CustomAuthConfig {
  type: 'custom';
  handler: CustomAuthHandler;
  config: Record<string, any>;
}

// Custom authentication handler interface
export interface CustomAuthHandler {
  authenticate(config: Record<string, any>, context?: TenantContext): Promise<AuthToken>;
  refreshToken?(
    token: AuthToken,
    config: Record<string, any>,
    context?: TenantContext
  ): Promise<AuthToken>;
  validateToken?(
    token: AuthToken,
    config: Record<string, any>,
    context?: TenantContext
  ): Promise<boolean>;
}

// Tenant context for multi-tenant authentication
export interface TenantContext {
  tenantId: string;
  userId?: string;
  scopes?: string[];
  metadata?: Record<string, any>;
  environment?: 'sandbox' | 'production' | 'staging';
}

// OAuth2 specific types
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // For OpenID Connect
  [key: string]: unknown; // Allow additional vendor-specific fields
}

export interface OAuth2AuthorizationRequest {
  response_type: 'code' | 'token';
  client_id: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string; // PKCE
  code_challenge_method?: 'S256' | 'plain';
  audience?: string;
  [key: string]: unknown;
}

export interface OAuth2TokenRequest {
  grant_type: 'authorization_code' | 'client_credentials' | 'password' | 'refresh_token';
  client_id: string;
  client_secret?: string;
  code?: string; // For authorization_code
  redirect_uri?: string; // For authorization_code
  username?: string; // For password grant
  password?: string; // For password grant
  refresh_token?: string; // For refresh_token grant
  scope?: string;
  code_verifier?: string; // PKCE
  audience?: string;
  [key: string]: unknown;
}

// Vendor-specific authentication configurations
export interface EpicAuthConfig extends OAuth2Config {
  type: 'oauth2';
  sandboxMode?: boolean;
  fhirVersion?: 'R4' | 'STU3' | 'DSTU2';
  patientContext?: string;
  encounterContext?: string;
  smartLaunch?: boolean;
  aud?: string; // FHIR server URL for SMART on FHIR
}

export interface AthenaAuthConfig extends ApiKeyConfig {
  type: 'apikey';
  practiceId: string;
  version?: string; // API version
  environment?: 'preview' | 'production';
}

export interface CernerAuthConfig extends OAuth2Config {
  type: 'oauth2';
  tenant?: string;
  environment?: 'sandbox' | 'production';
  fhirVersion?: 'R4' | 'STU3';
}

// Authentication provider interface
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

export interface AuthProviderMetadata {
  type: 'oauth2' | 'apikey' | 'bearer' | 'basic' | 'custom';
  vendor: string;
  supportsRefresh: boolean;
  supportsRevocation: boolean;
  tokenLifetime?: number; // seconds
  scopes?: string[];
  endpoints?: {
    authorization?: string;
    token?: string;
    refresh?: string;
    revocation?: string;
    userinfo?: string;
  };
}

// Token storage interface for multi-tenant scenarios
export interface TokenStorage {
  /**
   * Store a token for a specific tenant
   */
  storeToken(tenantId: string, token: AuthToken): Promise<void>;

  /**
   * Retrieve a token for a specific tenant
   */
  getToken(tenantId: string): Promise<AuthToken | null>;

  /**
   * Remove a token for a specific tenant
   */
  removeToken(tenantId: string): Promise<void>;

  /**
   * Check if a token exists for a specific tenant
   */
  hasToken(tenantId: string): Promise<boolean>;

  /**
   * Clear all tokens (for cleanup)
   */
  clearAllTokens(): Promise<void>;
}

// In-memory token storage implementation
export class MemoryTokenStorage implements TokenStorage {
  private tokens = new Map<string, AuthToken>();

  async storeToken(tenantId: string, token: AuthToken): Promise<void> {
    this.tokens.set(tenantId, token);
  }

  async getToken(tenantId: string): Promise<AuthToken | null> {
    return this.tokens.get(tenantId) || null;
  }

  async removeToken(tenantId: string): Promise<void> {
    this.tokens.delete(tenantId);
  }

  async hasToken(tenantId: string): Promise<boolean> {
    return this.tokens.has(tenantId);
  }

  async clearAllTokens(): Promise<void> {
    this.tokens.clear();
  }
}

// Authentication events for logging and monitoring
export interface AuthEvent {
  type: 'AUTHENTICATE' | 'REFRESH' | 'VALIDATE' | 'REVOKE' | 'ERROR';
  tenantId?: string;
  userId?: string;
  vendor: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// Authentication error types (specific to auth)
export interface AuthErrorDetails {
  code: string;
  description?: string;
  uri?: string; // Error URI for OAuth2
  state?: string; // OAuth2 state parameter
}

// SMART on FHIR specific types
export interface SMARTLaunchContext {
  iss: string; // FHIR server URL
  launch: string; // Launch context token
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  aud: string; // FHIR server URL
}

export interface SMARTTokenResponse extends OAuth2TokenResponse {
  patient?: string; // Patient ID in context
  encounter?: string; // Encounter ID in context
  location?: string; // Location ID in context
  resource?: string; // Resource ID in context
  intent?: string; // Launch intent
  smart_style_url?: string; // SMART styling URL
}

// JWT token payload interface
export interface JWTPayload {
  iss: string; // Issuer
  sub: string; // Subject
  aud: string | string[]; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf?: number; // Not before
  jti?: string; // JWT ID
  scope?: string; // Scopes
  client_id?: string; // Client ID
  tenant_id?: string; // Tenant ID
  user_id?: string; // User ID
  [key: string]: unknown; // Additional claims
}

// Rate limiting information for authentication
export interface AuthRateLimit {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Authentication configuration validation
export interface AuthConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Utility functions for authentication
export class AuthUtils {
  /**
   * Validate an authentication configuration
   */
  static validateAuthConfig(config: AuthConfig): AuthConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (config.type) {
      case 'oauth2':
        if (!config.clientId) {
          errors.push('OAuth2 client ID is required');
        }
        if (!config.clientSecret) {
          errors.push('OAuth2 client secret is required');
        }
        if (config.grantType === 'authorization_code' && !config.redirectUri) {
          errors.push('Redirect URI is required for authorization code flow');
        }
        break;

      case 'apikey':
        if (!config.apiKey) {
          errors.push('API key is required');
        }
        break;

      case 'bearer':
        if (!config.token) {
          errors.push('Bearer token is required');
        }
        break;

      case 'basic':
        if (!config.username) {
          errors.push('Username is required for basic auth');
        }
        if (!config.password) {
          errors.push('Password is required for basic auth');
        }
        break;

      case 'custom':
        if (!config.handler) {
          errors.push('Custom auth handler is required');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a token is expired
   */
  static isTokenExpired(token: AuthToken): boolean {
    if (!token.expiresAt) {
      return false;
    }
    return new Date() >= token.expiresAt;
  }

  /**
   * Calculate token expiration date
   */
  static calculateExpirationDate(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Generate a random state parameter for OAuth2
   */
  static generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  static generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // In a real implementation, you'd use crypto.createHash('sha256')
    // For now, we'll use a simple base64 encoding
    const codeChallenge = Buffer.from(codeVerifier)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Parse JWT token payload (without verification)
   */
  static parseJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || !parts[1]) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Format authorization header
   */
  static formatAuthHeader(token: AuthToken): string {
    const prefix = token.tokenType === 'Bearer' ? 'Bearer' : token.tokenType;
    return `${prefix} ${token.accessToken}`;
  }
}
