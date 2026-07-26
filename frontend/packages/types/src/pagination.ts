// Shape every paginated list endpoint returns.
export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
