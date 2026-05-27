export class IntegrationError extends Error {
  constructor(message, { status = 500, code = 'integration_error', details } = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends IntegrationError {
  constructor(resource, id) {
    super(`${resource} not found`, { status: 404, code: 'not_found', details: { id } });
  }
}

export class ValidationError extends IntegrationError {
  constructor(message, details) {
    super(message, { status: 400, code: 'validation_error', details });
  }
}

export function errorMiddleware(err, _req, res, _next) {
  if (err instanceof IntegrationError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }
  console.error('[researchium-chat]', err);
  res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
