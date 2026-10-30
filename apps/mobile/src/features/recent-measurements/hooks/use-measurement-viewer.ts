import { useMemo } from "react";
import { useSession } from "~/features/auth/hooks/use-session";
import type { MeasurementViewer } from "~/shared/db/measurements-storage";

export function useMeasurementViewer(): MeasurementViewer {
  const { user } = useSession();
  return useMemo(() => {
    if (!user?.id) return null;
    return { userId: user.id, isGuest: user.isAnonymous === true };
  }, [user?.id, user?.isAnonymous]);
}

export function measurementViewerKey(viewer: MeasurementViewer) {
  if (!viewer) return "signed-out";
  return `${viewer.userId}:${String(viewer.isGuest)}`;
}
