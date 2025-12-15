import { tsr } from "@/lib/tsr";

interface TransferRequestCreateProps {
  onSuccess?: () => void;
}

export const useTransferRequestCreate = (props?: TransferRequestCreateProps) => {
  return tsr.experiments.createTransferRequest.useMutation({
    onSuccess: () => {
      if (props?.onSuccess) {
        props.onSuccess();
      }
    },
  });
};
