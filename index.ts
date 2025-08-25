/**
 * This module exposes APIs for a dependency container toolbox.
 *
 * @see {@link Token}
 * @see {@link Container}
 *
 * @example
 * ```ts
 * import {Container, Token} from "@sansar/dependency";
 *
 * class PostgresPort extends Token<number> {}
 * class PostgresConnexion extends Token<{}> {} // some conexion API
 *
 * const container = new Container()
 *  .register(PostgresPort, { value: 5432 })
 *
 *  // the resolver will return some expensive postgres connexion object
 *  .register(PostgresConnexion, { resolver: () => ({}) })
 *
 *  // Date is just a normal class (as in nothing to do with Token)
 *  .register(Date, { generator: () => new Date() });
 *
 * container.get(PostgresPort); // 5432
 * container.get(PostgresPort); // 5432
 *
 * container.get(PostgresConnexion); // the initial postgres connexion
 * container.get(PostgresConnexion); // the exact same, initial, postgres connexion
 *
 * container.get(Date); // a date
 * container.get(Date); // another date
 * container.get(Date); // yet another date
 * ```
 *
 * @module
 */

/**
 * A container for:
 *
 * + dependency definition: see {@link Container.register}
 * + dependency retrieval: see {@link Container.get}
 *
 * @class
 */
export class Container {
  readonly #generators = new WeakMap<Class, () => unknown>();
  readonly #resolvers = new WeakMap<Class, () => unknown>();
  readonly #values = new WeakMap<Class, unknown>();

  /**
   * Resolve a value associated with a token or fail trying.
   *
   * + If the definition is a `value`, then return that value
   * + If the definition is a `resolver`, then invoke it, cache
   *   its return value as if registered as a `value` and return
   *   the said value
   * + If the definition is a `generator`, then invoke and return
   *   the invocation result
   * + Otherwise, throw a {@link ContainerUndefinedKeyError}
   *
   * @param key the key to retrieve a dependency value from the {@link Container}
   * @returns the value associated to the given {@linkcode key},
   *          from this {@link Container}
   * @throws {ContainerUndefniedKeyError} if no definition is found.
   */
  get<T>(key: Class<Token<T>> | Class<T>): T {
    if (this.#values.has(key)) return this.#values.get(key) as T;

    if (this.#generators.has(key)) return this.#generators.get(key)!() as T;

    if (this.#resolvers.has(key)) {
      const value = this.#resolvers.get(key)!();
      this.#values.set(key, value);
      return this.#values.get(key) as T;
    }

    throw new ContainerUndefniedKeyError(key);
  }

  /**
   * Register a value generator for the given {@linkcode key}.
   *
   * Dependencies provided through a generator are, well, generated
   * each time they are requested. So two requests might well be distinct
   * values.
   *
   * @example
   * ```ts
   * import { Container } from "@sansar/dependency";
   *
   * class TemplateEngine {}
   *
   * const container = new Container()
   *   .register(TemplateEngine, { generator: () => new TemplateEngine() });
   * ```
   *
   * @example
   * ```ts
   * import { Container, Token } from "@sansar/dependency";
   *
   * class Seed extends Token<number> {}
   *
   * const container = new Container()
   *   .register(Seed, { generator: Math.random });
   * ```
   *
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(
    key: Class<Token<T>> | Class<T>,
    provider: { generator: () => T },
  ): this;
  /**
   * Register a value resolver for the given {@linkcode key}.
   *
   * Dependencies provided through a resolver are, resolved the first time
   * they are requested, and cached. So two requests will return identical.
   *
   * @example
   * ```ts
   * import { Container } from "@sansar/dependency";
   *
   * class TemplateEngine {}
   *
   * const container = new Container()
   *   .register(TemplateEngine, { resolver: () => new TemplateEngine() });
   * ```
   *
   * @example
   * ```ts
   * import { Container, Token } from "@sansar/dependency";
   *
   * class Seed extends Token<number> {}
   *
   * const container = new Container()
   *   .register(Seed, { resolver: Math.random });
   * ```
   *
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(
    key: Class<Token<T>> | Class<T>,
    provider: { resolver: () => T },
  ): this;

  /**
   * Register a settled value for the given {@linkcode key}.
   *
   * Dependencies provided through a value are cached as is and returned each
   * time they are requested.
   *
   * @example
   * ```ts
   * import { Container } from "@sansar/dependency";
   *
   * class TemplateEngine {}
   *
   * const container = new Container()
   *   .register(TemplateEngine, { value: new TemplateEngine() });
   * ```
   *
   * @example
   * ```ts
   * import { Container, Token } from "@sansar/dependency";
   *
   * class Seed extends Token<number> {}
   *
   * const container = new Container()
   *   .register(Seed, { value: Math.random() });
   * ```
   *
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(key: Class<Token<T>> | Class<T>, provider: { value: T }): this;
  register(
    key: Class,
    provider: {
      generator?: () => unknown;
      resolver?: () => unknown;
      value?: unknown;
    },
  ): this {
    if (
      this.#generators.has(key) ||
      this.#resolvers.has(key) ||
      this.#values.has(key)
    )
      throw new ContainerDuplicateKeyError(key);
    if ("value" in provider) this.#values.set(key, provider.value);
    if ("resolver" in provider) this.#resolvers.set(key, provider.resolver!);
    if ("generator" in provider) this.#generators.set(key, provider.generator!);
    return this;
  }
}

/**
 * Base class for errors thrown by the {@link Container} API.
 *
 * @class
 */
export abstract class ContainerError extends Error {}
/**
 * An error thrown when registering a dependency definiton using a key
 * that is was already used on that {@link Container}.
 *
 * @class
 */
export class ContainerUndefniedKeyError extends ContainerError {
  /**
   * Nothing.
   *
   * @param key The key with no definition in the {@link Container}.
   * @param options The option for the error, like another cause
   */
  constructor(key: Class, options?: ErrorOptions) {
    super(`Undefined key registration error: ${key.name}`, options);
  }
}
/**
 * An error thrown when registering a dependency definiton using a key
 * that is was already used on that {@link Container}.
 *
 * @class
 */
export class ContainerDuplicateKeyError extends ContainerError {
  /**
   * Nothing.
   *
   * @param key The key with existing definition in the {@link Container}.
   * @param options The option for the error, like another cause
   */
  constructor(key: Class, options?: ErrorOptions) {
    super(`Duplicate key registration error: ${key.name}`, options);
  }
}

const token: symbol = Symbol();
/**
 * A base class to capture unique token with its type.
 *
 * Note that you cannot invoke a token constructor.
 *
 * @class
 */
export class Token<T = unknown> {
  /**
   * Nothing.
   *
   * @deprecated
   */
  readonly [token]: T | undefined;

  /** @deprecated */
  constructor() {
    throw new Error("Cannot instantiate.");
  }
}

type Class<T = unknown, A extends unknown[] = unknown[]> = {
  new (...args: A): T;
};
