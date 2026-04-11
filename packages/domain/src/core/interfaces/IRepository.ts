/**
 * Base repository interface
 * 
 * All domain repository interfaces should extend or follow this pattern.
 * This provides a consistent interface for data access across domains.
 */

import type { BrandedId } from '../types/branded-id.js';

/**
 * Generic repository interface for CRUD operations
 */
export interface IRepository<T, TId extends BrandedId<string>> {
  /**
   * Find an entity by its ID
   */
  findById(id: TId): Promise<T | null>;

  /**
   * Create a new entity
   */
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: TId, data: Partial<T>): Promise<T>;

  /**
   * Delete an entity by ID
   */
  delete(id: TId): Promise<void>;
}

/**
 * Extended repository interface with list/query capabilities
 */
export interface IQueryableRepository<T, TId extends BrandedId<string>, TFilter = Record<string, unknown>>
  extends IRepository<T, TId> {
  /**
   * List entities with optional filters
   */
  list(filters?: TFilter): Promise<T[]>;

  /**
   * Count entities matching filters
   */
  count(filters?: TFilter): Promise<number>;
}

/**
 * Repository with soft delete support
 */
export interface ISoftDeletableRepository<T, TId extends BrandedId<string>>
  extends IRepository<T, TId> {
  /**
   * Soft delete an entity (mark as deleted without removing)
   */
  softDelete(id: TId): Promise<void>;

  /**
   * Restore a soft-deleted entity
   */
  restore(id: TId): Promise<void>;

  /**
   * Find including soft-deleted entities
   */
  findByIdIncludeDeleted(id: TId): Promise<T | null>;
}

/**
 * Repository with owner-scoped operations
 * Common pattern for user-owned resources
 */
export interface IOwnedRepository<T, TId extends BrandedId<string>, TOwnerId extends BrandedId<string>> {
  /**
   * Find an entity by ID within owner scope
   */
  findById(ownerId: TOwnerId, id: TId): Promise<T | null>;

  /**
   * List all entities for an owner
   */
  list(ownerId: TOwnerId): Promise<T[]>;

  /**
   * Create a new entity for an owner
   */
  create(ownerId: TOwnerId, data: Omit<T, 'id' | 'owner' | 'created_at' | 'updated_at'>): Promise<T>;

  /**
   * Update an entity within owner scope
   */
  update(ownerId: TOwnerId, id: TId, data: Partial<T>): Promise<T>;

  /**
   * Delete an entity within owner scope
   */
  delete(ownerId: TOwnerId, id: TId): Promise<void>;
}

/**
 * Pagination options for list operations
 */
export interface IPaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface IPaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Repository with pagination support
 */
export interface IPaginatedRepository<T, TId extends BrandedId<string>, TFilter = Record<string, unknown>>
  extends IRepository<T, TId> {
  /**
   * List entities with pagination
   */
  listPaginated(filters?: TFilter, pagination?: IPaginationOptions): Promise<IPaginatedResult<T>>;
}

/**
 * Base entity interface with common fields
 */
export interface IEntity<TId extends BrandedId<string>> {
  id: TId;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Owned entity interface
 */
export interface IOwnedEntity<TId extends BrandedId<string>, TOwnerId extends BrandedId<string>>
  extends IEntity<TId> {
  owner: TOwnerId;
}
