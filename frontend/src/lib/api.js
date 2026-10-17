const baseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');

export const apiUrl = (path) => `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
