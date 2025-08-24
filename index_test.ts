import { describe, it } from "@std/testing/bdd";
import { expect, fn } from "@std/expect";

import { Container, ContainerDuplicateKeyError, Token } from "./index.ts";

describe("Container", () => {
  describe("get(key)", () => {
    it("invoke related resolver definition on first time", () => {
      class A {}
      class AToken extends Token<A> {}
      const [aMock, aTokenMock] = [fn(), fn()];
      const container = new Container()
        .register(A, { resolver: aMock as () => A })
        .register(AToken, { resolver: aTokenMock as () => A });

      expect(aMock).not.toBeCalled();
      expect(aTokenMock).not.toBeCalled();

      container.get(A);
      container.get(AToken);
      expect(aMock).toBeCalledTimes(1);
      expect(aTokenMock).toBeCalledTimes(1);
    });

    it("invoke related resolver definition only first time", () => {
      class A {}
      class AToken extends Token<A> {}
      const [aMock, aTokenMock] = [fn(), fn()];
      const container = new Container()
        .register(A, { resolver: aMock as () => A })
        .register(AToken, { resolver: aTokenMock as () => A });

      container.get(A);
      container.get(AToken);
      expect(aMock).toBeCalledTimes(1);
      expect(aTokenMock).toBeCalledTimes(1);

      container.get(A);
      container.get(AToken);
      expect(aMock).toBeCalledTimes(1);
      expect(aTokenMock).toBeCalledTimes(1);
    });

    it("cache the first resolver returned value", () => {
      class A {}
      class AToken extends Token<A> {}
      const container = new Container()
        .register(A, { resolver: () => new A() })
        .register(AToken, { resolver: () => new A() });

      expect(container.get(A)).toBe(container.get(A));
      expect(container.get(AToken)).toBe(container.get(AToken));
    });
  });

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

    it("will throw on same key registration", () => {
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

  describe("register(key, { resolver })", () => {
    it("will return the container object", () => {
      class A {}
      class AToken extends Token<A> {}
      const container = new Container();

      expect(container.register(A, { resolver: () => new A() })).toBe(
        container,
      );
      expect(container.register(AToken, { resolver: () => new A() })).toBe(
        container,
      );
    });

    it("will cause Container#get to return the factory returned value for the same token", () => {
      class A {}
      class AToken extends Token<A> {}
      const [one, two] = [new A(), new A()];
      const container = new Container()
        .register(A, { resolver: () => one })
        .register(AToken, { resolver: () => two });

      expect(container.get(A)).toBe(one);
      expect(container.get(AToken)).toBe(two);
    });

    it("will throw on same key registration", () => {
      class A {}
      class AToken extends Token<A> {}
      const container = new Container()
        .register(A, { resolver: () => new A() })
        .register(AToken, { resolver: () => new A() });

      expect(() => container.register(A, { resolver: () => new A() })).toThrow(
        ContainerDuplicateKeyError,
      );
      expect(() =>
        container.register(AToken, { resolver: () => new A() }),
      ).toThrow(ContainerDuplicateKeyError);
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
