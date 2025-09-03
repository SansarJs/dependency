import { getAssertionState } from "jsr:@std/internal@^1.0.10/assertion-state";

const scopes = new WeakMap<object, symbol>();
const injects = new WeakMap<object, ({ (): Class } | Class)[]>();

/**
 * Applied on an @{@link Inject}( ...tokens ) decorated class to mark the scope
 * on which the target class instance will be cached.
 *
 * > It is a Stage 3 EcmaScript-compliant decorator (so not the old
 * > TypeScript). The distinction is important as there is no `reflect-metadata`
 * > support for true and full Inversion of COntrol (IoC). So go for the next
 * > best thing.
 *
 * ```ts
 * import {Container, Inject, Scope} from "@sansar/dependency";
 *
 * const HTTP_REQUEST = Symbol("HTTP_REQUEST");
 *
 * @Scope( HTTP_REQUEST )
 * @Inject()
 * class A {}
 *
 * const root = new Container();
 * const parent = new Container({ scope: HTTP_REQUEST, parent: root });
 * const container = new Container( parent );
 *
 * const a = container.get( A );
 *
 * a instanceof A; // true
 * a === container.get( A ); // true
 * a === parent.get( A ); // true
 * // root.get( A ); // throw ContainerUndefinedScopeError
 * ```
 *
 * > **NOTE:** Injected values are cached on the container with matching scope.
 */
export function Scope(
  scope: symbol,
): (_: Class, ctx: ClassDecoratorContext) => void {
  return function (_: Class, ctx: ClassDecoratorContext) {
    ctx.addInitializer(function () {
      if (!injects.has(this)) throw new ScopeInjectUsageError(this as Class);
      if (scopes.has(this)) throw new ScopeDuplicationError(this as Class);
      scopes.set(this, scope);
    });
  };
}

/**
 * A base class for {@link Scope}-related errors.
 *
 * @class
 */
export abstract class ScopeError extends Error {}
/**
 * An error thrown when @{@link Scope}( scope ) is used without or after an
 * @{@link Inject}( ...token ) decorator.
 *
 * @class
 */
