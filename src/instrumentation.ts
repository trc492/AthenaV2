export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getAuthSecret, getSetupToken } = await import("./lib/server/runtime-secrets");
    getAuthSecret();
    if (process.env.NODE_ENV !== "production") getSetupToken();
  }
}
