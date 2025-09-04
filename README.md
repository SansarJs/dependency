# @sansar/dependency

A lightweight, TypeScript-native dependency injection (DI) library for modern
JavaScript environments. It supports inversion of control (IoC) with decorators,
scoped dependencies, and flexible registration strategies (values, resolvers,
generators). Built with Stage 3 ECMAScript decorators in mind, it cannot [yet]
rely on reflect-metadata for true IoC.



## Features

+ [x] **Decorator-Based Injection:** Use `@Inject()` and `@Scope()` for
  declarative dependency management
+ [x] **Functional Style Providers:** Register dependencies as static values,
  lazy resolvers, or dynamic generators on `Container`s
+ [x] **Scoped Dependencies:** Cache instances per scope (e.g., request-scoped
  services)
+ [x] **Circular Dependency Detection:** Automatically detects and throws errors
  on cycles
+ [x] **Token-Based Abstractions:** Use `Token` subclasses for type-safe
  abstract dependencies
+ [x] **Hierarchical Containers:** Support nested containers for modular
  applications
+ [x] **Error Handling:** Descriptive errors for undefined keys, duplicate
  registrations, missing dependencies, and more
+ [x] **No External Dependencies**
+ [ ] `Token` default values
+ [x] Containers as resources, and dependencies with disposal hooks
+ [x] Context as parameters to `resolver` and `generator` defintion functions
+ [ ] Support a `Configuration` abstraction for defining, importing & excluding
  some sets of dependency definitions (think a full set of configuration for
  Redis, Datadog, logging, etc)
+ [ ] Introduce properties, environments, conditional dependency definitions




## Installation

```bash
# Deno
deno add jsr:@sansar/dependency

# PNPM
pnpm i jsr:@sansar/dependency

# YARN
yarn add jsr:@sansar/dependency

# VLT
vlt install jsr:@sansar/dependency

# NPM
npx jsr add @sansar/dependency

# Bun
bunx jsr add @sansar/dependency
```



## Quick Start

### Basic Injection

Define and inject dependencies:
```ts
import { Container, Inject } from "@sansar/dependency";

@Inject()
class Logger {
  log(message: string) {
    console.log( message );
  }
}

@Inject( Logger )
class Service {
  constructor(readonly logger: Logger) {}
}

const container = new Container();
const service = container.get( Service );

service.logger.log( "Hello, DI!" ); // Outputs: Hello, DI!
```

### Using Tokens for Abstractions

Tokens allow injecting interfaces or abstract types:
```ts
import { Container, Inject, Token } from "@sansar/dependency";

class LogLevel extends Token<"debug" | "info" | "error"> {}

@Inject( LogLevel )
class Logger {
  constructor(readonly level: "debug" | "info" | "error") {}
}

const container = new Container()
  .register( LogLevel, { value: "info" } );
const logger = container.get( Logger );

console.log( logger.level ); // Outputs: info
```

### Scoped Dependencies

Scope instances to specific containers (e.g., per HTTP request):
```ts
import { Container, Inject, Scope } from "@sansar/dependency";

const REQUEST_SCOPE = Symbol("REQUEST");

@Scope( REQUEST_SCOPE )
@Inject()
class RequestService {}

const root = new Container();
const requestContainer = new Container({ scope: REQUEST_SCOPE, parent: root });
const someOtherContainer = new Container( requestContainer );

const service1 = someOtherContainer.get( RequestService );
const service2 = requestContainer.get( RequestService );

console.log(service1 === service2); // true (cached in scoped container)
```


## Concepts

### `Container`

The core class for registering and resolving dependencies.

+ Registration:
  + `register(key, { value })`: Provides a static value.
  + `register(key, { resolver: () => value })`: Lazily resolves and caches the
    value.
  + `register(key, { generator: () => value })`: Generates a new value on each
    request.
  + Optional `scope` for scoped _resolver/generator_ caching.
+ Resolution:
  + `get(key)`: Retrieves the dependency, falling back to parent containers if
    needed.

> **NOTE:** `Container`s can be nested, forming a hierarchy for modular apps.

### Token

A base class for type-safe tokens. Extend it to represent abstract dependencies:
```ts
import { Token } from "@sansar/dependency";

class DatabaseUrl extends Token<string> {}
```

> **NOTE:** `Token`s cannot be instantiated.

### `@Inject(...tokens)`

A class decorator to declare constructor dependencies.
Supports forward references via arrow functions.
+ Throws `InjectDuplicationError` if applied multiple times.
+ Throws `InjectMissingDependencyError` or `InjectCircularDependencyError` on
  resolution issues.

### `@Scope(scope: symbol)`

Marks a class for scoped caching. Must be used with @Inject() and applied before
it.
+ Throws `ScopeDuplicationError` if applied multiple times.
+ Throws `ScopeInjectUsageError` if misused with `@Inject()`.
+ Resolution throws `ContainerUndefinedScopeError` if no matching scope exists.



## Advanced Usage

### Hierarchical and Scoped Resolution

Dependencies resolve from the invoking container, caching at the appropriate
level:
```ts
import { Container } from "@sansar/dependency";

const APP_SCOPE = Symbol( "APP" );

const root = new Container({ scope: APP_SCOPE });
root.register( Date, { resolver: () => new Date(), scope: APP_SCOPE } );

const child = new Container( root );
console.log(child.get( Date ) === root.get(Date)); // true
```

### Forward References:

When a token is defined later than its usage, leverage forward reference:
```ts
import { Container, Inject } from "@sansar/dependency";

@Inject(() => B)
class A {
  constructor(readonly b: B) {}
}

@Inject()
class B {}

console.log(new Container().get( A ) instanceof A); // true
console.log(new Container().get( A ).b instanceof B); // true
```

### Resources Management

The `Container` class is EcmaScript-compliant by implementing the
`[Symbol.dispose]` method. Futhermore, any dependency object, whether a static
value, injected, resolver- or generator-based, that implements the
`[Symbol.dispose]` method will be invoked when the container resource is cleaned
up.

I case you do control the dependent value implementation, you can:
+ pass an `onDestroy` callback to the dependency provider when registering it
+ call `onDestroy( hook )` with your disposal hook yourself from the `Context`
  object passed to `resolver`s and `generator`s.

> **NOTE:** A dependency lifecycle is tied to its related container lifetime.
> This is relevant for scoped dependencies which are tied to the contained with
> the matching scope.

> **NOTE:** When a container is disposed, it propagates to descendant
> containers. We hope this helps preventing some weird inconsistencies.

```ts
import { Container, Inject, Token } from "@sansar/dependency";

class A extends Token<number> {}

class B {}

@Inject(A, B)
class C {
  [Symbol.dispose]() {/* 1 */}
}

const scope = Symbol();
const root = new Container()
  .register(A, { value: Math.PI, onDestroy() {/* 2 */} })
  .register(B, {
    scope,
    resolver: ctx => {
      ctx.onDestroy(bValue => {/* 3 */})
      return Math.random();
    }});
const container = new Container({ scope, parent: root });

container.get( C );
(() => { using _ = container; });
// when container goes out of scope, its [Symbol.dispose] is called
// so it the B instance cached there, through the #3 onDestroy hook

// when root goes out of scope or is disposed of, so will A (#2) and C (#1).
```



## Contributing

Contributions are welcome! Fork the repository, make changes, and submit a pull
request. Ensure tests pass and follow the existing code style.



## License

This project is licensed under the [MIT License](./LICENSE). See LICENSE for
details.

Copyright (c) 2025 SansarJs