export class ScopeInjectUsageError extends ScopeError {
  /**
   * Nothing.
   *
   * @param ctor The class on which @{@link Scope} without @{@link Inject}
   * @param options The option for the error, like another cause
   */
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
/**
 * An error thrown when @{@link Scope}( scope ) decorator is applied multiple
 * on the same class.
 *
 * @class
 */
export class ScopeDuplicationError extends ScopeError {
  /**
   * Nothing.
   *
   * @param ctor The class on which @{@link Scope}( scope ) was applied more
   *             than once
   * @param options The option for the error, like another cause
   */
  constructor(
    readonly ctor: Class,
    options?: ErrorOptions,
  ) {
    super(`@Scope() is already applied on ${ctor}`, options);
  }
}

/**
 * A class decorator to capture a class constructor's dependency tokens.
 *
 * > It is a Stage 3 EcmaScript-compliant decorator (so not the old
 * > TypeScript). The distinction is important as there is no `reflect-metadata`
 * > support for true and full Inversion of COntrol (IoC). So go for the next
 * > best thing.
 *
 * ```ts
 * import {Container, Inject, Token} from "@sansar/dependency";
 *
 * @Inject()
 * class A {}
 *
 * @Inject(A, () => C)
 * class B {
 *   constructor(readonly a: A, readonly c: 'C' | 'c') {}
 * }
 *
 * class C extends Token<'C' | 'c'> {}
 *
 * const container = new Container();
 * const b = container
 *   .register( C, { generator: (): 'C' => 'C' })
 *   .get( B );
 *
 * b instanceof B; // true
 * b.a instanceof A; // true
 * b.a === container.get( A ); // true
 * 'C' === b.c; // true
 * b.c === container.get( C ); // true
 * ```
 *
 * > **NOTE:** Unless @{@link Scope}d, injected values
 * > are cached on the root container.
 *
 * @param tokens The tokens ({@link Token} subclasses, any class or an arrow
 *               function returning the previous, useful for foward
 *               reference) to resolve dependencies to be injected at
 *               construction time.
 */
export function Inject<T extends ({ (): Class } | Class)[]>(
  ...tokens: T
): (_: Class, ctx: ClassDecoratorContext) => void {
  return function (_: Class<unknown, Args<T>>, ctx: ClassDecoratorContext) {
    ctx.addInitializer(function () {
      if (injects.has(this)) throw new InjectDuplicationError(this as Class);
      injects.set(this, tokens);
    });
  };
}

/**
 * A base class for {@link Inject}-related errors.
 *
 * @class
 */
export abstract class InjectError extends ScopeError {}
/**
 * An error thrown when {@link Inject}ed class resolution through
 * {@link Container#get} leads to a chicken-egg situation.
 *
 * @class
 */
export class InjectCircularDependencyError extends InjectError {
  /**
   * Nothing.
   *
   * @param chain The list, chicken-to-chicken of the chain leading to circling
   * @param target The class on which @{@link Inject} was applied
   * @param options The option for the error, like another cause
   */
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
/**
 * An error thrown when {@link Container#get} resolves an {@link Inject}ed class
 * is but some dependencies are misisng (no definition found).
 *
 * @class
 */
export class InjectMissingDependencyError extends InjectError {
  /**
   * Nothing.
   *
   * @param dependency The missing dependency token
   * @param target The target class which dependencies were being reasolved
   * @param index The paramater index of the missing dependency token
   * @param options The option for the error, like another cause
   */
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
/**
 * An error thrown when @{@link Inject}(...tokens) is
 * used multiple times on a class.
 *
 * @class
 */
export class InjectDuplicationError extends InjectError {
  /**
   * Nothing.
   *
   * @param ctor The class on which @i{@link Inject} was applied more than once
   * @param options The option for the error, like another cause
   */
  constructor(
    readonly ctor: Class,
    options?: ErrorOptions,
  ) {
    super(`@Inject() is already applied on ${ctor}.`, options);
  }
}

/**
 * Extract/Resolve a constructor parameter types from a list of token classes or
 * token resolvers.
 */
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
  readonly #generators = new WeakMap<
    Class,
    (ctx: Context<unknown>) => unknown
  >();
  readonly #resolvers = new WeakMap<
    Class,
    (ctx: Context<unknown>) => unknown
  >();
  readonly #onDestroyHooks = new WeakMap<Class, { (value: unknown): void }>();
  readonly #creating = [] as { target?: Class; index?: number }[];
  readonly #values = new WeakMap<Class, unknown>();
  readonly #scopes = new WeakMap<Class, symbol>();
  readonly #onDestroy: { (): void }[] = [];
  readonly #parent?: Container;
  readonly #scope?: symbol;
  #disposed = false;

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
    if (parent) parent.#onDestroy.push(() => this[Symbol.dispose]());
    this.#parent = parent;
    this.#scope = scope;
  }

