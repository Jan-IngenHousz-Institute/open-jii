# TSR Error Handling

Mutation hooks use utility types from `~/lib/tsr` to handle API errors in a type-safe way.

## Types

| Type / Helper | Purpose |
|---|---|
| `TsrRoute<T>` | Extracts the route type from a `tsr.*.useMutation` accessor |
| `ContractError<TRoute>` | Typed union of all error responses declared in the contract |
| `TsRestMutationOptions<TRoute, TKeys>` | Typed mutation options — `onError` receives `ContractError` instead of `unknown` |
| `getContractError(route, error)` | Returns a typed `ContractError`, or `undefined` for non-contract errors (network, crash) |

## Pattern

```ts
const route = tsr.<resource>.<action>;

export type UseXxxOptions = TsRestMutationOptions<TsrRoute<typeof route>, "onSuccess" | "onError">;

export function useXxx(options?: UseXxxOptions) {
  return route.useMutation({
    ...options,
    onError: (error, ...rest) => {
      const contractError = getContractError(route, error);

      if (!contractError) {
        // network failure / unexpected exception
        toast(t("common.errors.serverError"));
        return;
      }

      switch (contractError.status) {
        case 409: toast(t("resource.specificError")); break;
        default:  toast(t("resource.genericError")); break;
      }

      options?.onError?.(contractError, ...rest); // forward typed error to caller
    },
  });
}
```
