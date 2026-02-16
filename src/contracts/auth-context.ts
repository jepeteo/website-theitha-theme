export type MemberTier = "anonymous" | "free" | "paid";

export type AuthContext = {
  memberId: string | null;
  email: string | null;
  tier: MemberTier;
  isAuthenticated: boolean;
};

export const ANONYMOUS_AUTH_CONTEXT: AuthContext = {
  memberId: null,
  email: null,
  tier: "anonymous",
  isAuthenticated: false
};
