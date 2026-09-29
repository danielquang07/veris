/**
 * Base URL of the backend API.
 * Empty = same origin (frontend and API deployed together, or local dev).
 * Only set NEXT_PUBLIC_API_URL when the API runs on another domain.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
