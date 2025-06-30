import React from "react";

interface KeyFeaturesProps {
  t: (key: string) => string;
}

export const HomeKeyFeatures: React.FC<KeyFeaturesProps> = ({ t }) => (
  <section className="w-full max-w-7xl px-4 py-20">
    <div className="mb-16 text-center">
      <h2 className="from-jii-medium-green to-jii-dark-green mb-4 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent">
        {t("jii.keyFeaturesTitle")}
      </h2>
      <p className="mx-auto max-w-3xl text-xl text-gray-600">{t("jii.keyFeaturesDesc")}</p>
    </div>

    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
      {/* Feature 1 - Experiment Management */}
      <div className="border-jii-light-blue group relative transform overflow-hidden rounded-3xl border bg-white/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/40 to-slate-50/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m0 0v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h2 className="m-0 text-2xl font-bold text-gray-800">
              {t("jii.featureExperimentManagement")}
            </h2>
          </div>
          <p className="leading-relaxed text-gray-600">
            {t("jii.featureExperimentManagementDesc")}
          </p>
        </div>
      </div>

      {/* Feature 2 - Device Onboarding */}
      <div className="border-jii-light-blue group relative transform overflow-hidden rounded-3xl border bg-white/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/40 to-slate-50/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="m-0 text-2xl font-bold text-gray-800">
              {t("jii.featureDeviceOnboarding")}
            </h2>
          </div>
          <p className="leading-relaxed text-gray-600">{t("jii.featureDeviceOnboardingDesc")}</p>
        </div>
      </div>

      {/* Feature 3 - Open Collaboration */}
      <div className="border-jii-light-blue group relative transform overflow-hidden rounded-3xl border bg-white/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/40 to-slate-50/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h2 className="m-0 text-2xl font-bold text-gray-800">{t("jii.featureOpenCollab")}</h2>
          </div>
          <p className="leading-relaxed text-gray-600">{t("jii.featureOpenCollabDesc")}</p>
        </div>
      </div>

      {/* Feature 4 - Custom Access */}
      <div className="border-jii-light-blue group relative transform overflow-hidden rounded-3xl border bg-white/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/40 to-slate-50/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586l4.293-4.293A6 6 0 0117 7z"
                />
              </svg>
            </div>
            <h2 className="m-0 text-2xl font-bold text-gray-800">{t("jii.featureCustomAccess")}</h2>
          </div>
          <p className="leading-relaxed text-gray-600">{t("jii.featureCustomAccessDesc")}</p>
        </div>
      </div>
    </div>
  </section>
);
