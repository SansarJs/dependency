export class Container {
  readonly #values = new WeakMap<Class, unknown>();

  get<T>(key: Class<Token<T>>): T;
  get<T>(key: Class<T>): T;
  get<T>(key: Class<Token<T>> | Class<T>): T {
    throw -1;
  }

  register<T>(key: Class<Token<T>>, provider: { value: T }): this;
  register<T>(key: Class<T>, provider: { value: T }): this;
  register(key: Class, provider: { value: unknown }): this {
    return this;
  }
}

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
