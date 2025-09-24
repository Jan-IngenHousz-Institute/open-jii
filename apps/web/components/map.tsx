import dynamic from "next/dynamic";

export const Map = dynamic(() => import("@repo/ui/components/enhanced-map"), {
  ssr: false,
});
