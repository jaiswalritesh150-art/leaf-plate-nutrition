// "Who is this?" is just a phone number remembered in this browser. It is NOT authentication:
// anyone who knows a client's number can view and change that client's appointments.
const KEY = 'clientIdentity'
export interface Identity { phone: string; name?: string }

export function getIdentity(): Identity | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export function setIdentity(i: Identity) {
  try { localStorage.setItem(KEY, JSON.stringify(i)) } catch { /* private mode: fine, just not remembered */ }
}
export function clearIdentity() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
