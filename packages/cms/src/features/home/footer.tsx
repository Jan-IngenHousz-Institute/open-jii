import { Shield } from "lucide-react";
import Link from "next/link";
import React from "react";

interface HomeFooterProps {
  t: (key: string) => string;
  locale: string;
}

export const HomeFooter: React.FC<HomeFooterProps> = ({ t, locale }) => (
  <footer className="bg-jii-dark-green w-full py-12 text-white">
    <div className="mx-auto w-full max-w-7xl px-4">
      <div className="mb-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        {/* OpenJII Brand/Description aligned left */}
        <div className="flex flex-col items-start">
          <div className="mb-6 flex items-center space-x-2">
            <div className="from-jii-medium-green to-jii-dark-green flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r">
              <span className="text-xl font-bold text-white">J</span>
            </div>
            <span className="text-2xl font-bold">{t("jii.footerBrand")}</span>
          </div>
          <p className="mb-4 leading-relaxed text-white">{t("jii.footerBrandDesc")}</p>
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-white">{t("jii.badge")}</span>
          </div>
        </div>
        {/* Centered Menu and Support aligned right */}
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-24">
          <div>
            <h4 className="text-jii-bright-green mb-2 text-center font-bold md:text-left">
              {t("jii.footerMenu")}
            </h4>
            <ul className="space-y-3 text-center text-sm text-white md:text-left">
              <li>
                <Link href={`/${locale}/platform`} className="hover:text-jii-medium-green transition-colors">
                  {t("jii.footerPlatform")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className="hover:text-jii-medium-green transition-colors">
                  {t("jii.footerBlog")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/about`} className="hover:text-jii-medium-green transition-colors">
                  {t("jii.footerAbout")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-jii-bright-green mb-2 text-center font-bold md:text-left">
              {t("jii.footerSupport")}
            </h4>
            <ul className="space-y-3 text-center text-sm text-white md:text-left">
              <li>
                <Link
                  href={`/${locale}/faq`}
                  className="hover:text-jii-medium-green transition-colors"
                >
                  {t("jii.footerFaq")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/policies`}
                  className="hover:text-jii-medium-green transition-colors"
                >
                  {t("jii.footerPrivacy")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="w-full border-t border-gray-800 pt-8 text-center">
        <p className="text-sm text-white">
          &copy; {new Date().getFullYear()} {t("jii.institute")}
        </p>
      </div>
    </div>
  </footer>
);
