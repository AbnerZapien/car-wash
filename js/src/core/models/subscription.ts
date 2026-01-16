export type PlanType = 'basic' | 'premium' | 'ultimate';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface Plan {
  id: PlanType;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  startDate: Date;
  nextBillingDate: Date;
  washCount: number;
}
