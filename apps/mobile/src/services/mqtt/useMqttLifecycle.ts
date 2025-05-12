import { useAsync } from "react-async-hook";
import { Emitter } from "~/utils/emitter";
import { MqttEmitterEvents } from "~/services/mqtt/mqtt";


type EnrichedMqttEmitter = Emitter<MqttEmitterEvents> & { isConnected(): boolean };

export function useMqttLifecycle(
    mqttEmitter: EnrichedMqttEmitter | undefined,
    onConnectionLost: () => void | Promise<void>
) {
    useAsync(async () => {
        if (!mqttEmitter) return;

        if (!mqttEmitter.isConnected()) {
            await onConnectionLost();
        }

        mqttEmitter.on("connectionLost", onConnectionLost);

        return () => {
            mqttEmitter.off("connectionLost", onConnectionLost);
        };
    }, [mqttEmitter, onConnectionLost]);
}