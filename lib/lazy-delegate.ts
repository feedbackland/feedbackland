/** Temporary legacy SDK boundary. Factories run only on first property access. */
export function lazyDelegate<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const methods = new Map<PropertyKey, { original: unknown; bound: unknown }>();
  const get = () => (instance ??= factory()); // A thrown factory is retried.
  return new Proxy({} as T, {
    get(_target, key) {
      const owner = get();
      const value = Reflect.get(owner, key, owner);
      if (typeof value !== "function") return value;
      const cached = methods.get(key);
      if (cached?.original === value) return cached.bound;
      const bound = value.bind(owner);
      methods.set(key, { original: value, bound });
      return bound;
    },
    set(_target, key, value) {
      const owner = get();
      return Reflect.set(owner, key, value, owner);
    },
    has(_target, key) {
      return key in get();
    },
  });
}
