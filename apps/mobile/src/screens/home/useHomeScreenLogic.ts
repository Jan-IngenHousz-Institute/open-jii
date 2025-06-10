import { useState } from "react";

export interface UseHomeScreenLogic {
  // State
  isOffline: boolean;
  refreshing: boolean;
  isSyncingAll: boolean;
  toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  };

  // Data
  mockUnsyncedScans: Array<{
    id: string;
    timestamp: string;
    experimentName: string;
  }>;

  // Actions
  onRefresh: () => Promise<void>;
  handleSyncAll: () => Promise<void>;
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }) => void;
}

// Mock data
const mockUnsyncedScans = [
  {
    id: "1",
    timestamp: "2025-06-10 14:30:22",
    experimentName: "Leaf Photosynthesis",
  },
  {
    id: "2",
    timestamp: "2025-06-10 15:45:10",
    experimentName: "Chlorophyll Fluorescence",
  },
];

export function useHomeScreenLogic(): UseHomeScreenLogic {
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Simulate refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);

    // Simulate network check
    const randomOffline = Math.random() > 0.7;
    setIsOffline(randomOffline);

    if (!randomOffline) {
      setToast({
        visible: true,
        message: "Connected to network",
        type: "success",
      });
    }
  };

  // Simulate sync all measurements
  const handleSyncAll = async () => {
    setIsSyncingAll(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if we're "online"
      if (!isOffline) {
        setToast({
          visible: true,
          message: "All measurements synced successfully",
          type: "success",
        });

        // In a real app, you would remove these items from your store
      } else {
        setToast({
          visible: true,
          message: "Sync failed: You are offline",
          type: "error",
        });
      }
    } catch {
      setToast({
        visible: true,
        message: "Sync failed. Please try again.",
        type: "error",
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  return {
    // State
    isOffline,
    refreshing,
    isSyncingAll,
    toast,

    // Data
    mockUnsyncedScans,

    // Actions
    onRefresh,
    handleSyncAll,
    setToast,
  };
}
