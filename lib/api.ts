/**
 * Base URL of the backend API.
 * Empty = same origin (frontend and API deployed together, or local dev).
 * Split deploy: set NEXT_PUBLIC_API_URL on Vercel to the Render URL, e.g. https://veris-api.onrender.com
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
