import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createMqttConnection } from "~/services/mqtt/mqtt";
import { useAsyncCallback } from "react-async-hook";
import { useMqttLifecycle } from "~/services/mqtt/useMqttLifecycle";


export function useMqttConnection(customClientId?: string) {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['mqtt-connection', customClientId],
    queryFn: () => createMqttConnection(customClientId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    staleTime: Infinity,
  });

  const mqttEmitter = result.data;

  const handleConnectionLost = useAsyncCallback(async () => {
    console.log('MQTT connection lost, invalidating...');
    await queryClient.invalidateQueries({ queryKey: ['mqtt-connection', customClientId] });
  });

  useMqttLifecycle(mqttEmitter, handleConnectionLost.execute);

  return {
    mqttEmitter,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
  };
}