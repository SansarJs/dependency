import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Token } from "./index.ts";

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
