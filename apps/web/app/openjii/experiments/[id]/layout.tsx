"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface ExperimentLayoutProps {
  children: React.ReactNode;
}

export default function ExperimentLayout({ children }: ExperimentLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith("/data")) return "data";
    if (pathname.endsWith(`/experiments/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Experiment</h3>
        <p className="text-muted-foreground text-sm">
          Manage your experiment settings, data, and configuration.
        </p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" asChild>
            <Link href={`/openjii/experiments/${id}`}>Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="data" asChild>
            <Link href={`/openjii/experiments/${id}/data`}>Data</Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link href={`/openjii/experiments/${id}/settings`}>Settings</Link>
          </TabsTrigger>
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
