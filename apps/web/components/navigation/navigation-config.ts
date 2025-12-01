import {
  Archive,
  BookOpen,
  CirclePlus,
  Code,
  FileSliders,
  Home,
  LogOut,
  Microscope,
  RadioReceiver,
  Settings,
  User,
  Webcam,
} from "lucide-react";

export interface NavLink {
  titleKey: string; // i18n key for the title
  url: (locale: string) => string;
  icon?: string; // Icon name that maps to Lucide icons
}

export interface NavSection {
  items: NavLink[];
}

/**
 * Icon mapping for navigation items
 */
export const iconMap = {
  Home,
  Microscope,
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
} as const;

/**
 * Main navigation items (sidebar/mobile menu)
 */
export const mainNavigation = {
  dashboard: {
    titleKey: "dashboard.title",
    namespace: "common",
    url: (locale: string) => `/${locale}/platform`,
    icon: "Home",
  },
  experiments: {
    titleKey: "sidebar.experiments",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/experiments`,
    icon: "Microscope",
  },
  protocols: {
    titleKey: "sidebar.protocols",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/protocols`,
    icon: "FileSliders",
  },
  macros: {
    titleKey: "sidebar.macros",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/macros`,
    icon: "Code",
  },
} as const;

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
  logout: {
    titleKey: "navigation.logout",
    namespace: "navigation",
    url: (locale: string) => `/${locale}/platform/signout`,
    icon: "LogOut",
  },
} as const;

/**
 * Create menu items (sidebar footer, mobile bottom button)
 */
export const createNavigation = {
  buttonKey: "common.create",
  items: [
    {
      titleKey: "common.protocolLabel",
      namespace: "common",
      url: (locale: string) => `/${locale}/platform/protocols/new`,
    },
    {
      titleKey: "sidebar.experiments",
      namespace: "navigation",
      url: (locale: string) => `/${locale}/platform/experiments/new`,
    },
    {
      titleKey: "sidebar.macros",
      namespace: "navigation",
      url: (locale: string) => `/${locale}/platform/macros/new`,
    },
  ],
} as const;

/**
 * Other navigation items (notifications, language switcher)
 */
export const auxiliaryNavigation = {
  notifications: {
    titleKey: "common.notifications",
    namespace: "common",
    disabled: true,
  },
  language: {
    titleKey: "common.language",
    namespace: "common",
  },
} as const;
