// Domain-level error: thrown when an order with the same idempotency key already exists.
// Keeps the application layer independent from Prisma-specific error codes.
export class DuplicateIdempotencyKeyError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`An order with idempotency key "${idempotencyKey}" already exists`);
    this.name = 'DuplicateIdempotencyKeyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}