/**
 * My Travelroad — Canonical API Response Envelopes
 * Conforms to Section 2.4 and Section 3 of docs/architecture/api-architecture.md
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    timestamp?: string;
    [key: string]: unknown;
  };
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
    timestamp: string;
  };
}
