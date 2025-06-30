import { Globe } from "lucide-react";
import Image from "next/image";
import React from "react";

interface HomeAboutMissionProps {
  t: (key: string) => string;
}

export const HomeAboutMission: React.FC<HomeAboutMissionProps> = ({ t }) => (
  <section className="mx-auto mt-16 flex w-full max-w-7xl flex-col items-center gap-12 rounded-3xl border border-white/20 bg-white/60 p-12 shadow-2xl backdrop-blur-sm md:flex-row md:items-stretch md:gap-16">
    <div className="flex-1 text-center md:text-left">
      <h2 className="from-jii-medium-green to-jii-dark-green mb-6 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent">
        {t("jii.institute")}
      </h2>
      <p className="mb-8 text-lg leading-relaxed text-gray-600">{t("jii.aboutDescription")}</p>
      <div className="rounded-2xl border-l-4 border-emerald-400 bg-gradient-to-r from-emerald-50 to-blue-50 p-8">
        <h3 className="mb-4 flex items-center space-x-2 text-2xl font-bold text-emerald-700">
          <Globe className="h-6 w-6" />
          <span>{t("jii.mission")}</span>
        </h3>
        <p className="font-medium leading-relaxed text-gray-700">{t("jii.missionDescription")}</p>
      </div>
    </div>
    <div className="w-full md:flex-1">
      <div className="group relative h-full overflow-hidden rounded-2xl">
        <Image
          src="https://images.pexels.com/photos/1181316/pexels-photo-1181316.jpeg?w=600&h=400&auto=compress&fit=crop"
          alt="Scientific research and collaboration"
          width={600}
          height={400}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent"></div>
      </div>
    </div>
  </section>
);
