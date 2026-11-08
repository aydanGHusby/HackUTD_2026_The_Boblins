// Ambient background: two soft lights plus a faint ray sweep and film grain,
// so the frosted panels have something to sit against.
export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-48 left-[12%] h-[42rem] w-[42rem] rounded-full bg-glow-ocean/25 blur-[130px]" />
      <div className="absolute -bottom-40 right-[6%] h-[34rem] w-[34rem] rounded-full bg-glow-candy/20 blur-[130px]" />
      <div className="absolute inset-y-0 left-1/3 w-[45rem] -rotate-12 bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.035),transparent)] blur-2xl" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
        <filter id="atmosphere-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#atmosphere-grain)" />
      </svg>
    </div>
  );
}
