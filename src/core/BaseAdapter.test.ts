import { BaseAdapter } from "./BaseAdapter";
import { AdapterConfig } from "../types/config";
import { EHRAdapter, AuditQueryOptions } from "./EHRAdapter";
import {
  Patient,
  PatientSearchCriteria,
  QueryOptions,
  HealthStatus,
  CapabilityStatement,
  Observation,
  MedicationRequest,
  Appointment,
} from "../types/fhir";
import { ConsoleLogger } from "../logging/LoggerInterface";
import {
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ResourceNotFoundError,
  TimeoutError,
} from "../types/errors";

// A concrete implementation of BaseAdapter for testing purposes
class MockAdapter extends BaseAdapter {
  vendor = "mock";
  version = "1.0.0";
  supportedFHIRVersion = "4.0.1";

  getPatient(patientId: string, options?: QueryOptions): Promise<Patient> {
    return this.makeRequest("GET", `Patient/${patientId}`, {
      params: options ?? {},
    });
  }
  searchPatients(
    criteria: PatientSearchCriteria,
    options?: QueryOptions
  ): Promise<Patient[]> {
    return this.makeRequest("POST", "Patient/_search", {
      body: { ...criteria, ...(options ?? {}) },
    });
  }
  getVitals(patientId: string, options?: QueryOptions): Promise<Observation[]> {
    throw new Error("Method not implemented.");
  }
  getLabs(patientId: string, options?: QueryOptions): Promise<Observation[]> {
    throw new Error("Method not implemented.");
  }
  getMedications(
    patientId: string,
    options?: QueryOptions
  ): Promise<MedicationRequest[]> {
    throw new Error("Method not implemented.");
  }
  getAppointments(
    patientId: string,
    options?: QueryOptions
  ): Promise<Appointment[]> {
    throw new Error("Method not implemented.");
  }
  getCapabilities(): Promise<CapabilityStatement> {
    throw new Error("Method not implemented.");
  }
  healthCheck(): Promise<HealthStatus> {
    return this.makeRequest("GET", "health");
  }
}

