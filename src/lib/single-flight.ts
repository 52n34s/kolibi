/**
 * Runs `task` once per key at a time: a call for a key whose task is still
 * running gets the running promise instead of starting a second one.
 */
export function createSingleFlight<T>() {
  const running = new Map<string, Promise<T>>();

  return function run(key: string, task: () => Promise<T>): Promise<T> {
    const current = running.get(key);
    if (current) {
      return current;
    }
    const promise = Promise.resolve().then(task);
    running.set(key, promise);
    const clear = () => {
      if (running.get(key) === promise) {
        running.delete(key);
      }
    };
    promise.then(clear, clear);
    return promise;
  };
}
