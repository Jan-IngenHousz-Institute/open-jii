"use server";

import { contract } from "@/lib/tsr";
import { initClient } from "@ts-rest/core";
import { headers } from "next/headers";
import { env } from "~/env";

async function getClient() {
  const headersList = await headers();
  const headersObject = Object.fromEntries(headersList.entries());

  return initClient(contract, {
    baseUrl: env.NEXT_PUBLIC_API_URL,
    baseHeaders: {
      "x-app-source": "ts-rest",
      ...headersObject,
    },
  });
}

interface EntityInfo {
  id: string;
  name: string;
  type: "experiment" | "macro" | "protocol";
}

/**
 * Detect if a segment is an entity ID based on its position in the path.
 * Returns the entity type if the previous segment indicates this is an ID.
 */
function detectEntityType(segments: string[], index: number): EntityInfo["type"] | null {
  if (index === 0) return null;

  const previousSegment = segments[index - 1];

  if (previousSegment === "experiments" || previousSegment === "experiments-archive") {
    return "experiment";
  }
  if (previousSegment === "macros") return "macro";
  if (previousSegment === "protocols") return "protocol";

  return null;
}

/**
 * Fetch entity name from the API based on type and ID
 */
async function fetchEntityName(
  id: string,
  type: EntityInfo["type"],
): Promise<{ name: string } | null> {
  try {
    const client = await getClient();

    switch (type) {
      case "experiment": {
        const response = await client.experiments.getExperiment({
          params: { id },
        });

        if (response.status === 200) {
          return { name: response.body.name };
        }
        break;
      }

      case "macro": {
        const response = await client.macros.getMacro({
          params: { id },
        });

        if (response.status === 200) {
          return { name: response.body.name };
        }
        break;
      }

      case "protocol": {
        const response = await client.protocols.getProtocol({
          params: { id },
        });

        if (response.status === 200) {
          return { name: response.body.name };
        }
        break;
      }
    }
  } catch (error) {
    console.error("Failed to fetch %s name for %s:", type, id, error);
  }

  return null;
}

export interface BreadcrumbSegment {
  segment: string;
  title: string;
  href: string;
}

/**
 * Enrich path segments with entity names fetched from the API
 */
export async function enrichPathSegments(
  pathname: string,
  locale: string,
): Promise<BreadcrumbSegment[]> {
  const pathNames = pathname.split("/").filter((path) => path);

  // Remove locale and 'platform' prefix
  const segments = pathNames.slice(2);

  // Do not return breadcrumbs for platform root or first-level routes
  if (segments.length <= 1) {
    return [];
  }

  // Find the first entity ID in the path (segments that come after entity type routes)
  let entityIdIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    if (detectEntityType(segments, i)) {
      entityIdIndex = i;
      break;
    }
  }

  // If we found an entity ID, only show breadcrumbs up to and including that segment
  // This prevents tab routes (like /experiments/{id}/data, /experiments/{id}/analysis) from appearing
  const displaySegments = entityIdIndex !== -1 ? segments.slice(0, entityIdIndex + 1) : segments;

  // Enrich segments with entity names
  const enrichedSegments: BreadcrumbSegment[] = [];

  for (let i = 0; i < displaySegments.length; i++) {
    const segment = displaySegments[i];
    let title = segment;

    // Check if this segment is an entity ID based on position
    const entityType = detectEntityType(displaySegments, i);

    if (entityType) {
      const entityInfo = await fetchEntityName(segment, entityType);
      if (entityInfo) {
        title = entityInfo.name;
      }
    }

    const href = `/${locale}/platform/${displaySegments.slice(0, i + 1).join("/")}`;

    enrichedSegments.push({
      segment,
      title,
      href,
    });
  }

  return enrichedSegments;
}
