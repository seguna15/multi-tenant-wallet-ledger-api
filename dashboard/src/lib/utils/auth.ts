export async function signOut(): Promise<void> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL must be set');
  }
  
  await fetch(`${BASE_URL}/admin/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});

  window.location.replace('/login');
}
