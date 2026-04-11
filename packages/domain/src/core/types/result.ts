/**
 * Result type for explicit error handling
 * 
 * Use this instead of throwing exceptions for expected error cases.
 * This makes error handling explicit in function signatures.
 * 
 * @example
 * function divide(a: number, b: number): Result<number, DivisionError> {
 *   if (b === 0) {
 *     return err(new DivisionError('Cannot divide by zero'));
 *   }
 *   return ok(a / b);
 * }
 * 
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error.message);
 * }
 */

/**
 * Success result type
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Error result type
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either success or failure
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Create a success result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Check if a result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Check if a result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwrap a result, throwing if it's an error
 * Use with caution - prefer pattern matching on ok/error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Map over a successful result
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over an error result
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain result-returning functions
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Convert a Promise that might reject to a Result
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
}

/**
 * Convert a Result to a Promise
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  if (result.ok) {
    return Promise.resolve(result.value);
  }
  return Promise.reject(result.error);
}

/**
 * Combine multiple results into a single result
 * Returns first error encountered or array of all values
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Execute a function and convert any thrown error to a Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorMapper?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    if (errorMapper) {
      return err(errorMapper(error));
    }
    return err(error as E);
  }
}

/**
 * Execute an async function and convert any thrown error to a Result
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    if (errorMapper) {
      return err(errorMapper(error));
    }
    return err(error as E);
  }
}
