export type RefundDecisionInput = {
  id: string;
  platform: string;
  issue_type: string;
  amount: number | null;
  order_id: string;
  /** Optional — used for free-trial date window (last N days). */
  order_date?: string | null;
};

export type RefundDecisionOutput = {
  refund_score: number;
  priority: 'HIGH VALUE' | 'FAST' | 'MEDIUM';
  estimated_refund: number;
  reason: string;
  claim_message: string;
  /** 0–100 confidence in this advisory (optional for older clients). */
  confidence?: number;
};

export type RefundDecisionWithKey = RefundDecisionOutput & {
  id: string;
  order_id: string;
};
