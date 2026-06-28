export async function signOut(): Promise<void> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL must be set');
  }

  // Best-effort — backend revokes the refresh token family and clears all cookies
  await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-api-key': API_KEY },
  }).catch(() => {});

  window.location.replace('/login');
}
