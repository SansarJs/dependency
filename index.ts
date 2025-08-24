export class Container {
  readonly #generators = new WeakMap<Class, () => unknown>();
  readonly #resolvers = new WeakMap<Class, () => unknown>();
  readonly #values = new WeakMap<Class, unknown>();

  get<T>(key: Class<Token<T>> | Class<T>): T {
    if (this.#values.has(key)) return this.#values.get(key) as T;

    if (this.#generators.has(key)) return this.#generators.get(key)!() as T;

    if (this.#resolvers.has(key)) {
      const value = this.#resolvers.get(key)!();
      this.#values.set(key, value);
      return this.#values.get(key) as T;
    }
    throw -1;
  }

  register<T>(key: Class<Token<T>>, provider: Provider<T>): this;
  register<T>(key: Class<T>, provider: Provider<T>): this;
  register(key: Class, provider: Provider): this {
    if (
      this.#generators.has(key) ||
      this.#resolvers.has(key) ||
      this.#values.has(key)
    )
      throw new ContainerDuplicateKeyError(key);
    if ("value" in provider) this.#values.set(key, provider.value);
    if ("resolver" in provider) this.#resolvers.set(key, provider.resolver);
    if ("generator" in provider) this.#generators.set(key, provider.generator);
    return this;
  }
}

export type Provider<T = unknown> =
  | { generator: () => T }
  | { resolver: () => T }
  | { value: T };

export abstract class ContainerError extends Error {}
export class ContainerDuplicateKeyError extends ContainerError {
  constructor(key: Class, options?: { cause?: unknown }) {
    super(`Duplicate key registration error: ${key.name}`, options);
  }
}

type Class<T = unknown, A extends unknown[] = unknown[]> = {
  new (...args: A): T;
};

const token = Symbol();
export class Token<T = unknown> {
  readonly [token]: T | undefined;

  constructor() {
    throw new Error("Cannot instantiate.");
  }
}
