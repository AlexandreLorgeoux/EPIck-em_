// The Oracup symbol and name (docs/CHARTE.md, Logo). The symbol is drawn
// inline in `ink`, so the same markup works on light and dark surfaces; the
// yellow dot keeps its ink ring only where the surface is light.

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="oc-logo-mark"
    >
      <path
        d="M7 11H19V34H45V11H57M32 34V50M21 55H43"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="23" r="6" className="oc-logo-dot" />
    </svg>
  );
}

// Symbol and name; the accessible name is the word itself
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3 text-ink">
      <LogoMark size={size} />
      <span className="oc-wordmark">Oracup</span>
    </span>
  );
}
