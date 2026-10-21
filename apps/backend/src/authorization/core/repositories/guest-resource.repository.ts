import { Injectable } from "@nestjs/common";

import type { DbOrTx } from "@repo/database";

import { GuestExperimentAccessRepository } from "../../../experiments/core/repositories/guest-access.repository";
import { GuestMacroAccessRepository } from "../../../macros/core/repositories/guest-access.repository";
import { GuestOrganizationAccessRepository } from "../../../organizations/core/repositories/guest-access.repository";
import { GuestProtocolAccessRepository } from "../../../protocols/core/repositories/guest-access.repository";
import { GuestWorkbookAccessRepository } from "../../../workbooks/core/repositories/guest-access.repository";
import type { GuestResourcePort, GuestResourceKind } from "../ports/guest-resource.port";

@Injectable()
export class GuestResourceRepository implements GuestResourcePort {
  constructor(
    private readonly experiment: GuestExperimentAccessRepository,
    private readonly macro: GuestMacroAccessRepository,
    private readonly protocol: GuestProtocolAccessRepository,
    private readonly workbook: GuestWorkbookAccessRepository,
    private readonly organization: GuestOrganizationAccessRepository,
  ) {}
  findOwnership(kind: GuestResourceKind, id: string, executor?: DbOrTx) {
    return this[kind].findOwnership(id, executor);
  }
}
