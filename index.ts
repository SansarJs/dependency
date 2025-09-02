const scopes = new WeakMap<object, symbol>();
const injects = new WeakMap<object, ({ (): Class } | Class)[]>();

export function Scope(scope: symbol) {
  return function (_: Class, ctx: ClassDecoratorContext) {
    ctx.addInitializer(function () {
      if (!injects.has(this)) throw new ScopeInjectUsageError(this as Class);
      if (scopes.has(this)) throw new ScopeDuplicationError(this as Class);
      scopes.set(this, scope);
    });
  };
}

export class ScopeError extends Error {}
export class ScopeInjectUsageError extends ScopeError {
  constructor(
    readonly ctor: Class,
    options?: ErrorOptions,
  ) {
    super(
      `@Scope() is applied without or after @Inject(), on ${ctor}.`,
      options,
    );
  }
}
export class ScopeDuplicationError extends ScopeError {
  constructor(
    readonly ctor: Class,
    options?: ErrorOptions,
  ) {
    super(`@Scope() is already applied on ${ctor}`, options);
  }
}

export function Inject<T extends ({ (): Class } | Class)[]>(...tokens: T) {
  return function (_: Class<unknown, Args<T>>, ctx: ClassDecoratorContext) {
    ctx.addInitializer(function () {
      if (injects.has(this)) throw new InjectDuplicationError(this as Class);
      injects.set(this, tokens);
    });
  };
}

export class InjectError extends ScopeError {}
export class InjectCircularDependencyError extends InjectError {
  constructor(
    readonly chain: { index?: number; target: Class }[],
    readonly target: Class,
    options?: ErrorOptions,
  ) {
    super(
      `Circular dependencies detected while resolving dependencies of #${target}`,
      options,
    );
  }
}
export class InjectMissingDependencyError extends InjectError {
  constructor(
    readonly dependency: Class,
    readonly target: Class,
    readonly index: number,
    options?: ErrorOptions,
  ) {
    super(
      `Missing dependency #${index} while resolving dependencies for #${target}`,
      options,
    );
  }
}
export class InjectDuplicationError extends InjectError {
  constructor(
    readonly ctor: Class,
    options?: ErrorOptions,
  ) {
    super(`@Inject() is already applied on ${ctor}.`, options);
  }
}

export type Args<T, A extends unknown[] = []> = T extends [
  () => Class<Token<infer I>>,
  ...infer R,
]
  ? Args<R, [...A, I]>
  : T extends [() => Class<Boolean>, ...infer R]
    ? Args<R, [...A, boolean]>
    : T extends [() => Class<Number>, ...infer R]
      ? Args<R, [...A, number]>
      : T extends [() => Class<String>, ...infer R]
        ? Args<R, [...A, string]>
        : T extends [() => Class<infer I>, ...infer R]
          ? Args<R, [...A, I]>
          : T extends [Class<Token<infer I>>, ...infer R]
            ? Args<R, [...A, I]>
            : T extends [Class<Boolean>, ...infer R]
              ? Args<R, [...A, boolean]>
              : T extends [Class<Number>, ...infer R]
                ? Args<R, [...A, number]>
                : T extends [Class<String>, ...infer R]
                  ? Args<R, [...A, string]>
                  : T extends [Class<infer I>, ...infer R]
                    ? Args<R, [...A, I]>
                    : A;

/**
 * A container for:
 *
 * + dependency definition: see {@link Container#register}
 * + dependency retrieval: see {@link Container#get}
 *
 * @class
 */
export class Container {
  readonly #generators = new WeakMap<Class, () => unknown>();
  readonly #resolvers = new WeakMap<Class, () => unknown>();
  readonly #values = new WeakMap<Class, unknown>();
  readonly #scopes = new WeakMap<Class, symbol>();
  readonly #parent?: Container;
  readonly #scope?: symbol;

