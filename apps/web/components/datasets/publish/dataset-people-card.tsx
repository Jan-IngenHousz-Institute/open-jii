"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetMembers } from "@/hooks/dataset/useDatasetMembers/useDatasetMembers";
import { UsersRound } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { DatasetAuthor, DatasetMember } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormField, FormItem, FormMessage } from "@repo/ui/components/form";
import { Skeleton } from "@repo/ui/components/skeleton";

import { AddPersonByEmailForm } from "./add-person-by-email-form";
import { AddPersonMenu } from "./add-person-menu";
import { DatasetAuthorList } from "./dataset-author-list";
import { DatasetAuthorsNotes } from "./dataset-authors-notes";
import { DatasetContributorList } from "./dataset-contributor-list";
import { DatasetMemberRow } from "./dataset-member-row";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import { HostingInstitutionRow } from "./hosting-institution-row";
import { PeopleGroup } from "./people-group";
import { StepLoadError } from "./step-load-error";
import { personKey, useDatasetPeople } from "./use-dataset-people";

interface DatasetPeopleCardProps {
  form: UseFormReturn<PublishDatasetForm>;
  datasetId: string;
}

/** Every member as an author, a contributor or neither, people from beyond, and JII as host. */
export function DatasetPeopleCard({ form, datasetId }: DatasetPeopleCardProps) {
  const { t } = useTranslation("datasets");
  const { data: members, isLoading, isError, refetch } = useDatasetMembers(datasetId);
  const people = useDatasetPeople(form, members ?? []);
  const [isInviting, setIsInviting] = useState(false);

  const hasContributors = people.contributors.length > 0;
  const hasNeither = people.neither.length > 0;

  const openInvite = () => setIsInviting(true);
  const closeInvite = () => setIsInviting(false);
  const handleInvite = (author: DatasetAuthor) => {
    people.invite(author);
    setIsInviting(false);
  };
  const handleRetry = () => {
    void refetch();
  };

  const renderMember = (member: DatasetMember) => (
    <DatasetMemberRow key={personKey(member)} member={member} onRoleChange={people.setRole} />
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={people.makeEveryoneAuthor}>
        <UsersRound className="size-4" />
        {t("describe.makeEveryoneAuthor")}
      </Button>
      <AddPersonMenu onAddByEmail={openInvite} />
    </div>
  );

  const body = () => {
    if (isError) {
      return (
        <StepLoadError
          message={t("publish.loadError")}
          retryLabel={t("publish.retry")}
          onRetry={handleRetry}
        />
      );
    }
    if (isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }
    return (
      <>
        <FormField
          control={form.control}
          name="authors"
          render={() => (
            <FormItem>
              <PeopleGroup
                title={t("describe.authorsGroup")}
                help={t("describe.authorsGroupHelp")}
                testId="dataset-authors"
              >
                <DatasetAuthorList form={form} onRoleChange={people.setRole} />
              </PeopleGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasContributors ? (
          <PeopleGroup
            title={t("describe.contributorsGroup")}
            help={t("describe.contributorsGroupHelp")}
            testId="dataset-contributors"
          >
            <DatasetContributorList form={form} onRoleChange={people.setRole} />
          </PeopleGroup>
        ) : null}

        {hasNeither ? (
          <PeopleGroup
            title={t("describe.neitherGroup")}
            help={t("describe.neitherGroupHelp")}
            testId="dataset-not-named"
          >
            <ul className="divide-border divide-y">{people.neither.map(renderMember)}</ul>
          </PeopleGroup>
        ) : null}

        {isInviting ? (
          <AddPersonByEmailForm onInvite={handleInvite} onCancel={closeInvite} />
        ) : null}

        <HostingInstitutionRow />

        <DatasetAuthorsNotes authors={people.authors} contributors={people.contributors} />
      </>
    );
  };

  return (
    <SettingsCard
      title={t("describe.peopleTitle")}
      description={t("describe.peopleDescription")}
      action={actions}
      contentClassName="space-y-5"
      data-testid="dataset-people"
    >
      {body()}
    </SettingsCard>
  );
}
