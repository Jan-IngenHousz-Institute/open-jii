import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DuplicateMacroUseCase {
  private readonly logger = new Logger(DuplicateMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(macroId: string, userId: string, nameOverride?: string): Promise<Result<MacroDto>> {
    const sourceResult = await this.macroRepository.findById(macroId);
    if (sourceResult.isFailure()) {
      return sourceResult;
    }
    const source = sourceResult.value;
    if (!source) {
      return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
    }

    const trimmed = nameOverride?.trim() ?? "";
    // Cap to leave room under the 255-char name limit for the " (N)" disambiguator suffix.
    const baseName = (trimmed.length > 0 ? trimmed : `Copy of ${source.name}`).slice(0, 240);
    const nameResult = await this.resolveUniqueName(baseName);
    if (nameResult.isFailure()) {
      return nameResult;
    }

    // A fresh macro (new id → new filename hash) seeded from the source's latest code.
    const created = await this.macroRepository.create(
      {
        name: nameResult.value,
        description: source.description ?? undefined,
        language: source.language,
        code: source.code,
      },
      userId,
    );
    if (created.isFailure()) {
      return created;
    }
    if (created.value.length === 0) {
      return failure(AppError.internal("Failed to duplicate macro"));
    }

    this.logger.log({
      msg: "Duplicated macro",
      operation: "duplicateMacro",
      sourceId: macroId,
      newId: created.value[0].id,
      userId,
    });
    return success(created.value[0]);
  }

  /** Probe "Copy of X", "Copy of X (2)", … until the UNIQUE name constraint is free. */
  private async resolveUniqueName(base: string): Promise<Result<string>> {
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base} (${i + 1})`;
      const existing = await this.macroRepository.findByName(candidate);
      if (existing.isFailure()) {
        return existing;
      }
      if (!existing.value) {
        return success(candidate);
      }
    }
    return success(`${base} ${crypto.randomUUID().slice(0, 8)}`);
  }
}
