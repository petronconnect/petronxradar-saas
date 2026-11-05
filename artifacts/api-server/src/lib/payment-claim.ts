export type ClaimPayment = {
  status: string;
  new_account_created: boolean;
  claim_token_hash: string | null;
  claimed_at: unknown;
  google_subject?: string | null;
  google_issuer?: string | null;
  google_email?: string | null;
};
export type RegistrationProof = { issuer: string; subject: string; email: string; expiresAt: number };

// Run only inside the payment's row lock, after constant-time token verification.
export function eligibleClaim(payment: ClaimPayment | undefined, verifiedHash: string,
  proof: RegistrationProof | undefined, now = Date.now()): boolean {
  if (!payment || payment.status !== "approved" || !payment.new_account_created ||
      payment.claimed_at || !payment.claim_token_hash || payment.claim_token_hash !== verifiedHash) return false;
  return !payment.google_subject || !!(proof && proof.expiresAt > now &&
    proof.subject === payment.google_subject && proof.issuer === payment.google_issuer &&
    proof.email === payment.google_email);
}
