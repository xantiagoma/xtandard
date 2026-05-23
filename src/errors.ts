export class AssertError extends Error {
  constructor(message = "The value is null or undefined") {
    super(message);
    this.name = "AssertError";
  }
}
