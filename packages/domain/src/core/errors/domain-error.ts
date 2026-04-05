/**
 * Base domain error class
 * 
 * All domain-specific errors should extend this class.
 * This provides a consistent error interface across the domain layer.
 */
export class DomainError extends Error {
  /**
   * Error code for programmatic error handling
   */
  readonly code: string;

  /**
   * Additional context about the error
   */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainError);
    }
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

/**
 * Entity not found error
 */
export class NotFoundError extends DomainError {
  constructor(entityType: string, id: string) {
    super(
      `${entityType} with id '${id}' not found`,
      'NOT_FOUND',
      { entityType, id }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error for invalid input data
 */
export class ValidationError extends DomainError {
  readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', { ...context, field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Authorization error for permission denied
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized', context?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', context);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error for access denied
 */
export class ForbiddenError extends DomainError {
  constructor(message: string = 'Access denied', context?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', context);
    this.name = 'ForbiddenError';
  }
}

/**
 * Conflict error for duplicate or conflicting data
 */
export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', context);
    this.name = 'ConflictError';
  }
}

/**
 * Business rule violation error
 */
export class BusinessRuleError extends DomainError {
  constructor(rule: string, message: string, context?: Record<string, unknown>) {
    super(message, 'BUSINESS_RULE_VIOLATION', { ...context, rule });
    this.name = 'BusinessRuleError';
  }
}

/**
 * Infrastructure error (should be used in infrastructure layer only)
 */
export class InfrastructureError extends DomainError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error, context?: Record<string, unknown>) {
    super(message, 'INFRASTRUCTURE_ERROR', context);
    this.name = 'InfrastructureError';
    this.cause = cause;
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends DomainError {
  readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, context?: Record<string, unknown>) {
    super(message, 'RATE_LIMIT_EXCEEDED', { ...context, retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends DomainError {
  readonly serviceName: string;

  constructor(serviceName: string, message: string, context?: Record<string, unknown>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', { ...context, serviceName });
    this.name = 'ExternalServiceError';
    this.serviceName = serviceName;
  }
}

/**
 * Insufficient credits/balance error
 */
export class InsufficientCreditsError extends DomainError {
  readonly required: number;
  readonly available: number;

  constructor(required: number, available: number, context?: Record<string, unknown>) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
      'INSUFFICIENT_CREDITS',
      { ...context, required, available }
    );
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.available = available;
  }
}

/**
 * Configuration error for missing or invalid configuration
 * Used when required system configuration is not found in the database
 */
export class ConfigurationError extends DomainError {
  readonly configType: string;

  constructor(configType: string, message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', { ...context, configType });
    this.name = 'ConfigurationError';
    this.configType = configType;
  }
}

/**
 * Plan configuration not found error
 * Thrown when a required plan configuration is missing from the database
 */
export class PlanConfigurationError extends ConfigurationError {
  readonly planType: string;

  constructor(planType: string, context?: Record<string, unknown>) {
    super(
      'plan',
      `Plan configuration not found for type '${planType}'. Please configure plans in the admin panel.`,
      { ...context, planType }
    );
    this.name = 'PlanConfigurationError';
    this.planType = planType;
  }
}
