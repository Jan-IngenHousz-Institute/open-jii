import { NewProtocolForm } from "@/components/new-protocol";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Protocol",
};

export default function NewProtocolPage() {
  return (
    <div className="space-y-6">
      <NewProtocolForm />
    </div>
  );
}
