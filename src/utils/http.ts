import { LoggerInterface } from '../logging/LoggerInterface';

/**
 * HTTP Request Options
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  params?: Record<string, any>;
  retries?: number;
  retryDelay?: number;
  validateStatus?: (status: number) => boolean;
}

/**
 * HTTP Response
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestOptions;
}

/**
 * HTTP Error
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: HttpResponse,
    public config?: HttpRequestOptions
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * HTTP Client with retry logic and timeout support
 */
export class HttpClient {
  private logger: LoggerInterface;
  private defaultOptions: HttpRequestOptions;

  constructor(logger: LoggerInterface, defaultOptions: HttpRequestOptions = {}) {
    this.logger = logger;
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      validateStatus: status => status >= 200 && status < 300,
      ...defaultOptions,
    };
  }

  /**
   * Make HTTP request
   */
  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    this.logger.debug('HTTP request started', {
      url,
      method: config.method || 'GET',
      timeout: config.timeout,
      retries: config.retries,
    });

    let lastError: Error | null = null;
    const maxAttempts = (config.retries || 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const _response = await this.makeRequest<T>(url, config);
        const duration = Date.now() - startTime;

        this.logger.debug('HTTP request completed', {
          url,
          method: config.method || 'GET',
          status: _response.status,
          duration,
          attempt,
        });

        return _response;
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime;

        this.logger.warn('HTTP request failed', {
          url,
          method: config.method || 'GET',
          attempt,
          maxAttempts,
          duration,
          _error: error instanceof Error ? error.message : String(error),
        });

        // Don't retry on client errors (4xx) or if no retries left
        if (
          attempt === maxAttempts ||
          (error instanceof HttpError && error.status && error.status >= 400 && error.status < 500)
        ) {
          break;
        }

        // Wait before retry
        if (config.retryDelay && attempt < maxAttempts) {
          await this.delay(config.retryDelay * attempt);
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    this.logger.error('HTTP request failed after all retries', {
      url,
      method: config.method || 'GET',
      maxAttempts,
      totalDuration,
      _error: lastError?.message,
    });

    throw lastError;
  }

  /**
   * GET request
   */
  async get<T = any>(
    url: string,
    options: Omit<HttpRequestOptions, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body: data });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body: data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    url: string,
    options: Omit<HttpRequestOptions, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body: data });
  }

  /**
   * Make the actual HTTP request using fetch
   */
  private async makeRequest<T>(url: string, config: HttpRequestOptions): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null;

    try {
      const fetchOptions: RequestInit = {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        signal: controller.signal,
      };

      if (
        config.body &&
        (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')
      ) {
        fetchOptions.body =
          typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
      }

      const _response = await fetch(url, fetchOptions);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Parse response headers
      const headers: Record<string, string> = {};
      _response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Parse response body
      let data: T;
      const contentType = _response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = (await _response.json()) as T;
      } else {
        data = (await _response.text()) as unknown as T;
      }

      const httpResponse: HttpResponse<T> = {
        data,
        status: _response.status,
        statusText: _response.statusText,
        headers,
        config,
      };

      // Validate status
      if (config.validateStatus && !config.validateStatus(_response.status)) {
        throw new HttpError(
          `Request failed with status ${_response.status}: ${_response.statusText}`,
          _response.status,
          httpResponse,
          config
        );
      }

      return httpResponse;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new HttpError('Request timeout', 408, undefined, config);
      }

      throw new HttpError(
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        undefined,
        config
      );
    }
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create HTTP client instance
 */
export function createHttpClient(
  logger: LoggerInterface,
  options?: HttpRequestOptions
): HttpClient {
  return new HttpClient(logger, options);
}

/**
 * URL utilities
 */
export class UrlUtils {
  /**
   * Build URL with query parameters
   */
  static buildUrl(baseUrl: string, path?: string, params?: Record<string, any>): string {
    const url = new URL(baseUrl);

    if (path) {
      url.pathname = this.joinPaths(url.pathname, path);
    }

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    return url.toString();
  }

  /**
   * Parse URL and extract components
   */
  static parseUrl(url: string): {
    protocol: string;
    host: string;
    pathname: string;
    search: string;
    searchParams: URLSearchParams;
  } {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search,
      searchParams: parsed.searchParams,
    };
  }

  /**
   * Join URL paths
   */
  static joinPaths(...paths: string[]): string {
    return paths
      .map(path => path.replace(/^\/+|\/+$/g, ''))
      .filter(path => path.length > 0)
      .join('/');
  }
}
