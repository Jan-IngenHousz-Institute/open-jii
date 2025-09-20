import { Injectable, Inject } from "@nestjs/common";

import { eq, experimentLocations } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch, success } from "../../../common/utils/fp-utils";
import { CreateLocationDto, LocationDto } from "../models/experiment-locations.model";

@Injectable()
export class LocationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async findByExperimentId(experimentId: string): Promise<Result<LocationDto[]>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experimentLocations)
        .where(eq(experimentLocations.experimentId, experimentId));

      return result;
    });
  }

  async create(createLocationDto: CreateLocationDto): Promise<Result<LocationDto[]>> {
    return tryCatch(() =>
      this.database
        .insert(experimentLocations)
        .values({
          experimentId: createLocationDto.experimentId,
          name: createLocationDto.name,
          latitude: createLocationDto.latitude.toString(),
          longitude: createLocationDto.longitude.toString(),
        })
        .returning(),
    );
  }

  async createMany(createLocationDtos: CreateLocationDto[]): Promise<Result<LocationDto[]>> {
    if (createLocationDtos.length === 0) {
      return success([]);
    }

    const values = createLocationDtos.map((dto) => ({
      experimentId: dto.experimentId,
      name: dto.name,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
    }));

    return tryCatch(() => this.database.insert(experimentLocations).values(values).returning());
  }

  async removeAllFromExperiment(experimentId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(experimentLocations)
        .where(eq(experimentLocations.experimentId, experimentId));
    });
  }

  async replaceExperimentLocations(
    experimentId: string,
    createLocationDtos: CreateLocationDto[],
  ): Promise<Result<LocationDto[]>> {
    return tryCatch(async () => {
      // Remove existing locations
      await this.database
        .delete(experimentLocations)
        .where(eq(experimentLocations.experimentId, experimentId));

      if (createLocationDtos.length === 0) {
        return [];
      }

      // Create new locations
      const newLocations = await this.database
        .insert(experimentLocations)
        .values(
          createLocationDtos.map((dto) => ({
            experimentId: dto.experimentId,
            name: dto.name,
            latitude: dto.latitude.toString(),
            longitude: dto.longitude.toString(),
          })),
        )
        .returning();

      return newLocations;
    });
  }
}