  /**
   * A container constructor.
   *
   * @param parent an optional parent {@link Container} or configuration object
   *        with optional parent {@link Container} and scope {@link symbol}.
   */
  constructor(
    parentOrConfig?: Container | { parent?: Container; scope?: symbol },
  ) {
    const parent =
      parentOrConfig instanceof Container
        ? parentOrConfig
        : parentOrConfig?.parent;
    const scope =
      parentOrConfig instanceof Container ? void 0 : parentOrConfig?.scope;

    if (scope) {
      let scoped = parent;
      while (scoped)
        if (scoped.#scope === scope)
          throw new ContainerDuplicateScopeError(scope);
        else scoped = scoped.#parent;
    }
    this.#parent = parent;
    this.#scope = scope;
  }

  /**
   * Resolve a value associated with a token or fail trying.
   *
   * + If the definition is a `value`, then return that value
   * + If the definition is a `resolver`, then invoke it, cache
   *   its return value as if registered as a `value` and return
   *   the said value
   * + If the definition is a `generator`, then invoke and return
   *   the invocation result
   * + If the container has a parent, fallback to its parent
   * + Otherwise, throw a {@link ContainerUndefinedKeyError}
   *
   * @param key the key to retrieve a dependency value from the {@link Container}
   * @returns the value associated to the given {@linkcode key},
   *          from this {@link Container}
   * @throws {ContainerUndefinedKeyError} if no definition is found.
   */
  get<T>(key: Class<Token<T>> | Class<T>): T {
    return this.#get(key, this);
  }

  #get<T>(key: Class<Token<T>> | Class<T>, invocation: Container): T {
    if (this.#values.has(key)) return this.#values.get(key) as T;

    if (this.#generators.has(key)) {
      const scope = this.#scopes.get(key);
      const _scoped = scope ? invocation.#scoped(scope) : this;
      return this.#generators.get(key)!() as T;
    }

    if (this.#resolvers.has(key)) {
      const scope = this.#scopes.get(key);
      const scoped = scope ? invocation.#scoped(scope) : this;
      const value = this.#resolvers.get(key)!() as T;

      scoped.#values.set(key, value);
      return value;
    }

    if (this.#parent) return this.#parent.#get(key, invocation);
    if (injects.has(key)) {
      // Detect & handle circular dependencies
      if (invocation.#creating.some(({ target }) => key === target)) {
        const chain = invocation.#creating.map((_) => ({
          ..._,
          target: _.target ?? key,
        }));
        invocation.#creating.splice(0);
        throw new InjectCircularDependencyError(chain, key);
      }

      let value: T;
      const args: unknown[] = [];
      const tokens = injects.get(key)!;

      // Register the target (should be first) in #creating)
      if (!invocation.#creating.length)
        invocation.#creating.push({ target: key });
      else if (!invocation.#creating.at(-1)?.target)
        invocation.#creating.at(-1)!.target = key;

      for (let i = 0, l = tokens.length; i < l; i++) {
        const token =
          false ===
          Reflect.getOwnPropertyDescriptor(tokens[i], "prototype")?.writable
            ? (tokens[i] as Class)
            : (tokens[i] as () => Class)();
        // Register the target's dependency
        invocation.#creating.push({ index: i });

        try {
          args.push(invocation.#get(token, invocation));
          invocation.#creating.pop();
        } catch (err) {
          invocation.#creating.splice(0);

          if (err instanceof ContainerUndefinedKeyError)
            throw new InjectMissingDependencyError(token, key, i, {
              cause: err,
            });
          throw err;
        }
      }

      try {
        value = Reflect.construct(key as Class, args) as T;
      } finally {
        invocation.#creating.pop();
      }
      this.#values.set(key, value);
      return value as T;
    }

    throw new ContainerUndefinedKeyError(key);
  }
  readonly #creating = [] as { target?: Class; index?: number }[];

  #scoped(scope: symbol): Container {
    let container = this as undefined | Container;
    while (container && scope !== container.#scope)
      container = container.#parent;
    if (!container) throw new ContainerUndefinedScopeError(scope);
    return container;
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
   * import { Container, Token } from "@sansar/dependency";
   *
   * class Seed extends Token<number> {}
   *
   * const container = new Container()
   *   .register(Seed, { generator: Math.random });
   * ```
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
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(
    key: Class<T>,
    provider: { generator: () => Arg<T>; scope?: symbol },
  ): this;
  /**
   * Register a value resolver for the given {@linkcode key}.
   *
   * Dependencies provided through a resolver are, resolved the first time
   * they are requested, and cached. So two requests will return identical.
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
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(
    key: Class<T>,
    provider: { resolver: () => Arg<T>; scope?: symbol },
  ): this;
  /**
   * Register a settled value for the given {@linkcode key}.
   *
   * Dependencies provided through a value are cached as is and returned each
   * time they are requested.
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
   * @returns the {@link Container} instance on which the method is invoked
   * @throws {ContainerDuplicateKeyError} if the key is already matched to a
   *         definition on this container
   */
  register<T>(key: Class<T>, provider: { value: Arg<T> }): this;
  register(
    key: Class,
    provider: {
      generator?: () => unknown;
      resolver?: () => unknown;
      value?: unknown;
      scope?: symbol;
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

    if (
      ("resolver" in provider || "generator" in provider) &&
      "scope" in provider
    )
      this.#scopes.set(key, provider.scope!);

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
export class ContainerUndefinedKeyError extends ContainerError {
  /**
   * Nothing.
   *
   * @param key The key with no definition in the {@link Container}.
   * @param options The option for the error, like another cause
   */
  constructor(
    readonly key: Class,
    options?: ErrorOptions,
  ) {
    super(`Undefined key registration error: ${key.name}`, options);
  }
}
/**
 * An error thrown when resolving a dependency definiton using a scoped
 * key but no such scope was found in the {@link Container} tree.
 *
 * @class
 */
export class ContainerUndefinedScopeError extends ContainerError {
  /**
   * Nothing.
   *
   * @param scope The scope which already exists in the {@link Container}'s ancestry.
   * @param options The option for the error, like another cause
   */
  constructor(
    readonly scope: symbol,
    options?: ErrorOptions,
  ) {
    super(`Undefined scope error error: ${String(scope)}`, options);
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
  constructor(
    readonly key: Class,
    options?: ErrorOptions,
  ) {
    super(`Duplicate key registration error: ${key.name}`, options);
  }
}
/**
 * An error thrown when creating a scoped {@link Container} but the same scope
 * already exists in its ancestry.
 *
 * @class
 */
export class ContainerDuplicateScopeError extends ContainerError {
  /**
   * Nothing.
   *
   * @param scope The scope which already exists in the {@link Container}'s ancestry.
   * @param options The option for the error, like another cause
   */
  constructor(
    readonly scope: symbol,
    options?: ErrorOptions,
  ) {
    super(`Duplicate scope error: ${String(scope)}`, options);
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

/**
 * Capture constructor signature.
 */
export type Class<T = unknown, A extends unknown[] = any[]> = {
  new (...args: A): T;
};

export type Arg<T> = T extends Token<infer I>
  ? I
  : T extends Boolean
    ? boolean
    : T extends Number
      ? number
      : T extends String
        ? string
        : T;