describe("BaseAdapter", () => {
  let config: AdapterConfig;
  let adapter: MockAdapter;

  beforeEach(() => {
    config = {
      vendor: "mock",
      baseUrl: "https://example.com/fhir",
      auth: {
        type: "oauth2",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        tokenUrl: "https://example.com/oauth/token",
      },
      options: {
        retries: 2,
        retryDelay: 10,
        timeout: 5000,
      },
    };
    adapter = new MockAdapter(config);
    jest.spyOn(adapter as any, "executeHttpRequest").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      data: {},
    });
  });

  it("should initialize correctly", () => {
    expect(adapter.vendor).toBe("mock");
    expect(adapter.version).toBe("1.0.0");
    expect(adapter.supportedFHIRVersion).toBe("4.0.1");
  });

  it("should create a default logger if none is provided", () => {
    const { logger, ...configWithoutLogger } = config;
    const adapterWithoutLogger = new MockAdapter(configWithoutLogger);
    // @ts-ignore // Accessing protected property for test
    expect(adapterWithoutLogger.logger).toBeInstanceOf(ConsoleLogger);
  });

  it("should throw an error for custom queries by default", async () => {
    await expect(
      adapter.executeCustomQuery({ type: "test-query", parameters: {} })
    ).rejects.toThrow("Custom queries not supported by mock adapter");
  });

  it("should correctly build a URL", () => {
    // @ts-ignore // Accessing protected property for test
    const url = adapter.buildUrl("Patient/123");
    expect(url).toBe("https://example.com/fhir/Patient/123");
  });

  it("should handle trailing slashes in baseUrl", () => {
    const adapterWithTrailingSlash = new MockAdapter({
      ...config,
      baseUrl: "https://example.com/fhir/",
    });
    // @ts-ignore // Accessing protected property for test
    const url = adapterWithTrailingSlash.buildUrl("Patient/123");
    expect(url).toBe("https://example.com/fhir/Patient/123");
  });

  it("should prepare headers correctly", async () => {
    // @ts-ignore // Accessing protected property for test
    const headers = await adapter.prepareHeaders({
      "X-Test-Header": "test-value",
    });
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["User-Agent"]).toContain("EHR-Adapter-SDK");
    expect(headers["X-Test-Header"]).toBe("test-value");
  });

  it("should sanitize sensitive headers", () => {
    const headers = {
      Authorization: "Bearer secret-token",
      "x-api-key": "secret-key",
      Cookie: "secret-cookie",
      "Content-Type": "application/json",
    };
    // @ts-ignore // Accessing protected property for test
    const sanitizedHeaders = adapter.sanitizeHeaders(headers);
    expect(sanitizedHeaders["Authorization"]).toBe("[REDACTED]");
    expect(sanitizedHeaders["x-api-key"]).toBe("[REDACTED]");
    expect(sanitizedHeaders["Cookie"]).toBe("[REDACTED]");
    expect(sanitizedHeaders["Content-Type"]).toBe("application/json");
  });

  describe("getAuditLog", () => {
    beforeEach(async () => {
      // @ts-ignore
      adapter.auditLog = [];
      // @ts-ignore
      await adapter.logAuditEntry({
        operation: "read",
        resourceType: "Patient",
        patientId: "123",
        success: true,
        tenantId: "tenant-1",
        userId: "user-1",
      });
      // @ts-ignore
      await adapter.logAuditEntry({
        operation: "search",
        resourceType: "Patient",
        success: false,
        tenantId: "tenant-2",
        userId: "user-2",
      });
      // @ts-ignore
      await adapter.logAuditEntry({
        operation: "read",
        resourceType: "Observation",
        patientId: "456",
        success: true,
        tenantId: "tenant-1",
        userId: "user-1",
      });
    });

    it("should retrieve the full audit log", async () => {
      const log = await adapter.getAuditLog();
      expect(log.length).toBe(3);
    });

    it("should filter by operation", async () => {
      const log = await adapter.getAuditLog({ operation: "read" });
      expect(log.length).toBe(2);
      expect(log[0]?.operation).toBe("read");
    });

    it("should filter by success status", async () => {
      const log = await adapter.getAuditLog({ success: false });
      expect(log.length).toBe(1);
      expect(log[0]?.success).toBe(false);
    });

    it("should filter by tenantId", async () => {
      const log = await adapter.getAuditLog({ tenantId: "tenant-1" });
      expect(log.length).toBe(2);
    });

    it("should apply pagination", async () => {
      const log = await adapter.getAuditLog({ limit: 1, offset: 1 });
      expect(log.length).toBe(1);
      expect(log[0]?.operation).toBe("search");
    });
  });

  describe("Error Handling", () => {
    it("should identify retryable errors", () => {
      // @ts-ignore
      expect(
        adapter.isRetryableError(new NetworkError("Server error", "mock", 500))
      ).toBe(true);
      // @ts-ignore
      expect(
        adapter.isRetryableError(new RateLimitError("Rate limit", "mock"))
      ).toBe(true);
      // @ts-ignore
      expect(
        adapter.isRetryableError(
          new TimeoutError("Timeout", "mock", "test-operation", 5000)
        )
      ).toBe(true);
    });

    it("should identify non-retryable errors", () => {
      // @ts-ignore
      expect(
        adapter.isRetryableError(new AuthenticationError("Auth error", "mock"))
      ).toBe(false);
      // @ts-ignore
      expect(
        adapter.isRetryableError(new ResourceNotFoundError("Not found", "mock"))
      ).toBe(false);
      // @ts-ignore
      expect(adapter.isRetryableError(new Error("Generic error"))).toBe(false);
    });

    it("should transform timeout errors", () => {
      const error = { code: "ETIMEDOUT" };
      // @ts-ignore
      const transformed = adapter.transformError(error, "Patient/123");
      expect(transformed).toBeInstanceOf(TimeoutError);
    });

    it("should transform authentication errors", () => {
      const error = { response: { status: 401, data: "Unauthorized" } };
      // @ts-ignore
      const transformed = adapter.transformError(error, "Patient/123");
      expect(transformed).toBeInstanceOf(AuthenticationError);
    });

    it("should transform not found errors", () => {
      const error = { response: { status: 404, data: "Not Found" } };
      // @ts-ignore
      const transformed = adapter.transformError(error, "Patient/123");
      expect(transformed).toBeInstanceOf(ResourceNotFoundError);
    });

    it("should transform rate limit errors", () => {
      const error = {
        response: { status: 429, headers: { "retry-after": "60" } },
      };
      // @ts-ignore
      const transformed = adapter.transformError(error, "Patient/123");
      expect(transformed).toBeInstanceOf(RateLimitError);
    });

    it("should handle generic errors", () => {
      const error = new Error("A generic error");
      // @ts-ignore
      const transformed = adapter.transformError(error, "Patient/123");
      expect(transformed).toBeInstanceOf(NetworkError);
    });
  });

  describe("makeRequest", () => {
    let mockHttpClient: jest.SpyInstance;

    beforeEach(() => {
      mockHttpClient = jest.spyOn(adapter as any, "executeHttpRequest");
    });

    it("should make a successful request and update stats", async () => {
      const responseData = { id: "123", resourceType: "Patient" };
      mockHttpClient.mockResolvedValue({
        status: 200,
        data: responseData,
        headers: {},
      });

      const result = await adapter.getPatient("123");

      expect(result).toEqual(responseData);
      expect(mockHttpClient).toHaveBeenCalledWith(
        expect.objectContaining({ method: "GET" }),
        "https://example.com/fhir/Patient/123"
      );
      const stats = adapter.getStatistics();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });

    it("should handle request failure and update stats", async () => {
      const error = new NetworkError("Server error", "mock", 500);
      mockHttpClient.mockRejectedValue(error);

      await expect(adapter.getPatient("123")).rejects.toThrow(NetworkError);

      const stats = adapter.getStatistics();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(1);
    });

    it("should retry failed requests", async () => {
      const error = new NetworkError("Server error", "mock", 502);
      mockHttpClient
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({
          status: 200,
          data: { id: "123" },
          headers: {},
        });

      await adapter.getPatient("123");

      expect(mockHttpClient).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const error = new AuthenticationError("Auth error", "mock");
      mockHttpClient.mockRejectedValue(error);

      await expect(adapter.getPatient("123")).rejects.toThrow(
        AuthenticationError
      );

      expect(mockHttpClient).toHaveBeenCalledTimes(1);
    });

    // SecurityProvider is available in the commercial version
    // it("should use security provider to sign request", async () => {
    //   const securityProvider = {
    //     name: "mock-security",
    //     version: "1.0.0",
    //     signRequest: jest.fn((req) =>
    //       Promise.resolve({
    //         ...req,
    //         headers: { ...req.headers, "X-Signature": "signed" },
    //       })
    //     ),
    //     validateResponse: jest.fn(() => Promise.resolve()),
    //     validateConfig: jest.fn(() =>
    //       Promise.resolve({ valid: true, errors: [], warnings: [] })
    //     ),
    //     getCapabilities: jest.fn(() => ({
    //       encryption: { algorithms: [], keyLengths: [], modes: [] },
    //       signing: { algorithms: [], keyTypes: [] },
    //       hashing: { algorithms: [] },
    //       features: [],
    //     })),
    //   };
    //   const adapterWithSecurity = new MockAdapter({ ...config, security: securityProvider });
    //   const mockExecute = jest
    //     .spyOn(adapterWithSecurity as any, "executeHttpRequest")
    //     .mockResolvedValue({
    //       data: { id: "123" },
    //       status: 200,
    //       headers: {},
    //     });

    //   await adapterWithSecurity.searchPatients({ name: "test" });

    //   expect(securityProvider.signRequest).toHaveBeenCalledTimes(1);
    //   expect(mockExecute).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       headers: expect.objectContaining({ "X-Signature": "signed" }),
    //     }),
    //     "https://example.com/fhir/Patient/_search"
    //   );

    //   mockExecute.mockRestore();
    // });
  });

  it("should return current statistics", () => {
    // @ts-ignore
    adapter.stats = {
      totalRequests: 10,
      successfulRequests: 8,
      failedRequests: 2,
      totalResponseTime: 1234,
      lastActivity: new Date(),
    };

    const stats = adapter.getStatistics();
    expect(stats.totalRequests).toBe(10);
    expect(stats.successfulRequests).toBe(8);
    expect(stats.failedRequests).toBe(2);
    expect(stats.averageResponseTime).toBe(123.4);
  });
});
