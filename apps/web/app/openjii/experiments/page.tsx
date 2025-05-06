import { CreateExperiment }  from "@/components/create-experiment";

export default function ExperimentPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <h1>Experiments</h1>
        <p>This page will show a list of existing experiments.</p>
        <CreateExperiment />
      </div>
    </div>
  );
}
