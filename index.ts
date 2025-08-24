export class Container {
  readonly #values = new WeakMap<Class, unknown>();

  get<T>(key: Class<Token<T>> | Class<T>): T {
    if (this.#values.has(key)) return this.#values.get(key) as T;
    throw -1;
  }

  register<T>(key: Class<Token<T>>, provider: Provider<T>): this;
  register<T>(key: Class<T>, provider: Provider<T>): this;
  register(key: Class, provider: Provider): this {
    if (this.#values.has(key)) throw new ContainerDuplicateKeyError(key);
    if ("value" in provider) this.#values.set(key, provider.value);
    return this;
  }
}

export type Provider<T = unknown> = { resolver: () => T } | { value: T };

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
