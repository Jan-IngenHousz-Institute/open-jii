"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { env } from "../env";
import { POSTHOG_CLIENT_CONFIG } from "../lib/posthog-config";

interface PostHogLib {
  init: (apiKey: string, config: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    posthog?: PostHogLib & {
      __loaded?: boolean;
      isFeatureEnabled: (flagKey: string) => boolean | undefined;
      onFeatureFlags: (callback: () => void) => () => void;
    };
  }
}

/**
 * PostHog provider component that initializes the PostHog client
 * Should be placed at the root of the application to ensure tracking works
 *
 * Uses script-based loading for better compatibility with Turbopack
 *
 * @example
 * ```tsx
 * <PostHogProvider>
 *   <App />
 * </PostHogProvider>
 * ```
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const initAttempted = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initAttempted.current) return;
    initAttempted.current = true;

    const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;

    // Skip initialization if no valid key
    if (!posthogKey || posthogKey.startsWith("phc_0000")) {
      return;
    }

    const script = document.createElement("script");
    script.innerHTML = `
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init fi Cr Or ci Tr Ir capture Mi calculateEventProperties Ar register register_once register_for_session unregister unregister_for_session Nr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty jr Mr createPersonProfile Lr kr Ur opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Fr debug M Dr getPageViewId captureTraceFeedback captureTraceMetric Sr".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      posthog.init('${posthogKey}', ${JSON.stringify(POSTHOG_CLIENT_CONFIG)});
    `;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return <>{children}</>;
}
