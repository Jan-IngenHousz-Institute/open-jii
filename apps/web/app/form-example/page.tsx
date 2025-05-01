"use client";

import { useState } from "react";
import { SubmitHandler } from "react-hook-form";
import { z } from "validator";

import { Form, TextInput, Textarea, Select } from "@repo/ui/forms";

// Define the form schema with Zod
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  description: z.string().optional(),
  role: z.string().min(1, "Please select a role"),
});

// Infer the type from the schema
type FormData = z.infer<typeof formSchema>;

export default function FormExamplePage() {
  const [formData, setFormData] = useState<FormData | null>(null);

  const onSubmit: SubmitHandler<FormData> = (data) => {
    console.log("Form submitted:", data);
    setFormData(data);
  };

  return (
    <main className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Form Components Example</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <Form<FormData>
          schema={formSchema}
          defaultValues={{
            name: "",
            email: "",
            description: "",
            role: "",
          }}
          onSubmit={onSubmit}
          formProps={{ className: "space-y-6" }}
        >
          <TextInput
            name="name"
            label="Full Name"
            placeholder="Enter your full name"
            helpText="We'll use this to address you in communications"
          />

          <TextInput
            name="email"
            label="Email Address"
            type="email"
            placeholder="your.email@example.com"
            helpText="We'll never share your email with anyone else"
          />

          <Textarea
            name="description"
            label="About You"
            placeholder="Tell us a bit about yourself"
            rows={4}
            helpText="Optional information to help us know you better"
          />

          <Select
            name="role"
            label="Your Role"
            options={[
              { value: "researcher", label: "Researcher" },
              { value: "student", label: "Student" },
              { value: "professor", label: "Professor" },
              { value: "other", label: "Other" },
            ]}
            helpText="Select the role that best describes you"
            emptyOptionLabel="Select your role"
          />

          <div className="pt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Submit Form
            </button>
          </div>
        </Form>
      </div>

      {formData && (
        <div className="mt-8 bg-green-50 p-6 rounded-lg border border-green-200">
          <h2 className="text-xl font-semibold mb-4 text-green-800">
            Form Submission Result
          </h2>
          <pre className="bg-white p-4 rounded overflow-auto max-h-60">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
