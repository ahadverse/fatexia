import { z } from 'zod';

// Shared page/pageSize query shape. Every list endpoint that can grow unbounded
// (clicks, conversions, postback logs, messages) uses it so the API never returns a
// whole table by accident.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationDto = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(rows: T[], total: number, { page, pageSize }: PaginationDto): Paginated<T> {
  return { rows, total, page, pageSize };
}

export function offsetOf({ page, pageSize }: PaginationDto): number {
  return (page - 1) * pageSize;
}
