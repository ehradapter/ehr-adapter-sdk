import { EHRAdapterError, ErrorContext } from '../types/errors';

/**
 * Custom error for authentication-related failures.
 *
 * Provides specific context for issues such as invalid credentials,
 * expired tokens, or failed token refresh attempts.
 */
export class AuthenticationError extends EHRAdapterError {
  constructor(
    message: string,
    vendor: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'AUTH_ERROR', vendor, tenantId, context, originalError);
    this.name = 'AuthenticationError';
  }
}
