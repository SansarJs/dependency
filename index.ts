const token = Symbol();
export class Token<T = unknown> {
  readonly [token]: T | undefined;
}
