/**
 * Local avatar generator — no external requests.
 * Returns a data URI SVG with initials, so no network call is needed.
 */

const COLORS = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0891B2',
  '#059669', '#D97706', '#DC2626', '#DB2777',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Returns a data URI SVG avatar with initials.
 * Use as <img src={getAvatarDataUri('Abhishek')} /> — no network needed.
 */
export function getAvatarDataUri(name: string, size = 40): string {
  const initials = getInitials(name || 'U');
  const bg = getColor(name || 'U');
  const fontSize = Math.round(size * 0.38);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="${fontSize}" font-family="system-ui,sans-serif" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
