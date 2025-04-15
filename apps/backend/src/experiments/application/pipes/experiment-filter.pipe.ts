import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { z } from "validator";

const experimentFilterSchema = z.enum(["my", "member", "related"]).optional();

export type ExperimentFilter = z.infer<typeof experimentFilterSchema>;

@Injectable()
export class ExperimentFilterPipe implements PipeTransform<string | undefined> {
  transform(value: string | undefined): ExperimentFilter {
    const result = experimentFilterSchema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(
        "Filter must be one of: my, member, related",
      );
    }

    return result.data;
  }
}