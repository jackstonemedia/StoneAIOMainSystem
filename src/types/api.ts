/**
 * Generic API response envelope types.
 * Used to wrap all API responses consistently.
 */

/** Standard success wrapper (optional — many endpoints return data directly) */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Standard error response shape from the backend */
export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
  statusCode?: number;
}
