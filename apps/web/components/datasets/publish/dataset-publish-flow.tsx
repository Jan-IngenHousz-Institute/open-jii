"use client";

import { useDatasetPublish } from "@/hooks/dataset/useDatasetPublish/useDatasetPublish";
import { useLocale } from "@/hooks/useLocale";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { DefaultValues } from "react-hook-form";

import type {
  Dataset,
  DatasetScope,
  DatasetScopeChoice,
} from "@repo/api/domains/dataset/dataset.schema";
import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { WizardForm } from "@repo/ui/components/wizard-form";
import type { WizardStep, WizardStepProps } from "@repo/ui/components/wizard-form";

import { CheckStep } from "./check-step";
import { CurateStep } from "./curate-step";
import {
  checkSchema,
  curateSchema,
  describeSchema,
  freezeSchema,
  licenseSchema,
  scopeSchema,
} from "./dataset-publish-schema";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DescribeStep } from "./describe-step";
import { FreezeStep } from "./freeze-step";
import { LicenseStep } from "./license-step";
import { ScopeStep } from "./scope-step";

interface DatasetPublishFlowProps {
  dataset: Dataset;
  experiment: Experiment;
  scope: DatasetScope;
}

/** Every table and every day. A later version's Draft is created with the previous choice instead. */
function startingChoice(scope: DatasetScope): DatasetScopeChoice {
  return {
    tables: scope.tables.map(({ name, displayName }) => ({ name, displayName })),
    from: scope.firstReadingOn,
    to: scope.lastReadingOn,
  };
}

/** The six steps over one form, as the new experiment flow holds its steps. */
export function DatasetPublishFlow({ dataset, experiment, scope }: DatasetPublishFlowProps) {
  const { t } = useTranslation("datasets");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const datasetId = dataset.id;
  const experimentId = dataset.experimentId;
  const version = dataset.version;
  const funding = dataset.funding;
  // Scaffold: ?standards=off shows the flow as it is before the standards block ships.
  const showsStandards = searchParams.get("standards") !== "off";
  const query = searchParams.toString();

  const { mutate: publish, isPending } = useDatasetPublish({
    onSuccess: (published) => {
      const datasetsPath = `/${locale}/platform/experiments/${published.experimentId}/datasets`;
      router.push(query === "" ? datasetsPath : `${datasetsPath}?${query}`);
    },
  });

  const steps: WizardStep<PublishDatasetForm>[] = useMemo(() => {
    function Scope(props: WizardStepProps<PublishDatasetForm>) {
      return <ScopeStep {...props} scope={scope} />;
    }
    function Curate(props: WizardStepProps<PublishDatasetForm>) {
      return <CurateStep {...props} datasetId={datasetId} experimentId={experimentId} />;
    }
    function Describe(props: WizardStepProps<PublishDatasetForm>) {
      return <DescribeStep {...props} datasetId={datasetId} />;
    }
    function Check(props: WizardStepProps<PublishDatasetForm>) {
      return (
        <CheckStep
          {...props}
          datasetId={datasetId}
          experimentId={experimentId}
          funding={funding}
          showsStandards={showsStandards}
        />
      );
    }
    function Freeze(props: WizardStepProps<PublishDatasetForm>) {
      const freeze = (data: PublishDatasetForm) => publish({ ...data, id: datasetId });
      return <FreezeStep {...props} scope={scope} version={version} onFreeze={freeze} />;
    }

    return [
      { title: t("publish.steps.scope"), validationSchema: scopeSchema, component: Scope },
      { title: t("publish.steps.curate"), validationSchema: curateSchema, component: Curate },
      { title: t("publish.steps.describe"), validationSchema: describeSchema, component: Describe },
      {
        title: t("publish.steps.license"),
        validationSchema: licenseSchema,
        component: LicenseStep,
      },
      { title: t("publish.steps.check"), validationSchema: checkSchema, component: Check },
      { title: t("publish.steps.freeze"), validationSchema: freezeSchema, component: Freeze },
    ];
  }, [t, scope, datasetId, experimentId, version, funding, showsStandards, publish]);

  // A Draft saves as the researcher goes, so the flow resumes from what it holds, and an empty
  // field falls back to the experiment it was started from.
  const defaultValues: DefaultValues<PublishDatasetForm> = {
    scope: dataset.scope ?? startingChoice(scope),
    excludedReadings: dataset.excludedReadings,
    title: dataset.title,
    description: dataset.description ?? experiment.description ?? "",
    authors: dataset.authors,
    contributors: dataset.contributors,
    limitations: dataset.limitations ?? "",
    license: dataset.license ?? experiment.license ?? undefined,
    access: dataset.access,
    embargoUntil: dataset.embargoUntil ?? undefined,
  };

  const handleSubmit = (data: PublishDatasetForm) => {
    publish({ ...data, id: datasetId });
  };

  return (
    <WizardForm<PublishDatasetForm>
      steps={steps}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isPending}
    />
  );
}
