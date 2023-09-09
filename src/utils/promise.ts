type CachedPromise<T> = Promise<T> & {
  status?: "loading" | "loaded";
  value?: T;
};

export function cached<T>(promise: Promise<T>): CachedPromise<T> {
  const cachedPromise = promise as CachedPromise<T>;
  if (!cachedPromise.status) {
    cachedPromise.status = "loading";
    promise.then((value) => {
      cachedPromise.status = "loaded";
      cachedPromise.value = value;
    });
  }
  return cachedPromise;
}
