import Image from "next/image";

const BACKGROUND_COUNT = 4;

// The scrim darkens the photo identically in both themes, so it is a fixed
// literal rather than a theme token.
// eslint-disable-next-line no-restricted-syntax -- fixed neutral photo scrim
const scrim = "from-black via-black/80 to-black/40 absolute inset-0 bg-gradient-to-l";

/** The photo backdrop shared by every auth page: one of four shots, under a neutral scrim. */
export function AuthBackground({ alt }: { alt: string }) {
  const index = Math.floor(Math.random() * BACKGROUND_COUNT) + 1;

  return (
    <div className="fixed inset-0 z-0 w-full">
      <Image
        src={`/login-background-${index}.jpg`}
        alt={alt}
        fill
        priority
        className="object-cover"
      />
      <div className={scrim} />
    </div>
  );
}
