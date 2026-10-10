import Image from "next/image";
import loginBackground1 from "~/public/login-background-1.jpg";
import loginBackground2 from "~/public/login-background-2.jpg";
import loginBackground3 from "~/public/login-background-3.jpg";
import loginBackground4 from "~/public/login-background-4.jpg";

// Imported rather than referenced by path, so their optimized copies are cached as immutable
// instead of being re-encoded every few hours for whoever happens to come next.
const BACKGROUNDS = [loginBackground1, loginBackground2, loginBackground3, loginBackground4];

// The scrim darkens the photo identically in both themes, so it is a fixed
// literal rather than a theme token.
// eslint-disable-next-line no-restricted-syntax -- fixed neutral photo scrim
const scrim = "from-black via-black/80 to-black/40 absolute inset-0 bg-gradient-to-l";

/** The photo backdrop shared by every auth page: one of four shots, under a neutral scrim. */
export function AuthBackground({ alt }: { alt: string }) {
  const background =
    BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)] ?? loginBackground1;

  return (
    <div className="fixed inset-0 z-0 w-full">
      <Image src={background} alt={alt} fill priority className="object-cover" />
      <div className={scrim} />
    </div>
  );
}
