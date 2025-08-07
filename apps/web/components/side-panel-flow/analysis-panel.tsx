"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@repo/ui/components";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components";

interface AnalysisPanelProps {
  selectedMeasurementOption?: string;
  onChange?: (measurementOption: string) => void;
}

// Mock measurement options for analysis
const MEASUREMENT_OPTIONS = [
  {
    id: "plot-co2",
    name: "Plot CO₂ Levels",
    description: "Visualize carbon dioxide concentration over time",
    category: "Gas Analysis",
  },
  {
    id: "plot-fluorescence",
    name: "Plot Fluorescence",
    description: "Display chlorophyll fluorescence measurements",
    category: "Optical Measurements",
  },
  {
    id: "plot-temperature",
    name: "Plot Temperature",
    description: "Temperature variation analysis and trends",
    category: "Environmental",
  },
  {
    id: "plot-humidity",
    name: "Plot Humidity",
    description: "Relative humidity measurements over time",
    category: "Environmental",
  },
  {
    id: "plot-ph-levels",
    name: "Plot pH Levels",
    description: "pH measurement analysis and visualization",
    category: "Chemical Analysis",
  },
  {
    id: "plot-light-intensity",
    name: "Plot Light Intensity",
    description: "PAR and light spectrum analysis",
    category: "Optical Measurements",
  },
  {
    id: "statistical-summary",
    name: "Statistical Summary",
    description: "Generate comprehensive statistical analysis",
    category: "Data Analysis",
  },
  {
    id: "correlation-analysis",
    name: "Correlation Analysis",
    description: "Find relationships between measurement variables",
    category: "Data Analysis",
  },
];

export function AnalysisPanel({ selectedMeasurementOption = "", onChange }: AnalysisPanelProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedOption = MEASUREMENT_OPTIONS.find(
    (option) => option.id === selectedMeasurementOption,
  );

  const filteredOptions = MEASUREMENT_OPTIONS.filter(
    (option) =>
      option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelectOption = (optionId: string) => {
    if (onChange) {
      onChange(optionId);
    }
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">Analysis Options</CardTitle>
      </CardHeader>
      <CardContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedOption ? (
                <div className="flex flex-col items-start">
                  <span className="font-medium">{selectedOption.name}</span>
                  <span className="text-muted-foreground text-xs">{selectedOption.category}</span>
                </div>
              ) : (
                "Select measurement analysis..."
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <div className="p-2">
              <input
                type="text"
                placeholder="Search analysis options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{option.name}</span>
                    <span className="text-muted-foreground text-xs">{option.description}</span>
                    <span className="mt-1 text-xs text-blue-600">{option.category}</span>
                  </div>
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div className="text-muted-foreground px-3 py-2 text-sm">
                  No analysis options found.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
