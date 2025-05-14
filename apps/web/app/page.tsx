import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@repo/ui/components";

import { AuthShowcase } from "./_components/auth-showcase";

export const metadata: Metadata = {
  title: "Jan IngenHousz Institute",
};

export default function Home() {
  return (
    <>
      <AuthShowcase />

      <h1 className="text-jii-dark-green mb-6 text-4xl font-bold">
        Jan IngenHousz Institute
      </h1>
      <div className="flex items-center gap-2 py-12">
        <Button>no variant</Button>
        <Button variant={"destructive"}>destructive</Button>
        <Button variant={"ghost"}>ghost</Button>
        <Button variant={"link"}>link</Button>
        <Button variant={"secondary"}>secondary</Button>
        <Button variant={"outline"}>outline</Button>
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
      <div className="p-6">
        <Link href="/openjii">
          <Button>Go to the openJII platform</Button>
        </Link>
      </div>
    </>
  );
}
