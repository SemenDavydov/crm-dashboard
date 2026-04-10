export type OrderRow = {
  id: number;
  order_number: string;
  sum: number | null;
  status: string | null;
  created_at: string | null;
  customer_name: string | null;
  phone: string | null;
};

export type RetailCrmOrder = Record<string, unknown>;

export type RetailCrmOrdersResponse = {
  success: boolean;
  orders?: RetailCrmOrder[];
  pagination?: {
    limit?: number;
    totalCount?: number;
    currentPage?: number;
    totalPageCount?: number;
  };
  errorMsg?: string;
};
