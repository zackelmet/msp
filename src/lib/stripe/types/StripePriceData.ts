export interface StripePriceData {
  id: string;
  product?: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
    aggregate_usage?: string | null;
    usage_type?: string;
    trial_period_days?: number | null;
  };
  active: boolean;
  metadata?: Record<string, string>;
  tax_behavior?: string;
  tiers_mode?: string | null;
  unit_amount_decimal?: string;
  [key: string]: any; // Allow additional Stripe fields
}
