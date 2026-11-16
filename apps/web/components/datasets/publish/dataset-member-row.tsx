"use client";

import type { DatasetMember } from "@repo/api/domains/dataset/dataset.schema";

import { DatasetPersonIdentity } from "./dataset-person-identity";
import { PersonRoleSelect } from "./person-role-select";
import type { PersonRole } from "./use-dataset-people";
import { personKey } from "./use-dataset-people";

interface DatasetMemberRowProps {
  member: DatasetMember;
  onRoleChange: (key: string, role: PersonRole) => void;
}

/** A member who is neither an author nor a contributor, so nothing has been sent to them. */
export function DatasetMemberRow({ member, onRoleChange }: DatasetMemberRowProps) {
  const name = `${member.givenName} ${member.familyName}`;

  const handleRoleChange = (role: PersonRole) => onRoleChange(personKey(member), role);

  return (
    <li className="flex items-center gap-3 py-2.5">
      <DatasetPersonIdentity {...member} email={null} origin={null} request={null} />
      <PersonRoleSelect name={name} role="neither" onChange={handleRoleChange} />
    </li>
  );
}
