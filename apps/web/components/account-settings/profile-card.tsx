"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CreateUserProfileBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
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
  const { t: tCommon } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tAccount("settings.profileCard.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Details Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tCommon("registration.firstName")}</FormLabel>
                <FormControl>
                  <Input placeholder={tCommon("registration.firstNamePlaceholder")} {...field} />
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
                <FormLabel>{tCommon("registration.lastName")}</FormLabel>
                <FormControl>
                  <Input placeholder={tCommon("registration.lastNamePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Professional Title Section */}
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel className="text-gray-500">
              {tAccount("settings.profileCard.professionalTitle")}
            </FormLabel>
            <span className="inline-flex cursor-not-allowed select-none items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 opacity-70">
              {tAccount("settings.disabled")}
            </span>
          </div>
          <FormControl>
            <Input
              placeholder={tAccount("settings.profileCard.professionalTitlePlaceholder")}
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
              <FormLabel>{tAccount("settings.profileCard.bio")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={tAccount("settings.profileCard.bioPlaceholder")}
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
              <FormLabel>{tAccount("settings.profileCard.institution")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={tAccount("settings.profileCard.institutionPlaceholder")}
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
            <FormLabel className="text-gray-500">
              {tAccount("settings.profileCard.department")}
            </FormLabel>
            <span className="inline-flex cursor-not-allowed select-none items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 opacity-70">
              {tAccount("settings.disabled")}
            </span>
          </div>
          <FormControl>
            <Input
              placeholder={tAccount("settings.profileCard.departmentPlaceholder")}
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
