export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lg-espresso" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.42 0.08 45)" />
          <stop offset="100%" stopColor="oklch(0.28 0.045 45)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#lg-espresso)" />
      {/* Puerta */}
      <rect x="14" y="10" width="20" height="30" rx="2" fill="oklch(0.97 0.012 80)" opacity="0.95" />
      <rect x="17" y="13" width="14" height="9" rx="1" fill="oklch(0.62 0.135 40)" opacity="0.85" />
      <rect x="17" y="25" width="14" height="12" rx="1" fill="oklch(0.62 0.135 40)" opacity="0.55" />
      {/* Pomo dorado */}
      <circle cx="29" cy="27" r="1.6" fill="oklch(0.78 0.11 85)" />
    </svg>
  );
}
