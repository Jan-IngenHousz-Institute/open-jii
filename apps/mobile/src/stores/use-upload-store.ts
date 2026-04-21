import { create } from "zustand";

interface UploadStore {
  uploadingIds: Set<string>;
  isUploading: boolean;
  setIsUploading: (uploading: boolean) => void;
  addUploadingIds: (ids: string[]) => void;
  removeUploadingId: (id: string) => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploadingIds: new Set(),
  isUploading: false,
  setIsUploading: (uploading) => set({ isUploading: uploading }),
  addUploadingIds: (ids) =>
    set((state) => ({ uploadingIds: new Set([...state.uploadingIds, ...ids]) })),
  removeUploadingId: (id) =>
    set((state) => {
      const next = new Set(state.uploadingIds);
      next.delete(id);
      return { uploadingIds: next };
    }),
}));
