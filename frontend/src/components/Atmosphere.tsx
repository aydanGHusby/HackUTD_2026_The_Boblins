import type { CSSProperties } from "react";

// Background layer for the liquid glass chrome: two soft color fields (cobalt + violet) for the
// glass to bend and tint, plus a faint dot grid (a nod to the network) that fades below the fold.
// Kept low-contrast so dense tables and the graph stay the focus.
const floatingDots = [
  [7, 14, 8, 22, -4],
  [17, 64, 13, 28, -16],
  [28, 28, 6, 19, -8],
  [39, 82, 10, 25, -12],
  [51, 16, 15, 30, -20],
  [63, 57, 7, 21, -3],
  [74, 32, 11, 26, -14],
  [89, 73, 6, 20, -7],
  [94, 18, 9, 27, -19],
  [12, 88, 5, 23, -11],
  [33, 49, 14, 31, -23],
  [57, 90, 8, 24, -5],
  [82, 89, 16, 29, -18],
  [46, 39, 5, 18, -9],
  [68, 8, 10, 26, -15],
  [23, 9, 7, 22, -2],
];
export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="atmosphere-drift absolute -left-40 -top-56 h-[40rem] w-[40rem] rounded-full bg-[oklch(0.62_0.2_262)] opacity-[0.16] blur-[120px] dark:opacity-[0.22]" />
      <div className="atmosphere-drift-reverse absolute -bottom-48 right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[oklch(0.6_0.2_295)] opacity-[0.12] blur-[120px] dark:opacity-[0.18]" />
      {floatingDots.map(([left, top, size, duration, delay], index) => (
        <span
          key={index}
          className={
            "pastel-floating-dot " +
            (index % 2 ? "pastel-floating-dot-pink" : "pastel-floating-dot-blue")
          }
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              "--drift-x": `${index % 2 ? -18 : 22}px`,
              "--drift-y": `${-28 - (index % 4) * 9}px`,
            } as CSSProperties
          }
        />
      ))}
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
