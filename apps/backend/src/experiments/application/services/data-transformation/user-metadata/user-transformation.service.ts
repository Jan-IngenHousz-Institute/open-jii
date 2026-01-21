import { Injectable } from "@nestjs/common";

import type { SchemaData } from "../../../../../common/modules/databricks/services/sql/sql.types";
import type { UserDto } from "../../../../../users/core/models/user.model";
import { UserRepository } from "../../../../../users/core/repositories/user.repository";
import type { SchemaDataDto } from "../data-transformation.service";
import { DataTransformationService } from "../data-transformation.service";

type UserObject = Pick<UserDto, "id" | "name" | "image">;

@Injectable()
export class UserTransformationService extends DataTransformationService {
  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  getSourceColumns(): string[] {
    return ["user_id", "user_name"];
  }

  getTargetColumn(): string {
    return "user";
  }

  getTargetType(): string {
    return "USER";
  }

  canTransform(schemaData: SchemaData): boolean {
    return this.getSourceColumns().every((col) =>
      schemaData.columns.some((schemaCol) => schemaCol.name === col),
    );
  }

  async transformData(schemaData: SchemaData): Promise<SchemaDataDto> {
    const userIdIndex = schemaData.columns.findIndex((col) => col.name === "user_id");
    const userNameIndex = schemaData.columns.findIndex((col) => col.name === "user_name");

    // Create new columns (remove source columns, add target column)
    const newColumns = schemaData.columns
      .filter((col) => !this.getSourceColumns().includes(col.name))
      .concat([
        {
          name: this.getTargetColumn(),
          type_name: this.getTargetType(),
          type_text: this.getTargetType(),
        },
      ]);

    // Get unique user IDs and fetch their images
    const uniqueUserIds = [
      ...new Set(
        schemaData.rows.map((row) => row[userIdIndex]).filter((id): id is string => id !== null),
      ),
    ];

    const userImages = new Map<string, string | null>();
    if (uniqueUserIds.length > 0) {
      const result = await this.userRepository.findUsersByIds(uniqueUserIds);
      if (result.isSuccess()) {
        result.value.forEach((user) => {
          userImages.set(user.userId, user.image);
        });
      }
    }

    // Transform rows
    const newRows = schemaData.rows.map((row) => {
      const dataRow: Record<string, string | null> = {};

      // Add non-source columns
      row.forEach((value, index) => {
        if (index !== userIdIndex && index !== userNameIndex) {
          const columnName = schemaData.columns[index].name;
          dataRow[columnName] = value;
        }
      });

      // Add user object
      const userId = row[userIdIndex];
      const userName = row[userNameIndex];
      const userImage = userId ? (userImages.get(userId) ?? null) : null;

      // Return null for the entire column if userId is null
      if (userId === null) {
        dataRow[this.getTargetColumn()] = null;
        return dataRow;
      }

      const userObject: UserObject = {
        id: userId,
        name: userName ?? "Unknown User",
        image: userImage,
      };

      dataRow[this.getTargetColumn()] = JSON.stringify(userObject);

      return dataRow;
    });

    return {
      columns: newColumns,
      rows: newRows,
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
