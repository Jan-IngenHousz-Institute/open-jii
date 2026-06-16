import { Clock, Sprout } from "lucide-react";
import Link from "next/link";

export function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="bg-primary/10 rounded-full p-6">
            <Clock className="text-primary h-16 w-16" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold text-gray-900">We&apos;ll be back soon</h1>
        <p className="text-muted-foreground mb-12 text-lg leading-relaxed">
          We&apos;re currently performing maintenance. Please check back in a little while.
        </p>
        <Link
          href="/"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-xl font-bold transition-colors"
        >
          <Sprout className="h-6 w-6" />
          OpenJII
        </Link>
      </div>
    </div>
  );
}
