import { HttpService } from "@nestjs/axios";
import { Test, TestingModule } from "@nestjs/testing";
import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { DatabricksVolumesService } from "./volumes.service";
import { CreateVolumeParams, GetVolumeParams, VolumeResponse } from "./volumes.types";

describe("DatabricksVolumesService", () => {
  let service: DatabricksVolumesService;
  let httpService: HttpService;
  let authService: DatabricksAuthService;
  let configService: DatabricksConfigService;

  const mockToken = "mock-token";
  const mockHost = "https://mock-databricks.example.com";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabricksVolumesService,
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              post: vi.fn(),
              get: vi.fn(),
            },
          },
        },
        {
          provide: DatabricksAuthService,
          useValue: {
            getAccessToken: vi.fn(),
          },
        },
        {
          provide: DatabricksConfigService,
          useValue: {
            getHost: vi.fn().mockReturnValue(mockHost),
          },
        },
      ],
    }).compile();

    service = module.get<DatabricksVolumesService>(DatabricksVolumesService);
    httpService = module.get<HttpService>(HttpService);
    authService = module.get<DatabricksAuthService>(DatabricksAuthService);
    configService = module.get<DatabricksConfigService>(DatabricksConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createVolume", () => {
    it("should create a volume successfully", async () => {
      // Arrange
      const createVolumeParams: CreateVolumeParams = {
        catalog_name: "main",
        name: "my_volume",
        schema_name: "default",
        volume_type: "MANAGED",
        comment: "Test volume",
      };

      const mockResponse: VolumeResponse = {
        catalog_name: "main",
        comment: "Test volume",
        created_at: 1666369196203,
        created_by: "test@example.com",
        full_name: "main.default.my_volume",
        metastore_id: "11111111-1111-1111-1111-111111111111",
        name: "my_volume",
        owner: "test@example.com",
        schema_name: "default",
        updated_at: 1666369196203,
        updated_by: "test@example.com",
        volume_id: "01234567-89ab-cdef-0123-456789abcdef",
        volume_type: "MANAGED",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => true,
        value: mockToken,
      } as any);
      vi.spyOn(httpService.axiosRef, "post").mockResolvedValue({ data: mockResponse } as any);

      // Act
      const result = await service.createVolume(createVolumeParams);

      // Assert
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual(mockResponse);
      }
      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        `${mockHost}${DatabricksVolumesService.VOLUMES_ENDPOINT}`,
        createVolumeParams,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should handle errors when creating a volume", async () => {
      // Arrange
      const createVolumeParams: CreateVolumeParams = {
        catalog_name: "main",
        name: "my_volume",
        schema_name: "default",
        volume_type: "EXTERNAL",
        storage_location: "s3://invalid-bucket",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => true,
        value: mockToken,
      } as any);
      vi.spyOn(httpService.axiosRef, "post").mockRejectedValue(
        new Error("Failed to create volume"),
      );

      // Act
      const result = await service.createVolume(createVolumeParams);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(httpService.axiosRef.post).toHaveBeenCalled();
    });

    it("should handle auth token failure", async () => {
      // Arrange
      const createVolumeParams: CreateVolumeParams = {
        catalog_name: "main",
        name: "my_volume",
        schema_name: "default",
        volume_type: "MANAGED",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => false,
        isFailure: () => true,
        error: new Error("Auth failed"),
      } as any);

      // Act
      const result = await service.createVolume(createVolumeParams);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    });
  });

  describe("getVolume", () => {
    it("should get a volume successfully", async () => {
      // Arrange
      const getVolumeParams: GetVolumeParams = {
        name: "main.default.my_volume",
      };

      const mockResponse: VolumeResponse = {
        catalog_name: "main",
        comment: "Test volume",
        created_at: 1666369196203,
        created_by: "test@example.com",
        full_name: "main.default.my_volume",
        metastore_id: "11111111-1111-1111-1111-111111111111",
        name: "my_volume",
        owner: "test@example.com",
        schema_name: "default",
        updated_at: 1666369196203,
        updated_by: "test@example.com",
        volume_id: "01234567-89ab-cdef-0123-456789abcdef",
        volume_type: "MANAGED",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => true,
        value: mockToken,
      } as any);
      vi.spyOn(httpService.axiosRef, "get").mockResolvedValue({ data: mockResponse } as any);

      // Act
      const result = await service.getVolume(getVolumeParams);

      // Assert
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual(mockResponse);
      }
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        `${mockHost}${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(getVolumeParams.name)}`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should handle include_browse parameter", async () => {
      // Arrange
      const getVolumeParams: GetVolumeParams = {
        name: "main.default.my_volume",
        include_browse: true,
      };

      const mockResponse: VolumeResponse = {
        catalog_name: "main",
        comment: "Test volume",
        created_at: 1666369196203,
        created_by: "test@example.com",
        full_name: "main.default.my_volume",
        metastore_id: "11111111-1111-1111-1111-111111111111",
        name: "my_volume",
        owner: "test@example.com",
        schema_name: "default",
        updated_at: 1666369196203,
        updated_by: "test@example.com",
        volume_id: "01234567-89ab-cdef-0123-456789abcdef",
        volume_type: "MANAGED",
        browse_only: true,
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => true,
        value: mockToken,
      } as any);
      vi.spyOn(httpService.axiosRef, "get").mockResolvedValue({ data: mockResponse } as any);

      // Act
      const result = await service.getVolume(getVolumeParams);

      // Assert
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual(mockResponse);
      }
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        `${mockHost}${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(getVolumeParams.name)}?include_browse=true`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should handle errors when getting a volume", async () => {
      // Arrange
      const getVolumeParams: GetVolumeParams = {
        name: "main.default.nonexistent_volume",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => true,
        value: mockToken,
      } as any);
      vi.spyOn(httpService.axiosRef, "get").mockRejectedValue(new Error("Volume not found"));

      // Act
      const result = await service.getVolume(getVolumeParams);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(httpService.axiosRef.get).toHaveBeenCalled();
    });

    it("should handle auth token failure", async () => {
      // Arrange
      const getVolumeParams: GetVolumeParams = {
        name: "main.default.my_volume",
      };

      vi.spyOn(authService, "getAccessToken").mockResolvedValue({
        isSuccess: () => false,
        isFailure: () => true,
        error: new Error("Auth failed"),
      } as any);

      // Act
      const result = await service.getVolume(getVolumeParams);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(httpService.axiosRef.get).not.toHaveBeenCalled();
    });
  });
});
