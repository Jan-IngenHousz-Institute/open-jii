import { tsr } from '../../../providers/QueryProvider';

export const useTasks = () => {
  return tsr.listTasks.useQuery({
    queryKey: ['tasks'],
  });
};
