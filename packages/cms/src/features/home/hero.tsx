import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface HomeHeroProps {
  t: (key: string) => string;
}

export const HomeHero: React.FC<HomeHeroProps> = ({ t }) => (
  <section className="relative w-full max-w-7xl px-4 py-20 text-center">
    <div className="mb-7 inline-flex items-center space-x-2 rounded-full border border-emerald-200/50 bg-white/40 px-5 py-2.5 backdrop-blur-sm">
      <span className="text-lg">🌱</span>
      <span className="text-sm font-medium text-gray-700">{t("jii.badge")}</span>
    </div>
    <h1 className="text-jii-dark-green mb-5 text-5xl font-extrabold leading-tight md:text-6xl">
      {t("jii.heroTitle")}
    </h1>
    <p className="mx-auto mb-7 max-w-3xl text-xl leading-relaxed text-gray-600 md:text-2xl">
      {t("jii.heroSubtitle")}
    </p>
    <div className="mb-10 mt-10 flex flex-col justify-center gap-5 sm:flex-row">
      <Link href="/platform" className="sm:h-14">
        <button className="bg-jii-dark-green hover:bg-jii-medium-green hover:shadow-jii-bright-green/25 group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl px-7 py-3 text-lg font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="relative flex items-center space-x-2">
            <span>{t("jii.platformCta")}</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </Link>
      <Link
        href="https://www.jan-ingenhousz-institute.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="border-jii-dark-green text-jii-dark-green hover:border-jii-medium-green hover:text-jii-medium-green group flex items-center justify-center rounded-2xl border-2 bg-white px-7 py-3 text-lg font-bold shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 sm:h-14"
      >
        <div className="flex items-center space-x-2">
          <span>{t("jii.institute")}</span>
          <ExternalLink className="h-5 w-5 transition-transform group-hover:scale-110" />
        </div>
      </Link>
    </div>
  </section>
);
