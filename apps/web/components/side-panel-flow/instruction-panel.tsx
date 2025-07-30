import React from "react";

import { RichTextarea } from "@repo/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

interface InstructionPanelProps {
  value: string;
  onChange: (val: string) => void;
}

export function InstructionPanel({ value, onChange }: InstructionPanelProps) {
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
        />
      </CardContent>
    </Card>
  );
}
