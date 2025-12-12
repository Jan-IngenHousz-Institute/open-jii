# @repo/i18n

A comprehensive internationalization (i18n) package for the openJII project, based on i18next and React i18next.

## Features

- 🌍 Support for multiple locales (en-US, de-DE)
- 🔧 TypeScript support with type-safe translation keys
- ⚡ Server-side rendering (SSR) support for Next.js
- 🎯 Client-side hydration without flickering
- 📦 Namespace-based organization for better maintainability
- 🛣️ URL-based locale routing with Next.js
- 🔄 Automatic language detection
- 📱 Responsive locale switching

## Supported Locales

- `en-US` - English (United States) - Default
- `de-DE` - German (Germany)

## Namespaces

- `common` - General UI elements, buttons, labels
- `navigation` - Navigation menus, breadcrumbs, sidebar
- `experiments` - Experiment-related translations
- `dashboard` - Dashboard-specific content
- `auth` - Authentication forms and messages
- `forms` - Form validation and labels
- `errors` - Error messages and descriptions

## Installation

This package is automatically available in the workspace. No separate installation needed.

## Usage

### Server-side (SSR)

```typescript
import { initTranslations } from "@repo/i18n/server";

// In your page component or getServerSideProps
const { t, resources } = await initTranslations({
  locale: "en-US",
  namespaces: ["common", "navigation"],
});

console.log(t("common:homepage")); // "Homepage"
```

### Client-side

```typescript
'use client';

import { useTranslation } from '@repo/i18n/client';

export function MyComponent() {
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('homepage')}</h1>
      <button>{t('save')}</button>
    </div>
  );
}
```

### Next.js Middleware (for URL-based routing)

```typescript
// middleware.ts
import { i18nRouter } from "@repo/i18n";
import { i18nConfig } from "@repo/i18n/config";

export function middleware(request: NextRequest) {
  return i18nRouter(request, i18nConfig);
}

export const config = {
  matcher: "/((?!api|static|.*\\..*|_next).*)",
};
```

### Type-safe Usage

```typescript
import { createTranslationKey } from "@repo/i18n";

// Create type-safe keys
const key = createTranslationKey("common:homepage");
const value = t(key); // Fully typed
```

## Configuration

The package exports several configuration objects:

```typescript
import {
  defaultLocale,
  // 'en-US'
  locales,
  // ['en-US', 'de-DE']
  i18nConfig,
  // Complete Next.js i18n config
  defaultNamespace,
  // 'common'
  namespaces, // All available namespaces
} from "@repo/i18n/config";
```

## Adding New Translations

1. Add new translations to the appropriate namespace files in `locales/{locale}/{namespace}.json`
2. Ensure all supported locales have the same keys
3. Update the namespace types in `config.ts` if adding new namespaces

## Project Structure

```
packages/i18n/
├── src/
│   ├── config.ts      # Configuration and types
│   ├── server.ts      # Server-side initialization
│   ├── client.ts      # Client-side hooks
│   └── index.ts       # Main exports
├── locales/
│   ├── en-US/
│   │   ├── common.json
│   │   ├── navigation.json
│   │   └── experiments.json
│   └── de-DE/
│       ├── common.json
│       ├── navigation.json
│       └── experiments.json
└── package.json
```

## Best Practices

1. **Namespace Organization**: Keep related translations in the same namespace
2. **Key Naming**: Use descriptive, hierarchical keys (e.g., `form.validation.required`)
3. **Pluralization**: Use i18next pluralization features for countable items
4. **Interpolation**: Use i18next interpolation for dynamic content
5. **Type Safety**: Always use TypeScript types for better development experience

## Examples

### Basic Translation

```typescript
t("common:save"); // "Save"
```

### Namespaced Translation

```typescript
t("experiments:form.name"); // "Experiment Name"
```

### Interpolation

```typescript
t("common:welcome", { name: "John" }); // "Welcome, John!"
```

### Pluralization

```typescript
t("experiments:count", { count: 5 }); // "5 experiments"
```
