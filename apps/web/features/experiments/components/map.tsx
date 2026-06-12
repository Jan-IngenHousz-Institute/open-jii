import dynamic from "next/dynamic";

export const Map = dynamic(() => import("@repo/ui/components/map"), {
  ssr: false,
});
