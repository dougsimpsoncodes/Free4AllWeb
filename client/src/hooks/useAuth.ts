import { useClerkAuth } from "@/contexts/ClerkAuthContext";

// Compatibility wrapper for existing useAuth usage
export function useAuth() {
  return useClerkAuth();
}
