import Image from "next/image";
import React from "react";

interface AboutContentProps {
  t: (key: string) => string;
}

export const AboutContent: React.FC<AboutContentProps> = ({ t }) => (
  <div className="flex w-full max-w-7xl flex-col items-center gap-12 md:flex-row md:items-center md:gap-16">
    <div className="w-full md:w-1/2">
      <div className="overflow-hidden rounded-3xl shadow-2xl">
        <Image
          src="https://images.pexels.com/photos/1181316/pexels-photo-1181316.jpeg?w=800&h=500&auto=compress&fit=crop"
          alt="About OpenJII"
          width={800}
          height={500}
          className="w-full object-cover"
          priority
        />
      </div>
    </div>
    <div className="flex w-full flex-col justify-center text-center md:w-1/2 md:text-left">
      <h1 className="text-jii-dark-green mb-8 text-5xl font-bold tracking-tight">
        {t("about.title")}
      </h1>
      <p className="mx-auto max-w-3xl text-xl leading-relaxed text-gray-700">
        {t("about.description")}
      </p>
    </div>
  </div>
);
