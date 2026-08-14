import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getEnvName } from "~/shared/stores/environment-store";

const MOBILE_THING_PREFIX = "mobile_";

/**
 * This phone's device identity against one backend environment. The installId
 * is minted locally and doubles as the registered serial number; the thing
 * name is derivable offline (`mobile_<installId>`, the exact server
 * derivation), so publishing never waits on registration.
 */
export interface DeviceIdentity {
  installId: string;
  /** Authoritative name from the ensure response; equals the local derivation. */
  thingName?: string;
  /** Backend registry row id. */
  deviceId?: string;
  registeredAt?: string;
}

interface DeviceIdentityStoreState {
  /** Keyed by environment name: a dev registration means nothing in prod. */
  identities: Record<string, DeviceIdentity>;
  isLoaded: boolean;
}

interface DeviceIdentityStoreActions {
  mintInstallId: (envName: string) => DeviceIdentity;
  setRegistered: (envName: string, registration: { thingName: string; deviceId: string }) => void;
}

export const useDeviceIdentityStore = create<
  DeviceIdentityStoreState & DeviceIdentityStoreActions
>()(
  persist(
    (set, get) => ({
      identities: {},
      isLoaded: false,
      mintInstallId: (envName) => {
        const existing = get().identities[envName];
        if (existing) {
          return existing;
        }

        const minted: DeviceIdentity = { installId: uuidv4() };
        set((state) => ({ identities: { ...state.identities, [envName]: minted } }));
        return minted;
      },
      setRegistered: (envName, registration) => {
        set((state) => {
          const identity = state.identities[envName];
          if (!identity) {
            return state;
          }

          return {
            identities: {
              ...state.identities,
              [envName]: {
                ...identity,
                thingName: registration.thingName,
                deviceId: registration.deviceId,
                registeredAt: new Date().toISOString(),
              },
            },
          };
        });
      },
    }),
    {
      name: "device-identity-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => {
        return () => {
          useDeviceIdentityStore.setState({ isLoaded: true });
        };
      },
    },
  ),
);

/** This phone's identity for the active environment, minting on first use. */
export function getDeviceIdentity(): DeviceIdentity {
  const { isLoaded, mintInstallId } = useDeviceIdentityStore.getState();

  if (!isLoaded) {
    throw new Error("Attempted to read device identity before storage rehydration completed");
  }

  return mintInstallId(getEnvName());
}

/**
 * The phone's thing name: the MQTT client id AND the topic's sensorId segment.
 * Server-assigned when registered, locally derived (identically) before that.
 */
export function getLocalThingName(): string {
  const identity = getDeviceIdentity();
  return identity.thingName ?? `${MOBILE_THING_PREFIX}${identity.installId}`;
}
