import { HttpClient, HttpError, UrlUtils, createHttpClient } from './http';
import { LoggerInterface } from '../logging/LoggerInterface';

// Mock Logger
const createMockLogger = (): LoggerInterface => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
  child: jest.fn().mockReturnThis(),
  setLevel: jest.fn(),
  getLevel: jest.fn().mockReturnValue('debug'),
  isLevelEnabled: jest.fn().mockReturnValue(true),
});

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('HttpClient', () => {
  let logger: LoggerInterface;
  let httpClient: HttpClient;

  beforeEach(() => {
    logger = createMockLogger();
    httpClient = new HttpClient(logger);
    mockFetch.mockClear();
  });

  describe('request', () => {
    it('should make a successful GET request', async () => {
      const mockResponse = { data: { message: 'success' }, status: 200 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse.data,
        text: async () => JSON.stringify(mockResponse.data),
      });

      const response = await httpClient.get('https://api.example.com/data');

      expect(response.data).toEqual(mockResponse.data);
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', expect.any(Object));
    });

    it('should handle non-json response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        json: async () => ({}),
        text: async () => 'just text',
      });

      const response = await httpClient.get('https://api.example.com/data');

      expect(response.data).toEqual('just text');
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', expect.any(Object));
    });

    it('should make a successful POST request with a body', async () => {
      const mockResponse = { data: { message: 'created' }, status: 201 };
      const requestBody = { name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse.data,
        text: async () => JSON.stringify(mockResponse.data),
      });

      const response = await httpClient.post('https://api.example.com/data', requestBody);

      expect(response.data).toEqual(mockResponse.data);
      expect(response.status).toBe(201);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          body: JSON.stringify(requestBody),
          method: 'POST',
        })
      );
    });

    it('should make a successful POST request with a string body', async () => {
      const mockResponse = { data: { message: 'created' }, status: 201 };
      const requestBody = 'just a string';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse.data,
        text: async () => JSON.stringify(mockResponse.data),
      });

      const response = await httpClient.post('https://api.example.com/data', requestBody);

      expect(response.data).toEqual(mockResponse.data);
      expect(response.status).toBe(201);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          body: requestBody,
          method: 'POST',
        })
      );
    });

    it('should retry a request on server error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          json: async () => ({}),
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ message: 'success' }),
          text: async () => JSON.stringify({ message: 'success' }),
        });

      const response = await httpClient.request('https://api.example.com/data', {
        retries: 1,
        retryDelay: 10,
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw HttpError on failed request after retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => 'Internal Server Error',
      });

      await expect(
        httpClient.request('https://api.example.com/data', { retries: 2, retryDelay: 10 })
      ).rejects.toThrow(HttpError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => 'Not Found',
      });

      await expect(
        httpClient.request('https://api.example.com/data', { retries: 2, retryDelay: 10 })
      ).rejects.toThrow(HttpError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle request timeout', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      const httpClientWithTimeout = new HttpClient(logger, { timeout: 10 });

      await expect(httpClientWithTimeout.request('https://api.example.com/data')).rejects.toThrow(
        new HttpError('Request timeout')
      );
    });

    it('should clear timeout on successful request', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({}),
        text: async () => '{}',
      });

      await httpClient.get('https://api.example.com/data');
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should throw HttpError for non-AbortError fetch errors', async () => {
      const genericError = new Error('Network failure');
      mockFetch.mockRejectedValue(genericError);

      await expect(httpClient.request('https://api.example.com/data')).rejects.toThrow(
        new HttpError(genericError.message)
      );
    });
  });

  describe('convenience methods', () => {
    it('put should call request with PUT method', async () => {
      const spy = jest.spyOn(httpClient, 'request');
      await httpClient.put('https://api.example.com/data', { name: 'test' }).catch(() => {});
      expect(spy).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'PUT',
        body: { name: 'test' },
      });
    });

    it('delete should call request with DELETE method', async () => {
      const spy = jest.spyOn(httpClient, 'request');
      await httpClient.delete('https://api.example.com/data').catch(() => {});
      expect(spy).toHaveBeenCalledWith('https://api.example.com/data', { method: 'DELETE' });
    });

    it('patch should call request with PATCH method', async () => {
      const spy = jest.spyOn(httpClient, 'request');
      await httpClient.patch('https://api.example.com/data', { name: 'test' }).catch(() => {});
      expect(spy).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'PATCH',
        body: { name: 'test' },
      });
    });
  });

  it('createHttpClient should return an instance of HttpClient', () => {
    const client = createHttpClient(logger);
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('should handle custom status validation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 418,
      statusText: "I'm a teapot",
      headers: new Headers(),
      json: async () => ({}),
      text: async () => "I'm a teapot",
    });

    const client = new HttpClient(logger, {
      validateStatus: status => status === 418,
    });

    const response = await client.get('https://api.example.com/teapot');
    expect(response.status).toBe(418);
  });
});

