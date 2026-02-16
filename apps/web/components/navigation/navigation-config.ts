import {
  LayoutDashboard,
  Leaf,
  Archive,
  BookOpen,
  CirclePlus,
  Code,
  FileSliders,
  HelpCircle,
  LifeBuoy,
  LogOut,
  RadioReceiver,
  Settings,
  User,
  Webcam,
} from "lucide-react";

export interface NavLink {
  titleKey: string; // i18n key for the title
  namespace?: string; // i18n namespace (defaults to "common")
  url: (locale: string) => string;
  icon?: string; // Icon name that maps to Lucide icons
  external?: boolean; // Whether the link opens in a new tab
  items?: NavLink[]; // Optional sub-navigation items
}

export interface NavSection {
  items: NavLink[];
}

/**
 * Icon mapping for navigation items
 */
export const iconMap = {
  LayoutDashboard,
  Leaf,
  FileSliders,
  Code,
  Settings,
  LogOut,
  User,
  CirclePlus,
  Archive,
  BookOpen,
  RadioReceiver,
  Webcam,
  LifeBuoy,
  HelpCircle,
} as const;

/**
 * Main navigation items (sidebar/mobile menu)
 */
export const mainNavigation = {
  dashboard: {
    titleKey: "dashboard.title",
    namespace: "common",
    url: (locale: string) => `/${locale}/platform`,
    icon: "LayoutDashboard",
    items: [] as NavLink[],
  },
  experiments: {
    titleKey: "sidebar.experiments",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/experiments`,
    icon: "Leaf",
    items: [
      {
        titleKey: "sidebar.newExperiment",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/experiments/new`,
      },
      {
        titleKey: "sidebar.overview",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/experiments`,
      },
    ] as NavLink[],
  },
  protocols: {
    titleKey: "sidebar.protocols",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/protocols`,
    icon: "FileSliders",
    items: [
      {
        titleKey: "sidebar.newProtocol",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/protocols/new`,
      },
      {
        titleKey: "sidebar.overview",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/protocols`,
      },
    ] as NavLink[],
  },
  macros: {
    titleKey: "sidebar.macros",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/macros`,
    icon: "Code",
    items: [
      {
        titleKey: "sidebar.newMacro",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/macros/new`,
      },
      {
        titleKey: "sidebar.overview",
        namespace: "navigation",
        url: (locale: string) => `/${locale}/platform/macros`,
      },
    ] as NavLink[],
  },
};

/**
 * User menu items (desktop dropdown, mobile settings section)
 */
export const userNavigation = {
  account: {
    titleKey: "auth.account",
    namespace: "auth",
    url: (locale: string) => `/${locale}/platform/account/settings`,
    icon: "User",
  },
  support: {
    titleKey: "navigation.support",
    namespace: "navigation",
    url: (_locale: string) => "https://docs.openjii.org",
    icon: "LifeBuoy",
    external: true,
  },
  faq: {
    titleKey: "navigation.faq",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/faq`,
    icon: "HelpCircle",
  },
} as const;
