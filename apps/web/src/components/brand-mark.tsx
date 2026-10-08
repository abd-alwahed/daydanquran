/** The "stacked pages" mark. The gold bar is today's page. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <rect x="26" y="150" width="136" height="26" rx="13" fill="var(--dd-primary)" />
      <rect x="38" y="112" width="136" height="26" rx="13" fill="var(--dd-primary)" opacity=".8" />
      <rect x="26" y="74" width="136" height="26" rx="13" fill="var(--dd-primary)" opacity=".6" />
      <rect x="38" y="36" width="136" height="26" rx="13" fill="var(--dd-gold)" />
    </svg>
  );
}
