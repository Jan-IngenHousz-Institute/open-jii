"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components";

interface AnalysisPanelProps {
  selectedMeasurementOption?: string;
  onChange: (measurementOption: string) => void;
  disabled?: boolean;
}

// Mock measurement options for analysis
const MEASUREMENT_OPTIONS = [
  {
    id: "plot-co2",
    name: "Plot CO₂ Levels",
    description: "Visualize carbon dioxide concentration over time",
    category: "Gas Analysis",
    createdBy: "Dr. Sarah Johnson",
  },
  {
    id: "plot-fluorescence",
    name: "Plot Fluorescence",
    description: "Display chlorophyll fluorescence measurements",
    category: "Optical Measurements",
    createdBy: "Prof. Michael Chen",
  },
  {
    id: "plot-temperature",
    name: "Plot Temperature",
    description: "Temperature variation analysis and trends",
    category: "Environmental",
    createdBy: "Lisa Rodriguez",
  },
  {
    id: "plot-humidity",
    name: "Plot Humidity",
    description: "Relative humidity measurements over time",
    category: "Environmental",
    createdBy: "David Kim",
  },
  {
    id: "plot-ph-levels",
    name: "Plot pH Levels",
    description: "pH measurement analysis and visualization",
    category: "Chemical Analysis",
    createdBy: "Dr. Emma Watson",
  },
  {
    id: "plot-light-intensity",
    name: "Plot Light Intensity",
    description: "PAR and light spectrum analysis",
    category: "Optical Measurements",
    createdBy: "John Smith",
  },
  {
    id: "statistical-summary",
    name: "Statistical Summary",
    description: "Generate comprehensive statistical analysis",
    category: "Data Analysis",
    createdBy: "Dr. Alex Turner",
  },
  {
    id: "correlation-analysis",
    name: "Correlation Analysis",
    description: "Find relationships between measurement variables",
    category: "Data Analysis",
    createdBy: "Maria Garcia",
  },
];

export function AnalysisPanel({
  selectedMeasurementOption = "",
  onChange,
  disabled = false,
}: AnalysisPanelProps) {
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
    if (disabled) return;
    onChange(optionId);
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
              disabled={disabled}
              className="w-full justify-between p-0"
            >
              <div className="flex w-full items-center gap-3 px-3 py-2">
                {selectedOption ? (
                  <>
                    {selectedOption.createdBy && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" alt={selectedOption.createdBy} />
                        <AvatarFallback className="text-xs">
                          {selectedOption.createdBy.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-1 flex-col items-start">
                      <span className="font-medium">Analysis: {selectedOption.name}</span>
                      <span className="text-muted-foreground text-xs">
                        #{selectedOption.category}
                        {selectedOption.createdBy && <> • by {selectedOption.createdBy}</>}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 text-left">Select measurement analysis...</div>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <div className="p-2">
              <input
                type="text"
                placeholder="Search analysis options..."
                value={searchTerm}
                onChange={(e) => (disabled ? undefined : setSearchTerm(e.target.value))}
                disabled={disabled}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={disabled}
                  className="w-full px-3 py-3 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    {option.createdBy && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" alt={option.createdBy} />
                        <AvatarFallback className="text-xs">
                          {option.createdBy.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{option.name}</span>
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                      <span className="mt-1 text-xs text-blue-600">
                        #{option.category}
                        {option.createdBy && <> • by {option.createdBy}</>}
                      </span>
                    </div>
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
