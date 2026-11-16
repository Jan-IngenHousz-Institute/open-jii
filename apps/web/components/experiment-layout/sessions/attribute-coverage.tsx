import { CoverageLine } from "./coverage-line";
import type { FieldPlan } from "./field-plan";

interface AttributeCoverageProps {
  plan: FieldPlan;
  attribute: string;
  measured: ReadonlySet<string>;
}

/** How many plots of each value of one attribute are measured, under the attribute's name. */
export function AttributeCoverage({ plan, attribute, measured }: AttributeCoverageProps) {
  const counts = plan.countByAttribute(attribute, measured);
  const totals = plan.totalByAttribute(attribute);
  const isBalance = attribute === plan.balanceName;

  const renderValue = ([value, total]: [string, number]) => (
    <CoverageLine
      key={value}
      label={value}
      measured={counts.get(value) ?? 0}
      total={total}
      category={isBalance ? plan.categories.get(value) : undefined}
    />
  );

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">{attribute}</p>
      {[...totals].map(renderValue)}
    </div>
  );
}
