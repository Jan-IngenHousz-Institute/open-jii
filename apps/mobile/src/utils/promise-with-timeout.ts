export function promiseWithTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Timed out"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
