import { zodResolver } from "@hookform/resolvers/zod";
import React, { ReactNode } from "react";
import {
  useForm,
  FormProvider,
  SubmitHandler,
  UseFormProps,
  FieldValues,
} from "react-hook-form";
import { z } from "validator";

export interface FormProps<TFormValues extends FieldValues> {
  id?: string;
  schema: z.Schema<TFormValues>;
  defaultValues?: UseFormProps<TFormValues>["defaultValues"];
  children: ReactNode;
  onSubmit: SubmitHandler<TFormValues>;
  formProps?: React.FormHTMLAttributes<HTMLFormElement>;
  formOptions?: UseFormProps<TFormValues>;
}

/**
 * A smart form component that handles form state, validation, and submission
 * using react-hook-form.
 */
export function Form<TFormValues extends FieldValues = FieldValues>({
  id,
  schema,
  defaultValues,
  children,
  onSubmit,
  formProps,
  formOptions,
}: FormProps<TFormValues>) {
  // Initialize form with react-hook-form
  const methods = useForm<TFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    ...formOptions,
  });

  return (
    <FormProvider {...methods}>
      <form id={id} onSubmit={methods.handleSubmit(onSubmit)} {...formProps}>
        {children}
      </form>
    </FormProvider>
  );
}

export default Form;
