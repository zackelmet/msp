export interface StripeProductData {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  metadata?: Record<string, string>;
  images?: string[];
  [key: string]: any; // Allow additional Stripe fields
}
