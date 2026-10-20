import DatasetPublishContent from "./dataset-publish-content";

interface DatasetPublishPageProps {
  params: Promise<{ locale: string; id: string; datasetId: string }>;
}

export default function DatasetPublishPage({ params }: DatasetPublishPageProps) {
  return <DatasetPublishContent params={params} />;
}
