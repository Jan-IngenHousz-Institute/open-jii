/**
 * Project transfer request interfaces for migrating projects from PhotosynQ to openJII
 */

// Base transfer request interface
export interface BaseTransferRequest {
  requestId: string;
  userId: string;
  userEmail: string;
  sourcePlatform: string; // e.g., "photosynq"
  projectIdOld: string;
  projectUrlOld: string;
  status: string; // "pending", "completed", "rejected", etc.
  requestedAt: Date;
}

// Input type for creating transfer requests
export type CreateTransferRequestDto = Omit<BaseTransferRequest, "requestId" | "requestedAt">;

// Output type from database
export type TransferRequestDto = BaseTransferRequest;
