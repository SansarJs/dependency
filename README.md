# `@sansar/dependency`

A strait forward dependency container in JavaScript, implemented for
environment agnosis and compliance to web standards.

```sh
deno add @sansar/dependency
```

## API Surface

Definitions & concepts:

+ **Key**: a class they serves to store dependency definition and later
  retrieve a value from a container. It could be a normal constructor like
  `Date` or a sub-class of `Token`.
  > `Token` sub-classes are useful when multiple dependencies share a common
  > type _(eg.: `StartupDateToken`, `ShutdownDateToken`)_ or, for types that
  > are not constructor-based _(eg.:
  > `class ConfigToken extends Token<{value: string, radix?: number}>`)_.
+ **Provider**: a definition to resolve a dependency value. It could be:
  + a static value: `{ value: T }`
  * a resolver to lazily compute the value, once, cached: `{resolver: () => T}`
  * a generator to lazily compute a new value, each time: `{resolver: () => T}`
+ **Container**: a class which instances organise dependency definitions, value
  retrieval and caching.

+ `Token`: a base class for identifying values in a container
+ `Container`: the class to contain dependency definitions and cache
  dependencies when applicable

## Usages

Ordinary constructor key, with a generator dependency definition:
```ts
import { Container } from "@sansar/dependency";

const container = new Container()
  .register(Date, { generator: () => new Date() });

// Later
container.get(Date) // get a date
container.get(Date) // get another date
container.get(Date) // get yet another date
```

Contrustor key, with a resolver dependency definition:
```ts
import { Container } from "@sansar/dependency";

class TemplateEngine { /** heavy stuff in here **/ }

const container = new Container()
  .register(TemplateEngine, { resolver: () => new TemplateEngine() });

// Later
container.get(TemplateEngine) // get the template engine (initialized lazily)
container.get(TemplateEngine) // get the same template engine
container.get(TemplateEngine) // still the same
```

Token-based key, with a value dependency definition:
```ts
import { Container, Token } from "@sansar/dependency";

class DbConfig extends Token<Record<'uri'|'username'|'password', string>> {
}

const container = new Container()
  .register(DbConfig, {
    value: {
      username: '',
      password: '',
      uri: 'jdbc://localhost:5432/app'
    }
  });

// Later
container.get(DbConfig) // get the registered DbConfig
container.get(DbConfig) // get the registered DbConfig
container.get(DbConfig) // get the registered DbConfig
```

## License

[MIT](./LICENSE)
