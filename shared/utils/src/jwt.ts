export function decodeJwt<T>(token: string): T {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64)) as T;
}
