"use client";

import { Database, Eye, Settings2, Plus, Trash2, TriangleDashed } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface TernaryChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: "a" | "b" | "c", columnName: string) => void;
}

export default function TernaryChartConfigurator({
  form,
  table,
  onColumnSelect,
}: TernaryChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Hook for managing boundaries array
  const {
    fields: boundariesFields,
    append: appendBoundary,
    remove: removeBoundary,
  } = useFieldArray({
    control: form.control,
    name: "config.config.boundaries",
  });

  // Function to add a new boundary
  const addBoundary = () => {
    const boundaryDefault = {
      dataSource: {
        columnName: "",
        tableName: "",
        alias: "",
      },
    };

    appendBoundary({
      name: `Boundary ${boundariesFields.length + 1}`,
      a: boundaryDefault,
      b: boundaryDefault,
      c: boundaryDefault,
      line: {
        color: "#333333",
        width: 2,
        dash: "solid" as const,
      },
      fillcolor: "",
      opacity: 0.3,
    });
  };

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

  return (
    <div className="space-y-8">
      {/* Data Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Database className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("dataConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* A-Axis Configuration (Component A) */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("ternary.aAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.aAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.componentA")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("a", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("configuration.selectColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {numericColumns.map((column: DataColumn) => (
                          <SelectItem key={column.name} value={column.name}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{column.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {column.type_name}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.aAxisProps.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.aAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* B-Axis Configuration (Component B) */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("ternary.bAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.bAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.componentB")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("b", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("configuration.selectColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {numericColumns.map((column: DataColumn) => (
                          <SelectItem key={column.name} value={column.name}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{column.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {column.type_name}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.bAxisProps.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.bAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* C-Axis Configuration (Component C) */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("ternary.cAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.cAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.componentC")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("c", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("configuration.selectColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {numericColumns.map((column: DataColumn) => (
                          <SelectItem key={column.name} value={column.name}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{column.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {column.type_name}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.cAxisProps.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.cAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Boundaries Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("ternary.boundaries")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBoundary}
                className="h-8 px-3"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("ternary.addBoundary")}
              </Button>
            </div>

            {/* Boundaries List */}
            <div className="space-y-4">
              {boundariesFields.map((field, index) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="text-primary h-4 w-4" />
                      <h6 className="text-muted-foreground text-sm font-medium">
                        {t("ternary.boundary")} {index + 1}
                      </h6>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBoundary(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {/* Boundary Name */}
                      <FormField
                        control={form.control}
                        name={`config.config.boundaries.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("ternary.boundaryName")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("ternary.enterBoundaryName")}
                                className="h-10 bg-white"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Component Coordinates - All in one row */}
                      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Component A Coordinates */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.a.dataSource.columnName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.componentA")} {t("column")}
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-white">
                                    <SelectValue placeholder={t("configuration.selectColumn")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {numericColumns.map((column: DataColumn) => (
                                    <SelectItem key={column.name} value={column.name}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{column.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {column.type_name}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Component B Coordinates */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.b.dataSource.columnName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.componentB")} {t("column")}
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-white">
                                    <SelectValue placeholder={t("configuration.selectColumn")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {numericColumns.map((column: DataColumn) => (
                                    <SelectItem key={column.name} value={column.name}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{column.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {column.type_name}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Component C Coordinates */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.c.dataSource.columnName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.componentC")} {t("column")}
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-white">
                                    <SelectValue placeholder={t("configuration.selectColumn")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {numericColumns.map((column: DataColumn) => (
                                    <SelectItem key={column.name} value={column.name}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{column.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {column.type_name}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Styling Options */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Line Style */}
                      <div className="space-y-4">
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          {t("ternary.lineStyle")}
                        </p>

                        {/* Line Color */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.line.color`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.lineColor")}
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input type="color" className="h-10 w-16" {...field} />
                                  <Input
                                    type="text"
                                    className="h-10 flex-1 bg-white"
                                    placeholder="#333333"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Line Width */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.line.width`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.lineWidth")}
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-4">
                                  <Slider
                                    value={[field.value || 2]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    max={5}
                                    min={1}
                                    step={0.5}
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    className="h-10 w-16 bg-white"
                                    value={field.value || 2}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    min={1}
                                    max={5}
                                    step={0.5}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Line Dash */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.line.dash`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.lineDash")}
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="solid">{t("ternary.solid")}</SelectItem>
                                  <SelectItem value="dot">{t("ternary.dot")}</SelectItem>
                                  <SelectItem value="dash">{t("ternary.dash")}</SelectItem>
                                  <SelectItem value="longdash">{t("ternary.longdash")}</SelectItem>
                                  <SelectItem value="dashdot">{t("ternary.dashdot")}</SelectItem>
                                  <SelectItem value="longdashdot">
                                    {t("ternary.longdashdot")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Fill Style */}
                      <div className="space-y-4">
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          {t("ternary.fillStyle")}
                        </p>

                        {/* Fill Color */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.fillcolor`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.fillColor")}
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="color"
                                    className="h-10 w-16"
                                    {...field}
                                    value={field.value ?? "#cccccc"}
                                  />
                                  <Input
                                    type="text"
                                    className="h-10 flex-1 bg-white"
                                    placeholder={t("ternary.optionalFillColor")}
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Opacity */}
                        <FormField
                          control={form.control}
                          name={`config.config.boundaries.${index}.opacity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("ternary.opacity")}
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-4">
                                  <Slider
                                    value={[field.value || 0.3]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    max={1}
                                    min={0}
                                    step={0.1}
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    className="h-10 w-16 bg-white"
                                    value={field.value || 0.3}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {boundariesFields.length === 0 && (
                <div className="border-muted-foreground/25 rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">{t("ternary.noBoundaries")}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("ternary.noBoundariesDescription")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Appearance (left) and Chart Options & Axis Appearance (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance (formerly Display Options) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="config.config.display.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("chartTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterChartTitle")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.display.showLegend"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                      <div className="text-muted-foreground text-xs">
                        {t("configuration.showLegendDescription")}
                      </div>
                    </div>
                    <FormControl className="flex items-center">
                      <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.display.legendPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.legendPosition")}
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="top">{t("legendPositions.top")}</SelectItem>
                        <SelectItem value="bottom">{t("legendPositions.bottom")}</SelectItem>
                        <SelectItem value="left">{t("legendPositions.left")}</SelectItem>
                        <SelectItem value="right">{t("legendPositions.right")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Display Mode */}
              <FormField
                control={form.control}
                name="config.config.mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("ternary.displayMode")}
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="markers">{t("ternary.markers")}</SelectItem>
                        <SelectItem value="lines">{t("ternary.lines")}</SelectItem>
                        <SelectItem value="lines+markers">{t("ternary.linesMarkers")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Chart Options & Axis Appearance (combined) */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TriangleDashed className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">
                {t("ternary.ternaryChartOptions")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sum Configuration */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="config.config.sum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("ternary.sum")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-4">
                        <Slider
                          value={[field.value || 100]}
                          onValueChange={(value) => field.onChange(value[0])}
                          max={200}
                          min={1}
                          step={1}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          className="w-20"
                          value={field.value || 100}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          min={1}
                          max={200}
                        />
                      </div>
                    </FormControl>
                    <p className="text-muted-foreground text-sm">{t("ternary.sumDescription")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Axis Appearance Section */}
            <div className="space-y-4">
              <h5 className="text-sm font-medium">{t("ternary.axisAppearance")}</h5>

              {/* Grid Options */}
              <div className="space-y-4">
                <h6 className="text-muted-foreground text-sm font-medium">
                  {t("ternary.gridOptions")}
                </h6>

                <FormField
                  control={form.control}
                  name="config.config.aAxisProps.showgrid"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("ternary.showGridLines")}
                        </FormLabel>
                        <div className="text-muted-foreground text-xs">
                          {t("ternary.showGridLinesDescription")}
                        </div>
                      </div>
                      <FormControl className="flex items-center">
                        <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.aAxisProps.showline"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("ternary.showAxisLines")}
                        </FormLabel>
                        <div className="text-muted-foreground text-xs">
                          {t("ternary.showAxisLinesDescription")}
                        </div>
                      </div>
                      <FormControl className="flex items-center">
                        <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.aAxisProps.showticklabels"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("ternary.showTickLabels")}
                        </FormLabel>
                        <div className="text-muted-foreground text-xs">
                          {t("ternary.showTickLabelsDescription")}
                        </div>
                      </div>
                      <FormControl className="flex items-center">
                        <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Grid Color and Axis Line Color in one row */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Grid Color */}
                  <FormField
                    control={form.control}
                    name="config.config.aAxisProps.gridcolor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("ternary.gridColor")}
                        </FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="color"
                              className="h-10 w-16"
                              {...field}
                              value={field.value || "#E6E6E6"}
                            />
                            <Input
                              type="text"
                              className="flex-1"
                              placeholder="#E6E6E6"
                              {...field}
                              value={field.value || ""}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Axis Line Color */}
                  <FormField
                    control={form.control}
                    name="config.config.aAxisProps.linecolor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("ternary.axisLineColor")}
                        </FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="color"
                              className="h-10 w-16"
                              {...field}
                              value={field.value || "#E6E6E6"}
                            />
                            <Input
                              type="text"
                              className="flex-1"
                              placeholder="#E6E6E6"
                              {...field}
                              value={field.value || ""}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
