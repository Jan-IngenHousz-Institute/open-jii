import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { assistantContract } from "@repo/api/domains/assistant/assistant.contract";

import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError } from "../../common/utils/orpc-fp";
import { AssistantService } from "../core/assistant.service";

@Controller()
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistant: AssistantService) {}

  @Implement(assistantContract.chat)
  chat(@Session() session: UserSession) {
    return implement(assistantContract.chat).handler(({ input }) =>
      this.chatEvents(session, input),
    );
  }

  @Implement(assistantContract.listThreads)
  listThreads(@Session() session: UserSession) {
    return implement(assistantContract.listThreads).handler(({ input }) =>
      this.call("listThreads", () =>
        this.assistant.listThreads(session.user, input.cursor, input.limit),
      ),
    );
  }

  @Implement(assistantContract.getThread)
  getThread(@Session() session: UserSession) {
    return implement(assistantContract.getThread).handler(({ input }) =>
      this.call("getThread", () => this.assistant.getThread(session.user, input.threadId)),
    );
  }

  @Implement(assistantContract.rateMessage)
  rateMessage(@Session() session: UserSession) {
    return implement(assistantContract.rateMessage).handler(({ input }) =>
      this.call("rateMessage", () =>
        this.assistant.rateMessage(session.user, input.threadId, input.messageId, input.rating),
      ),
    );
  }

  @Implement(assistantContract.updateDraft)
  updateDraft(@Session() session: UserSession) {
    return implement(assistantContract.updateDraft).handler(({ input }) =>
      this.call("updateDraft", () =>
        this.assistant.updateDraft(session.user, input.draftId, input.payload),
      ),
    );
  }

  @Implement(assistantContract.confirmDraft)
  confirmDraft(@Session() session: UserSession) {
    return implement(assistantContract.confirmDraft).handler(({ input }) =>
      this.call("confirmDraft", () => this.assistant.confirmDraft(session.user, input.draftId)),
    );
  }

  @Implement(assistantContract.discardDraft)
  discardDraft(@Session() session: UserSession) {
    return implement(assistantContract.discardDraft).handler(({ input }) =>
      this.call("discardDraft", () => this.assistant.discardDraft(session.user, input.draftId)),
    );
  }

  @Implement(assistantContract.getUsage)
  getUsage(@Session() session: UserSession) {
    return implement(assistantContract.getUsage).handler(() =>
      this.call("getUsage", () => this.assistant.getUsage(session.user)),
    );
  }

  @Implement(assistantContract.listStarters)
  listStarters(@Session() session: UserSession) {
    return implement(assistantContract.listStarters).handler(({ input }) =>
      this.call("listStarters", () => this.assistant.listStarters(session.user, input)),
    );
  }

  @Implement(assistantContract.copyStarter)
  copyStarter(@Session() session: UserSession) {
    return implement(assistantContract.copyStarter).handler(({ input }) =>
      this.call("copyStarter", () =>
        this.assistant.copyStarter(session.user, input.starterId, input.organizationId),
      ),
    );
  }

  @Implement(assistantContract.listMetrics)
  listMetrics(@Session() session: UserSession) {
    return implement(assistantContract.listMetrics).handler(({ input }) =>
      this.call("listMetrics", () => this.assistant.metrics(session.user, input.from, input.to)),
    );
  }

  @Implement(assistantContract.setDailyBudget)
  setDailyBudget(@Session() session: UserSession) {
    return implement(assistantContract.setDailyBudget).handler(({ input }) =>
      this.call("setDailyBudget", () =>
        this.assistant.setDailyBudget(session.user, input.dailyTokens),
      ),
    );
  }

  @Implement(assistantContract.listStarterCollections)
  listStarterCollections(@Session() session: UserSession) {
    return implement(assistantContract.listStarterCollections).handler(() =>
      this.call("listStarterCollections", () => this.assistant.listCollections(session.user)),
    );
  }

  @Implement(assistantContract.upsertStarterCollection)
  upsertStarterCollection(@Session() session: UserSession) {
    return implement(assistantContract.upsertStarterCollection).handler(({ input }) =>
      this.call("upsertStarterCollection", () =>
        this.assistant.upsertCollection(session.user, input),
      ),
    );
  }

  @Implement(assistantContract.setStarterCollectionItems)
  setStarterCollectionItems(@Session() session: UserSession) {
    return implement(assistantContract.setStarterCollectionItems).handler(({ input }) =>
      this.call("setStarterCollectionItems", () =>
        this.assistant.setCollectionItems(session.user, input.collectionId, input.starterIds),
      ),
    );
  }

  private async *chatEvents(session: UserSession, input: Parameters<AssistantService["chat"]>[1]) {
    try {
      yield* this.assistant.chat(session.user, input);
    } catch (error) {
      if (error instanceof AppError) return throwOrpcError(error, this.logger, "chat");
      throw error;
    }
  }

  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) return throwOrpcError(error, this.logger, operation);
      throw error;
    }
  }
}
