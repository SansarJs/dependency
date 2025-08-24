const token = Symbol();
export class Token<T = unknown> {
  readonly [token]: T | undefined;

  constructor() {
    throw new Error("Cannot instantiate.");
  }
}
