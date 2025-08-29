"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CreateUserProfileBody } from "@repo/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Textarea,
} from "@repo/ui/components";

interface ProfileCardProps {
  form: UseFormReturn<CreateUserProfileBody>;
}

export function ProfileCard({ form }: ProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Details Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Professional Title Section */}
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel className="text-gray-500">Professional Title</FormLabel>
            <span className="inline-flex cursor-not-allowed select-none items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 opacity-70">
              Disabled
            </span>
          </div>
          <FormControl>
            <Input
              placeholder="Your professional title"
              disabled
              className="bg-muted text-muted-foreground"
              value=""
            />
          </FormControl>
        </FormItem>

        {/* Bio Section */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about yourself"
                  rows={3}
                  {...field}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Organization Section */}
        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Institution/Organization</FormLabel>
              <FormControl>
                <Input
                  placeholder="Search or create organization"
                  {...field}
                  value={field.value}
                  trim
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Department Field */}
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel className="text-gray-500">Department</FormLabel>
            <span className="inline-flex cursor-not-allowed select-none items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 opacity-70">
              Disabled
            </span>
          </div>
          <FormControl>
            <Input
              placeholder="Your department"
              disabled
              className="bg-muted text-muted-foreground"
              value=""
            />
          </FormControl>
        </FormItem>
      </CardContent>
    </Card>
  );
}
