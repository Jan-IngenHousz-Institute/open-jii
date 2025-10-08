import { tsr } from "@/lib/tsr";

interface DeleteUserProps {
  onSuccess?: () => Promise<void> | void;
}

export const useDeleteUser = (props: DeleteUserProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.deleteUser.useMutation({
    onSuccess: async () => {
      if (props.onSuccess) await props.onSuccess();
    },
    onSettled: async () => {
      // Ensure any component reading the user or userProfile refetches
      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};
