// Background layer for the liquid glass chrome: two soft color fields (cobalt + violet) for the
// glass to bend and tint, plus a faint dot grid (a nod to the network) that fades below the fold.
// Kept low-contrast so dense tables and the graph stay the focus.
export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="atmosphere-drift absolute -left-40 -top-56 h-[40rem] w-[40rem] rounded-full bg-[oklch(0.62_0.2_262)] opacity-[0.16] blur-[120px] dark:opacity-[0.22]" />
      <div className="atmosphere-drift-reverse absolute -bottom-48 right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[oklch(0.6_0.2_295)] opacity-[0.12] blur-[120px] dark:opacity-[0.18]" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />
    </div>
  );
}
