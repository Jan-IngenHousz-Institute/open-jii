import React from "react";

import { RichTextarea } from "@repo/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

interface InstructionPanelProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function InstructionPanel({ value, onChange, disabled = false }: InstructionPanelProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">Instruction Details</CardTitle>
      </CardHeader>
      <CardContent>
        <RichTextarea
          value={value}
          onChange={onChange}
          placeholder="Enter instruction details..."
          isDisabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
