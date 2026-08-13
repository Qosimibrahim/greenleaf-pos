// No-op stub for Lovable integrations. Branding and remote authentication removed.

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: string, opts?: any) => {
      console.warn("Lovable OAuth is disabled in white-labeled local stack.");
      return { redirected: false, error: new Error("OAuth is disabled in this environment.") };
    },
  },
};
