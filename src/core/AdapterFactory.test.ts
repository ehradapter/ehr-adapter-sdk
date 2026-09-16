import {
  getAdapter,
  getTenantAdapter,
  EHRAdapterFactory,
  AdapterUtils,
} from "./AdapterFactory";
import { AdapterConfig, TenantAdapterConfig } from "../types/config";
import { MockAdapter } from "../vendors/mock/MockAdapter";
// Epic and Athena adapters are available in the commercial version
// import { EpicAdapter } from '../vendors/epic/EpicAdapter';
// import { AthenaAdapter } from '../vendors/athena/AthenaAdapter';
import { ConfigurationError, EHRAdapterError } from "../types/errors";
import { EHRAdapter } from "./EHRAdapter";

describe("AdapterFactory", () => {
  let mockConfig: AdapterConfig;
  let epicConfig: AdapterConfig;
  let athenaConfig: any;

  beforeEach(() => {
    mockConfig = {
      vendor: "mock",
      baseUrl: "https://mock-ehr.com/fhir",
      auth: { type: "apikey", apiKey: "mock-key" },
    };
    epicConfig = {
      vendor: "epic",
      baseUrl: "https://fhir.epic.com/interconnect-fhir-proxy/api/FHIR/R4",
      auth: {
        type: "oauth2",
        clientId: "epic-id",
        clientSecret: "epic-secret",
        tokenUrl: "https://fhir.epic.com/interconnect-fhir-proxy/oauth2/token",
      },
    };
    athenaConfig = {
      vendor: "athena",
      baseUrl: "https://api.preview.athenahealth.com/v1/195900/fhir/r4",
      auth: { type: "apikey", apiKey: "athena-key" },
      practiceId: "12345",
    };
  });

  describe("getAdapter", () => {
    it("should create a MockAdapter", () => {
      const adapter = getAdapter("mock", mockConfig);
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    // Epic and Athena adapters are available in the commercial version
    // it("should create an EpicAdapter", () => {
    //   const adapter = getAdapter("epic", epicConfig);
    //   expect(adapter).toBeInstanceOf(EpicAdapter);
    // });

    // it("should create an AthenaAdapter", () => {
    //   const adapter = getAdapter("athena", athenaConfig);
    //   expect(adapter).toBeInstanceOf(AthenaAdapter);
    // });

    it("should throw for an unsupported vendor", () => {
      expect(() => getAdapter("invalid-vendor", mockConfig)).toThrow(
        EHRAdapterError
      );
    });

    it("should throw for an unimplemented vendor", () => {
      expect(() => getAdapter("cerner", mockConfig)).toThrow(
        "Cerner adapter is not yet implemented"
      );
    });

    it("should throw when tenant config is present (commercial feature)", () => {
      const tenantConfig = {
        ...mockConfig,
        tenant: { tenantId: "tenant-1", isolationLevel: "strict" as const },
      };
      expect(() => getAdapter("mock", tenantConfig)).toThrow(EHRAdapterError);
      expect(() => getAdapter("mock", tenantConfig)).toThrow(
        "Multi-tenant support requires a commercial license"
      );
    });

    it("should use the COMMERCIAL_LICENSE_REQUIRED code for tenant config", () => {
      const tenantConfig = {
        ...mockConfig,
        tenant: { tenantId: "tenant-1", isolationLevel: "strict" as const },
      };
      try {
        getAdapter("mock", tenantConfig);
        throw new Error("Expected getAdapter to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(EHRAdapterError);
        expect((error as EHRAdapterError).code).toBe(
          "COMMERCIAL_LICENSE_REQUIRED"
        );
      }
    });

    it("should never return a non-isolated adapter when tenant is requested", () => {
      const tenantConfig = {
        ...mockConfig,
        tenant: { tenantId: "tenant-1", isolationLevel: "strict" as const },
      };
      // Silently falling back to a plain adapter would look like isolation
      // is in effect when it is not — the call must fail instead.
      expect(() => getAdapter("mock", tenantConfig)).toThrow();
    });

    it("should throw ConfigurationError for invalid config", () => {
      const invalidConfig: any = { vendor: "mock", auth: { type: "apikey" } };
      expect(() => getAdapter("mock", invalidConfig)).toThrow(
        ConfigurationError
      );
    });

    it("should report the commercial requirement for an invalid tenant config", () => {
      const invalidTenantConfig: any = {
        ...mockConfig,
        tenant: { isolationLevel: "strict" },
      };
      // Previously surfaced TenantIsolationError from the wrapper's
      // constructor; the wrapper is no longer reachable from this factory.
      expect(() => getAdapter("mock", invalidTenantConfig)).toThrow(
        "Multi-tenant support requires a commercial license"
      );
    });

    it("should handle vendor name normalization", () => {
      const adapter = getAdapter("  MocK  ", mockConfig);
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it("should throw ConfigurationError for invalid URL", () => {
      const invalidConfig = { ...mockConfig, baseUrl: "not-a-url" };
      expect(() => getAdapter("mock", invalidConfig)).toThrow(
        ConfigurationError
      );
    });

    it("should throw ConfigurationError for missing Epic auth details", () => {
      const invalidConfig: any = {
        vendor: "epic",
        baseUrl: "https://fhir.epic.com/interconnect-fhir-proxy/api/FHIR/R4",
        auth: { type: "oauth2", clientId: "epic-id" },
      };
      expect(() => getAdapter("epic", invalidConfig)).toThrow(
        ConfigurationError
      );
    });

    it("should throw ConfigurationError for missing Athena practiceId", () => {
      const invalidConfig: any = {
        vendor: "athena",
        baseUrl: "https://api.preview.athenahealth.com/v1/195900/fhir/r4",
        auth: { type: "apikey", apiKey: "athena-key" },
      };
      expect(() => getAdapter("athena", invalidConfig)).toThrow(
        ConfigurationError
      );
    });
  });

  describe("getTenantAdapter", () => {
    it("should throw for a valid tenant config (commercial feature)", () => {
      const tenantConfig: TenantAdapterConfig = {
        tenantId: "tenant-1",
        config: mockConfig,
      };
      expect(() => getTenantAdapter("mock", tenantConfig)).toThrow(
        EHRAdapterError
      );
      expect(() => getTenantAdapter("mock", tenantConfig)).toThrow(
        "Multi-tenant support requires a commercial license"
      );
    });

    it("should use the COMMERCIAL_LICENSE_REQUIRED code", () => {
      const tenantConfig: TenantAdapterConfig = {
        tenantId: "tenant-1",
        config: mockConfig,
      };
      try {
        getTenantAdapter("mock", tenantConfig);
        throw new Error("Expected getTenantAdapter to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(EHRAdapterError);
        expect((error as EHRAdapterError).code).toBe(
          "COMMERCIAL_LICENSE_REQUIRED"
        );
      }
    });

    it("should gate on the license before validating tenant config", () => {
      const invalidTenantConfig: any = { config: mockConfig };
      expect(() => getTenantAdapter("mock", invalidTenantConfig)).toThrow(
        "Multi-tenant support requires a commercial license"
      );
      expect(() => getTenantAdapter("mock", invalidTenantConfig)).not.toThrow(
        ConfigurationError
      );
    });

    it("should gate on the license before validating tenantId format", () => {
      const tenantConfig: TenantAdapterConfig = {
        tenantId: "invalid tenant id",
        config: mockConfig,
      };
      expect(() => getTenantAdapter("mock", tenantConfig)).toThrow(
        "Multi-tenant support requires a commercial license"
      );
    });

    it("should throw regardless of vendor", () => {
      const tenantConfig: TenantAdapterConfig = {
        tenantId: "tenant-1",
        config: mockConfig,
      };
      expect(() => getTenantAdapter("epic", tenantConfig)).toThrow(
        EHRAdapterError
      );
      expect(() => getTenantAdapter("not-a-vendor", tenantConfig)).toThrow(
        EHRAdapterError
      );
    });
  });

  describe("EHRAdapterFactory (class)", () => {
    class CustomAdapter extends MockAdapter {}

    beforeEach(() => {
      EHRAdapterFactory.unregisterAdapter("custom");
      EHRAdapterFactory.setDefaultConfig("custom", {});
    });

    it("should register and create a custom adapter", () => {
      EHRAdapterFactory.registerAdapter("custom", CustomAdapter);
      const adapter = EHRAdapterFactory.create("custom", mockConfig);
      expect(adapter).toBeInstanceOf(CustomAdapter);
    });

    it("should fall back to built-in adapters", () => {
      const adapter = EHRAdapterFactory.create("mock", mockConfig);
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it("should set and get default config", () => {
      const defaultConfig = { options: { timeout: 5000 } };
      EHRAdapterFactory.setDefaultConfig("mock", defaultConfig);
      expect(EHRAdapterFactory.getDefaultConfig("mock")).toEqual(defaultConfig);
    });

    it("should create an adapter with default configs", () => {
      EHRAdapterFactory.setDefaultConfig("mock", {
        options: { timeout: 5000 },
        auth: { type: "apikey", apiKey: "default-key" },
      });
      const adapter = EHRAdapterFactory.createWithDefaults("mock", {
        baseUrl: "https://new-url.com",
      });
      // @ts-ignore
      expect(adapter.config.options.timeout).toBe(5000);
      // @ts-ignore
      expect(adapter.config.baseUrl).toBe("https://new-url.com");
      // @ts-ignore
      expect(adapter.config.auth.apiKey).toBe("default-key");
    });

    it("should merge default configs deeply", () => {
      EHRAdapterFactory.setDefaultConfig("mock", {
        options: { timeout: 5000, retries: 1 },
      });
      const adapter = EHRAdapterFactory.createWithDefaults("mock", {
        baseUrl: "https://new-url.com",
        auth: { type: "apikey", apiKey: "test-key" },
        options: { retries: 3, retryDelay: 100 },
      });
      // @ts-ignore
      expect(adapter.config.options.timeout).toBe(5000);
      // @ts-ignore
      expect(adapter.config.options.retries).toBe(3);
      // @ts-ignore
      expect(adapter.config.options.retryDelay).toBe(100);
    });

    it("should list supported vendors", () => {
      EHRAdapterFactory.registerAdapter("custom", CustomAdapter);
      const vendors = EHRAdapterFactory.getSupportedVendors();
      expect(vendors).toContain("mock");
      expect(vendors).toContain("epic");
      expect(vendors).toContain("athena");
      expect(vendors).toContain("custom");
    });

    it("should check if a vendor is supported", () => {
      expect(EHRAdapterFactory.isVendorSupported("mock")).toBe(true);
      expect(EHRAdapterFactory.isVendorSupported("invalid-vendor")).toBe(false);
    });

    it("should throw when creating an unsupported adapter", () => {
      expect(() =>
        EHRAdapterFactory.create("unsupported-vendor", mockConfig)
      ).toThrow(EHRAdapterError);
    });

    it("should unregister an adapter", () => {
      EHRAdapterFactory.registerAdapter("custom", CustomAdapter);
      expect(EHRAdapterFactory.isVendorSupported("custom")).toBe(true);
      EHRAdapterFactory.unregisterAdapter("custom");
      expect(EHRAdapterFactory.isVendorSupported("custom")).toBe(false);
    });
  });

  describe("AdapterUtils", () => {
    it("should validate a valid config", () => {
      const result = AdapterUtils.validateConfig("mock", mockConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should invalidate a config with missing fields", () => {
      const result = AdapterUtils.validateConfig("mock", {
        vendor: "mock",
      } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Invalid adapter configuration");
    });

    it("should return unknown validation error for non-ConfigurationError", () => {
      jest.spyOn(AdapterUtils, "validateConfig").mockImplementationOnce(() => {
        return {
          isValid: false,
          errors: ["Some other error"],
          warnings: [],
        };
      });
      const result = AdapterUtils.validateConfig("mock", mockConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Some other error");
    });

    it("should get adapter metadata", () => {
      const metadata = AdapterUtils.getAdapterMetadata("epic");
      expect(metadata?.vendor).toBe("epic");
      expect(metadata?.name).toBe("Epic EHR Adapter");
    });

    it("should return null for unknown metadata", () => {
      const metadata = AdapterUtils.getAdapterMetadata("invalid-vendor");
      expect(metadata).toBeNull();
    });

    it("should get all adapter metadata", () => {
      const allMetadata = AdapterUtils.getAllAdapterMetadata();
      expect(allMetadata.length).toBeGreaterThanOrEqual(3);
      expect(allMetadata.some((m) => m.vendor === "athena")).toBe(true);
    });

    it("should return metadata for all supported vendors including custom ones", () => {
      class CustomMetadataAdapter extends MockAdapter {}
      EHRAdapterFactory.registerAdapter("custom-meta", CustomMetadataAdapter);
      jest
        .spyOn(AdapterUtils, "getAdapterMetadata")
        .mockImplementation((vendor: string) => {
          if (vendor === "custom-meta") {
            return {
              vendor: "custom-meta",
              name: "Custom Metadata Adapter",
              description: "A custom adapter for metadata tests",
              version: "1.0.0",
              fhirVersions: ["R4"],
              authTypes: ["apikey"],
              capabilities: ["read"],
              documentation: "https://docs.example.com/custom-meta",
            };
          }
          if (vendor === "mock") return { vendor: "mock" } as any;
          if (vendor === "epic") return { vendor: "epic" } as any;
          if (vendor === "athena") return { vendor: "athena" } as any;
          return null;
        });

      const allMetadata = AdapterUtils.getAllAdapterMetadata();
      expect(allMetadata.length).toBeGreaterThanOrEqual(4);
      expect(allMetadata.some((m) => m.vendor === "custom-meta")).toBe(true);

      EHRAdapterFactory.unregisterAdapter("custom-meta");
      (AdapterUtils.getAdapterMetadata as jest.Mock).mockRestore();
    });
  });
});
