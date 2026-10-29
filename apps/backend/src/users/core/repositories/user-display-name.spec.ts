import { mapUserMetadata } from "./user-display-name";

describe("user display metadata", () => {
  const person = {
    userId: "person",
    isAnonymous: false,
    name: "Account name",
    firstName: "Researcher",
    lastName: "Family",
    avatarUrl: "avatar",
    email: "person@example.test",
  };
  it("preserves anonymized researcher fields and removes account-only fields", () => {
    expect(mapUserMetadata(person)).toEqual({
      userId: "person",
      firstName: "Researcher",
      lastName: "Family",
      avatarUrl: "avatar",
      email: "person@example.test",
      isGuest: false,
      isFormerGuest: false,
    });
    expect(mapUserMetadata({ ...person, isAnonymous: null, name: null })).toMatchObject({
      firstName: "Researcher",
      isGuest: false,
    });
  });
  it("uses the guest's display name while clearing avatar, last name and email", () => {
    expect(mapUserMetadata({ ...person, isAnonymous: true, name: "Visitor" })).toEqual({
      userId: "person",
      firstName: "Visitor",
      lastName: "",
      avatarUrl: null,
      email: null,
      isGuest: true,
      isFormerGuest: false,
    });
    const { email: _email, ...withoutEmail } = person;
    expect(mapUserMetadata({ ...withoutEmail, isAnonymous: true, name: null })).toEqual({
      userId: "person",
      firstName: "Guest",
      lastName: "",
      avatarUrl: null,
      isGuest: true,
      isFormerGuest: false,
    });
  });
});
