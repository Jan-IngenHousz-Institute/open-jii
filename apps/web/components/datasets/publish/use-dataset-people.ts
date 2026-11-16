import type { UseFormReturn } from "react-hook-form";

import type {
  DatasetAuthor,
  DatasetContributor,
  DatasetMember,
} from "@repo/api/domains/dataset/dataset.schema";

import type { PublishDatasetForm } from "./dataset-publish-schema";

export type PersonRole = "author" | "contributor" | "neither";

/** Anyone Describe lists: a named author or contributor, or a member who is neither yet. */
type Person = DatasetAuthor | DatasetContributor | DatasetMember;

/** A member is known by account, and someone invited by email by the address until they sign up. */
export function personKey(person: Person): string {
  if (person.userId !== null) {
    return person.userId;
  }
  return "email" in person && person.email !== null
    ? person.email
    : `${person.givenName} ${person.familyName}`;
}

const SET_OPTIONS = { shouldDirty: true, shouldValidate: true };

export interface DatasetPeople {
  authors: DatasetAuthor[];
  contributors: DatasetContributor[];
  /** The experiment's members nobody has named yet. */
  neither: DatasetMember[];
  setRole: (key: string, role: PersonRole) => void;
  makeEveryoneAuthor: () => void;
  invite: (author: DatasetAuthor) => void;
}

/**
 * The author, contributor and neither lists over the form's two arrays. Naming someone sends them a
 * request, and moving between author and contributor keeps the answer they already gave.
 */
export function useDatasetPeople(
  form: UseFormReturn<PublishDatasetForm>,
  members: DatasetMember[],
): DatasetPeople {
  const authors = form.watch("authors");
  const contributors = form.watch("contributors");

  const isNamed = (member: DatasetMember) => {
    const key = personKey(member);
    const matches = (person: Person) => personKey(person) === key;
    return authors.some(matches) || contributors.some(matches);
  };
  const neither = members.filter((member) => !isNamed(member));

  const affiliationOf = (key: string) =>
    members.find((member) => personKey(member) === key)?.affiliation ?? null;

  const asAuthor = (key: string): DatasetAuthor | undefined => {
    const contributor = contributors.find((person) => personKey(person) === key);
    if (contributor !== undefined) {
      const { contributorType: _type, ...person } = contributor;
      return { ...person, affiliation: affiliationOf(key) };
    }
    const member = members.find((person) => personKey(person) === key);
    return member === undefined
      ? undefined
      : { ...member, origin: "member", email: null, request: "pending" };
  };

  const asContributor = (key: string): DatasetContributor | undefined => {
    const author = authors.find((person) => personKey(person) === key);
    const source = author ?? asAuthor(key);
    if (source === undefined) {
      return undefined;
    }
    const { affiliation: _affiliation, ...person } = source;
    return { ...person, contributorType: "DataCollector" };
  };

  const without = <T extends Person>(people: T[], key: string) =>
    people.filter((person) => personKey(person) !== key);
  const withAdded = <T extends Person>(people: T[], person: T | undefined) =>
    person === undefined ? people : [...people, person];

  // Both moves are worked out before either list changes, since each reads the other.
  const setRole = (key: string, role: PersonRole) => {
    const isAuthor = authors.some((person) => personKey(person) === key);
    const isContributor = contributors.some((person) => personKey(person) === key);

    const nextAuthors = isAuthor ? authors : withAdded(authors, asAuthor(key));
    const nextContributors = isContributor
      ? contributors
      : withAdded(contributors, asContributor(key));

    form.setValue("authors", role === "author" ? nextAuthors : without(authors, key), SET_OPTIONS);
    form.setValue(
      "contributors",
      role === "contributor" ? nextContributors : without(contributors, key),
      SET_OPTIONS,
    );
  };

  const makeEveryoneAuthor = () => {
    const added = [...contributors, ...neither]
      .map((person) => asAuthor(personKey(person)))
      .filter((person): person is DatasetAuthor => person !== undefined);
    form.setValue("authors", [...authors, ...added], SET_OPTIONS);
    form.setValue("contributors", [], SET_OPTIONS);
  };

  const invite = (author: DatasetAuthor) => {
    form.setValue("authors", [...authors, author], SET_OPTIONS);
  };

  return { authors, contributors, neither, setRole, makeEveryoneAuthor, invite };
}
