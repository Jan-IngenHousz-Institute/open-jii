import Image from "next/image";
import React from "react";

interface HomePartnersProps {
  t: (key: string) => string;
}

export const HomePartners: React.FC<HomePartnersProps> = ({ t }) => (
  <section className="mx-auto w-full max-w-7xl px-4 py-20">
    <h2 className="text-jii-dark-green mb-4 text-center text-3xl font-bold">
      {t("jii.partnersTitle")}
    </h2>
    <p className="mb-12 text-center text-gray-500">{t("jii.partnersDesc")}</p>
    <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
      <div className="flex flex-col items-center rounded-xl border bg-white p-6 transition hover:shadow-md">
        <span className="mb-2 text-3xl">🏛️</span>
        <span className="text-jii-dark-green mb-1 font-semibold">{t("jii.partnerLogo1")}</span>
        <span className="text-center text-sm text-gray-500">{t("jii.partnerDesc1")}</span>
      </div>
      <div className="flex flex-col items-center rounded-xl border bg-white p-6 transition hover:shadow-md">
        <span className="mb-2 text-3xl">🎓</span>
        <span className="text-jii-dark-green mb-1 font-semibold">{t("jii.partnerLogo2")}</span>
        <span className="text-center text-sm text-gray-500">{t("jii.partnerDesc2")}</span>
      </div>
      <div className="flex flex-col items-center rounded-xl border bg-white p-6 transition hover:shadow-md">
        <span className="mb-2 text-3xl">💻</span>
        <span className="text-jii-dark-green mb-1 font-semibold">{t("jii.partnerLogo3")}</span>
        <span className="text-center text-sm text-gray-500">{t("jii.partnerDesc3")}</span>
      </div>
    </div>
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
      <div className="relative w-full">
        <div
          className="scrollbar-hide flex gap-4 overflow-x-auto px-1 py-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <Image
            src="https://images.pexels.com/photos/325807/pexels-photo-325807.jpeg?w=900&h=500&auto=compress&fit=crop"
            alt={t("jii.heroVisualAlt")}
            width={900}
            height={500}
            className="w-full min-w-[600px] max-w-2xl snap-center rounded-2xl object-cover shadow-sm"
            priority
          />
          <Image
            src="https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?w=900&h=500&auto=compress&fit=crop"
            alt={t("jii.heroVisualAlt")}
            width={900}
            height={500}
            className="w-full min-w-[600px] max-w-2xl snap-center rounded-2xl object-cover shadow-sm"
          />
          <Image
            src="https://images.pexels.com/photos/256369/pexels-photo-256369.jpeg?w=900&h=500&auto=compress&fit=crop"
            alt={t("jii.heroVisualAlt")}
            width={900}
            height={500}
            className="w-full min-w-[600px] max-w-2xl snap-center rounded-2xl object-cover shadow-sm"
          />
        </div>
      </div>
    </div>
  </section>
);
