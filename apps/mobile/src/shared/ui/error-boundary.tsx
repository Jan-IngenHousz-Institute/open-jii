import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      "[ErrorBoundary] render error",
      {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      },
      { error, info },
    );
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View className="bg-background flex-1 p-6">
        <Text className="text-destructive mb-2 text-xl font-bold">Something broke</Text>
        <Text className="text-muted-foreground mb-4 text-sm">{error.message}</Text>
        <ScrollView className="bg-surface mb-4 max-h-96 rounded-lg p-3">
          <Text className="text-onSurface text-xs" selectable>
            {error.stack}
          </Text>
          {info?.componentStack ? (
            <Text className="text-onSurface mt-3 text-xs" selectable>
              {info.componentStack}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable className="bg-primary rounded-lg px-6 py-3" onPress={this.reset}>
          <Text className="text-onPrimary text-center font-semibold">Try again</Text>
        </Pressable>
      </View>
    );
  }
}

let installed = false;

/**
 * Catches errors that ErrorBoundary cannot: uncaught JS exceptions outside
 * the React tree (async callbacks, event listeners, native bridge calls)
 * and unhandled promise rejections. Logs full stack so a stray
 * `.length of undefined` shows where it originates.
 */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  const errorUtils = (
    global as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;

  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error("[GlobalError]", {
        isFatal,
        message: error?.message,
        stack: error?.stack,
      });
      previous(error, isFatal);
    });
  }

  const hermes = (
    global as unknown as {
      HermesInternal?: {
        enablePromiseRejectionTracker?: (opts: {
          allRejections: boolean;
          onUnhandled: (id: number, error: unknown) => void;
          onHandled: (id: number) => void;
        }) => void;
      };
    }
  ).HermesInternal;

  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (id, error) => {
      const e = error as { message?: string; stack?: string } | undefined;
      console.error("[UnhandledRejection]", {
        id,
        message: e?.message ?? String(error),
        stack: e?.stack,
      });
    },
    onHandled: (id) => {
      console.warn("[UnhandledRejection] later handled", { id });
    },
  });
}
