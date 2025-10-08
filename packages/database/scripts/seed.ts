import { seedSystemOwner } from "../src/seed-system-owner";

seedSystemOwner()
  .then(() => console.log("Seeding complete"))
  .catch((err) => console.error("Seeding failed:", err));
