"use server";

import { redirect } from 'next/navigation'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


export async function editExperiment(formData: FormData) {
  // Create a new post
  // ...
  console.log("Saving edited experiment", formData);

  await sleep(50);

  // Redirect to the new post
  redirect("/openjii/experiments")
}
