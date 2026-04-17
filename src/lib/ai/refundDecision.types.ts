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
  complaint_status?: 'generated' | 'not_applicable' | 'failed';
  ai_complaint?: string;
  /** 0–100 confidence in this advisory (optional for older clients). */
  confidence?: number;
  /** Free tier: row is visible but full AI / draft is gated until Pro checkout. */
  pro_locked?: boolean;
};

export type RefundDecisionWithKey = RefundDecisionOutput & {
  id: string;
  order_id: string;
};
