// Re-exports of Prisma-generated types will be added after schema is created.
// For now, export shared utility types.

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiError = {
  statusCode: number;
  error: string;
  message: string;
};

export type ApiSuccess<T> = {
  data: T;
};
