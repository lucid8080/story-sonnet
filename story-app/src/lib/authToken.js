/** Registered by AuthContext when Clerk is active; used by API modules (non-hook code). */
let getTokenImpl = async () => null;

export function registerAuthTokenGetter(fn) {
  getTokenImpl = typeof fn === 'function' ? fn : async () => null;
}

export async function getAuthToken() {
  try {
    return await getTokenImpl();
  } catch {
    return null;
  }
}
