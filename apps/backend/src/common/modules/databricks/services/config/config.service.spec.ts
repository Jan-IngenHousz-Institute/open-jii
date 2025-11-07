import { ConfigService } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import { DatabricksConfigService } from "./config.service";

describe("DatabricksConfigService", () => {
  const testApp = TestHarness.App;
  let configService: DatabricksConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    configService = testApp.module.get(DatabricksConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getConfig", () => {
    it("should return the config with all expected properties", () => {
      const config = configService.getConfig();

      // Verify the returned config has all required properties
      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.clientId).toBeDefined();
      expect(config.clientSecret).toBeDefined();
      expect(config.experimentProvisioningJobId).toBeDefined();
      expect(config.ambyteProcessingJobId).toBeDefined();
      expect(config.warehouseId).toBeDefined();
      expect(config.catalogName).toBeDefined();
    });
  });

  describe("validateConfig", () => {
    it("should throw an error if the config is invalid", () => {
      // Mock the ConfigService to return an empty string for a required value
      const configService = testApp.module.get(ConfigService);
      const getOrThrowSpy = vi
        .spyOn(configService, "getOrThrow")
        .mockImplementation((key: string) => {
          if (key === "databricks.experimentProvisioningJobId") {
            return "";
          }

          return "valid_string";
        });

      expect(() => new DatabricksConfigService(configService)).toThrow(
        "Invalid Databricks configuration: all fields must be non-empty strings",
      );

      getOrThrowSpy.mockRestore();
    });
  });

  describe("getter methods", () => {
    it("should return the correct host", () => {
      const host = configService.getHost();
      expect(host).toBe(process.env.DATABRICKS_HOST);
    });

    it("should return the correct client ID", () => {
      const clientId = configService.getClientId();
      expect(clientId).toBe(process.env.DATABRICKS_CLIENT_ID);
    });

    it("should return the correct client secret", () => {
      const clientSecret = configService.getClientSecret();
      expect(clientSecret).toBe(process.env.DATABRICKS_CLIENT_SECRET);
    });

    it("should return the correct experiment provisioning job ID", () => {
      const experimentProvisioningJobId = configService.getExperimentProvisioningJobId();
      expect(experimentProvisioningJobId).toBe(
        process.env.DATABRICKS_EXPERIMENT_PROVISIONING_JOB_ID,
      );
    });

    it("should return the correct experiment provisioning job ID as a number", () => {
      const experimentProvisioningJobIdAsNumber =
        configService.getExperimentProvisioningJobIdAsNumber();
      expect(experimentProvisioningJobIdAsNumber).toBe(
        Number(process.env.DATABRICKS_EXPERIMENT_PROVISIONING_JOB_ID),
      );
    });

    it("should return the correct ambyte processing job ID", () => {
      const ambyteProcessingJobId = configService.getAmbyteProcessingJobId();
      expect(ambyteProcessingJobId).toBe(process.env.DATABRICKS_AMBYTE_PROCESSING_JOB_ID);
    });

    it("should return the correct ambyte processing job ID as a number", () => {
      const ambyteProcessingJobIdAsNumber = configService.getAmbyteProcessingJobIdAsNumber();
      expect(ambyteProcessingJobIdAsNumber).toBe(
        Number(process.env.DATABRICKS_AMBYTE_PROCESSING_JOB_ID),
      );
    });

    it("should return the correct warehouse ID", () => {
      const warehouseId = configService.getWarehouseId();
      expect(warehouseId).toBe(process.env.DATABRICKS_WAREHOUSE_ID);
    });

    it("should return the correct catalog name", () => {
      const catalogName = configService.getCatalogName();
      expect(catalogName).toBe(process.env.DATABRICKS_CATALOG_NAME);
    });
  });
});