describe('HttpError', () => {
  it('should be an instance of Error', () => {
    const error = new HttpError('test error');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have the correct name', () => {
    const error = new HttpError('test error');
    expect(error.name).toBe('HttpError');
  });

  it('should correctly store status, response, and config', () => {
    const response = {
      data: {},
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {},
    };
    const config = { method: 'GET' as const };
    const error = new HttpError('test error', 500, response, config);

    expect(error.status).toBe(500);
    expect(error.response).toBe(response);
    expect(error.config).toBe(config);
  });
});

describe('UrlUtils', () => {
  describe('buildUrl', () => {
    it('should build a URL with base and path', () => {
      expect(UrlUtils.buildUrl('https://api.example.com', 'data')).toBe(
        'https://api.example.com/data'
      );
    });

    it('should handle trailing slash in baseUrl', () => {
      expect(UrlUtils.buildUrl('https://api.example.com/', 'data')).toBe(
        'https://api.example.com/data'
      );
    });

    it('should handle leading slash in path', () => {
      expect(UrlUtils.buildUrl('https://api.example.com', '/data')).toBe(
        'https://api.example.com/data'
      );
    });

    it('should add query parameters', () => {
      const params = { a: 1, b: 'test' };
      expect(UrlUtils.buildUrl('https://api.example.com', 'data', params)).toBe(
        'https://api.example.com/data?a=1&b=test'
      );
    });

    it('should handle array query parameters', () => {
      const params = { a: [1, 2] };
      expect(UrlUtils.buildUrl('https://api.example.com', 'data', params)).toBe(
        'https://api.example.com/data?a=1&a=2'
      );
    });

    it('should ignore null and undefined parameters', () => {
      const params = { a: 1, b: null, c: undefined };
      expect(UrlUtils.buildUrl('https://api.example.com', 'data', params)).toBe(
        'https://api.example.com/data?a=1'
      );
    });

    it('should handle URLs with existing query params', () => {
      const params = { b: 2 };
      expect(UrlUtils.buildUrl('https://api.example.com?a=1', 'data', params)).toBe(
        'https://api.example.com/data?a=1&b=2'
      );
    });
  });

  describe('parseUrl', () => {
    it('should parse a URL into its components', () => {
      const url = 'https://api.example.com:8080/path?q=test#hash';
      const parsed = UrlUtils.parseUrl(url);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.host).toBe('api.example.com:8080');
      expect(parsed.pathname).toBe('/path');
      expect(parsed.search).toBe('?q=test');
      expect(parsed.searchParams.get('q')).toBe('test');
    });
  });

  describe('joinPaths', () => {
    it('should join multiple path segments', () => {
      expect(UrlUtils.joinPaths('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should handle leading and trailing slashes', () => {
      expect(UrlUtils.joinPaths('/a/', '/b/', '/c/')).toBe('a/b/c');
    });

    it('should filter out empty segments', () => {
      expect(UrlUtils.joinPaths('a', '', 'c')).toBe('a/c');
    });
  });
});