  /**
   * Dispose of the container and its related dependencies.
   */
  [Symbol.dispose]() {
    this.#disposed = true;
    for (const onDestroy of this.#onDestroy) onDestroy();
    this.#onDestroy.splice(0);
  }

  /**
   * Disposed status of the container.
   */
  get disposed() {
    return this.#disposed;
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
    if (this.#values.has(key)) {
      const value = this.#values.get(key);
      // NOTE: no need to check & schedule registered onDestroy hook for {value}
      if (Container.#isDisposable(value))
        this.#onDestroy.push(() => value[Symbol.dispose](value));

      return value as T;
    }

    if (this.#generators.has(key)) {
      const scope = this.#scopes.get(key);
      const scoped = scope ? invocation.#scoped(scope) : void 0;
      const value = this.#generators.get(key)!({
        onDestroy: (hook) =>
          (scoped ?? this).#onDestroy.push(() => hook(value)),
        invocationContainer: invocation,
        scopeContainer: scoped,
        scope,
      }) as T;

      const hook = this.#onDestroyHooks.get(key);
      if (hook) (scoped ?? this).#onDestroy.push(() => hook(value));
      if (Container.#isDisposable(value))
        (scoped ?? this).#onDestroy.push(() => value[Symbol.dispose](value));

      return value;
    }

    if (this.#resolvers.has(key)) {
      const scope = this.#scopes.get(key);
      const scoped = scope ? invocation.#scoped(scope) : void 0;
      const value = this.#resolvers.get(key)!({
        onDestroy: (hook) =>
          (scoped ?? this).#onDestroy.push(() => hook(value)),
        invocationContainer: invocation,
        scopeContainer: scoped,
        scope,
      }) as T;

      (scoped ?? this).#values.set(key, value);
      const hook = this.#onDestroyHooks.get(key);
      if (hook) (scoped ?? this).#onDestroy.push(() => hook(value));
      if (Container.#isDisposable(value))
        (scoped ?? this).#onDestroy.push(() => value[Symbol.dispose](value));
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

      // Resolve dependencies
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

      // Resolve target
      const scoped = scopes.has(key)
        ? invocation.#scoped(scopes.get(key)!)
        : void 0;
      try {
        value = Reflect.construct(key as Class, args) as T;
      } finally {
        invocation.#creating.pop();
      }

      (scoped ?? this).#values.set(key, value);
      if (Container.#isDisposable(value))
        (scoped ?? this).#onDestroy.push(() => value[Symbol.dispose](value));

      return value as T;
    }

    throw new ContainerUndefinedKeyError(key);
  }

  static #isDisposable(
    value: unknown,
  ): value is { [Symbol.dispose](value: unknown): void } {
    return (
      !!value &&
      "object" === typeof value &&
      Symbol.dispose in value &&
      "function" === typeof value[Symbol.dispose]
    );
  }

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
    provider: {
      scope?: symbol;
      onDestroy?: { (value: Arg<T>): void };
      generator: (ctx: Context<T>) => Arg<T>;
    },
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
    provider: {
      scope?: symbol;
      onDestroy?: { (value: Arg<T>): void };
      resolver: (ctx: Context<T>) => Arg<T>;
    },
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
  register<T>(
    key: Class<T>,
    provider: {
      value: Arg<T>;
      onDestroy?: { (value: Arg<T>): void };
    },
  ): this;
  register(
    key: Class,
    provider: {
      generator?: (ctx: Context<unknown>) => unknown;
      resolver?: (ctx: Context<unknown>) => unknown;
      onDestroy?: { (value: unknown): void };
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

    if ("value" in provider) {
      this.#values.set(key, provider.value);
      if (provider.onDestroy)
        this.#onDestroy.push(() => provider.onDestroy?.(provider.value));
    }
    if ("resolver" in provider) this.#resolvers.set(key, provider.resolver!);
    if ("generator" in provider) this.#generators.set(key, provider.generator!);
    if (provider.onDestroy) this.#onDestroyHooks.set(key, provider.onDestroy);

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
 * The context passed to `resolver`s and `generator`s when {@link Container#get}
 * is invoked.
 */
export interface Context<T> {
  /**
   * A hook register of hooks for when the container is destroyed.
   *
   * @param hook The destruction hook for the container dependency.
   */
  onDestroy(hook: (value: T) => void): void;
  /**
   * The invocation container.
   */
  invocationContainer: Container;
  /**
   * The scope container, when scoped.
   */
  scopeContainer?: Container;
  /**
   * The scope of the dependency, when applicable.
   */
  scope?: symbol;
}

/**
 * Capture constructor signature.
 */
export type Class<T = unknown, A extends unknown[] = any[]> = {
  new (...args: A): T;
};

/**
 * Extract/Resolve the target type expected from a token, where T is the return
 * type of a constructor signature.
 */
export type Arg<T> = T extends Token<infer I>
  ? I
  : T extends Boolean
    ? boolean
    : T extends Number
      ? number
      : T extends String
        ? string
        : T;
