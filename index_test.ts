import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

import { Container, ContainerDuplicateKeyError, Token } from "./index.ts";

describe("Container", () => {
  describe("register(key, { value })", () => {
    it("will return the container object", () => {
      class A {}
      class AToken extends Token<A> {}
      const container = new Container();

      expect(container.register(A, { value: new A() })).toBe(container);
      expect(container.register(AToken, { value: new A() })).toBe(container);
    });

    it("will cause Container#get to return the same value for the same token", () => {
      class A {}
      class AToken extends Token<A> {}
      const [one, two] = [new A(), new A()];
      const container = new Container()
        .register(A, { value: one })
        .register(AToken, { value: two });

      expect(container.get(A)).toBe(one);
      expect(container.get(AToken)).toBe(two);
    });

    it("will throw on a second key registration", () => {
      class A {}
      class AToken extends Token<A> {}
      const container = new Container()
        .register(A, { value: new A() })
        .register(AToken, { value: new A() });

      expect(() => container.register(A, { value: new A() })).toThrow(
        ContainerDuplicateKeyError,
      );
      expect(() => container.register(AToken, { value: new A() })).toThrow(
        ContainerDuplicateKeyError,
      );
    });
  });
});

describe("Token", () => {
  it("cannot instantiate base class", () => {
    expect(() => new Token()).toThrow(Error);
    expect(() => new Token()).toThrow("Cannot instantiate.");
  });

  it("cannot instantiate sub class either", () => {
    expect(() => new (class T extends Token {})()).toThrow(Error);
    expect(() => new (class T extends Token {})()).toThrow(
      "Cannot instantiate.",
    );
  });
});
