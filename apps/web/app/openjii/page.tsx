import type { Metadata } from "next";

import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "openJII",
};

export default function OpenJIIHome() {
  return (
    <>
      <h1 className="text-jii-dark-green mb-6 text-4xl font-bold">
        Jan IngenHousz Institute
      </h1>
      <div className="flex items-center gap-2 py-12">
        <Button>no variant</Button>
      </div>
      <p className="mb-4 text-lg">
        The world's population is growing, while the area of suitable
        agricultural land is shrinking and harvests are declining due to climate
        change. A breakthrough is urgently needed. To this end, JII-researchers
        are working to understand and improve the green engine of agriculture:
        photosynthesis.
      </p>
      <div className="bg-jii-light-blue/30 mt-8 h-64 rounded-lg p-6">
        <h2 className="text-jii-dark-green mb-4 text-2xl font-semibold">
          Our Mission
        </h2>
        <p>
          Improving photosynthesis is a big challenge: different processes in
          the plant limit photosynthesis under different conditions, and each of
          these processes is regulated by different sets of genes. The Jan
          IngenHousz Institute was founded specifically to meet these major
          challenges.
        </p>
      </div>
    </>
  );
}
