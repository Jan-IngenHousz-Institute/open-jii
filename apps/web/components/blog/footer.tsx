"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Container } from "@repo/cms/container";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t-color border-gray200 mt-10 border-t">
      <Container className="py-8">
        <h2 className="h4 mb-4">{t("footer.aboutUs")}</h2>
        <div className="max-w-4xl">{t("footer.description")}</div>
        <div className="mt-8">
          {t("footer.learnMoreAt")}{" "}
          <Link
            href="https://www.jan-ingenhousz-institute.org/"
            rel="noopener noreferrer"
            target="_blank"
            className="text-blue-600 hover:underline"
          >
            Jan Ingenhousz Institute
          </Link>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
