export function brandLogoUrl(make?: string | null) {
  const slug = String(make || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return slug ? `/api/brand-logo/${slug}` : '';
}
