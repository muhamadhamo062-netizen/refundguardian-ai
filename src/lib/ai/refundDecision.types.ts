export type RefundDecisionInput = {
  id: string;
  platform: string;
  issue_type: string;
  amount: number | null;
  order_id: string;
  /** Optional — used for free-trial date window (last N days). */
  order_date?: string | null;
  /** Optional line item text for richer complaint drafting. */
  product_name?: string | null;
};

export type ComplaintStatus = 'ai' | 'template' | 'unavailable';

export type RefundDecisionOutput = {
  refund_score: number;
  priority: 'HIGH VALUE' | 'FAST' | 'MEDIUM';
  estimated_refund: number;
  reason: string;
  claim_message: string;
  /** Primary AI complaint body (same pipeline as `claim_message` when AI succeeds). */
  ai_complaint?: string;
  complaint_status?: ComplaintStatus;
  /** 0–100 confidence in this advisory (optional for older clients). */
  confidence?: number;
};

export type RefundDecisionWithKey = RefundDecisionOutput & {
  id: string;
  order_id: string;
};
