export interface ApiErrorShape {
  statusCode: number;
  message: string | string[];
  correlationId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly correlationId?: string;

  constructor(shape: ApiErrorShape) {
    super(
      Array.isArray(shape.message) ? shape.message.join(", ") : shape.message,
    );
    this.statusCode = shape.statusCode;
    this.correlationId = shape.correlationId;
  }
}

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "We could not find what you were looking for.";
      case 422:
        return error.message || "This request could not be processed.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
