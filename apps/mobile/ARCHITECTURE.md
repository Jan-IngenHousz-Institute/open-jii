# Mobile App Architecture Improvements

## Overview

The mobile app's tab-based UI has been reorganized to improve maintainability, separation of concerns, and user experience. The previous implementation had several issues:

- **Overly complex measurement screen** (1000+ lines)
- **Poor separation of concerns**
- **Mixed navigation patterns**
- **Duplicated functionality**

## New Architecture

### 1. Component Structure

```
src/
├── components/
│   └── measurement/
│       ├── ConnectionSetup.tsx      # Device connection setup
│       ├── DeviceList.tsx          # Available devices list
│       ├── MeasurementScreen.tsx   # Active measurement interface
│       ├── MeasurementLayout.tsx   # Common layout wrapper
│       └── index.ts                # Barrel exports
├── hooks/
│   └── useMeasurement.ts           # Measurement state management
├── types/
│   └── measurement.ts              # TypeScript interfaces
└── app/
    ├── (tabs)/
    │   ├── measurement.tsx         # Simplified tab entry point
    │   ├── experiments.tsx         # Experiment management
    │   ├── index.tsx              # Home dashboard
    │   └── profile.tsx            # User profile
    ├── setup.tsx                  # Device setup flow
    └── measurement-active.tsx     # Active measurement session
```

### 2. Navigation Flow

**Before:**

- Single complex measurement tab with internal step-based navigation
- State management scattered across components
- Mixed UI patterns

**After:**

- Clear navigation hierarchy:
  - `measurement.tsx` → Entry point with status overview
  - `setup.tsx` → Device connection and experiment selection
  - `measurement-active.tsx` → Active measurement session

### 3. State Management

#### Custom Hooks

- **`useMeasurementState`**: Manages experiment selection and device connection
- **`useDeviceScan`**: Handles device discovery and scanning
- **`useMeasurement`**: Manages measurement execution and data

#### Benefits

- Centralized state logic
- Reusable across components
- Better error handling
- Consistent data persistence

### 4. Component Separation

#### ConnectionSetup Component

- Experiment selection
- Connection type selection (Bluetooth, BLE, USB)
- Platform-specific UI handling (iOS limitations)

#### DeviceList Component

- Device discovery results
- Connection strength indicators
- Device type icons

#### MeasurementScreen Component

- Protocol selection
- Measurement execution
- Results display
- Data upload functionality

### 5. Type Safety

New TypeScript interfaces provide better type safety:

```typescript
interface Device {
  id: string;
  name: string;
  rssi?: number | null;
  type: ConnectionType;
}

interface MeasurementData {
  timestamp: string;
  experiment: string;
  protocol: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}
```

## Benefits of the New Architecture

### 1. **Maintainability**

- Smaller, focused components
- Clear responsibility boundaries
- Easier to test and debug

### 2. **Reusability**

- Components can be used in different contexts
- State logic is centralized and reusable
- Consistent UI patterns

### 3. **User Experience**

- Clear navigation flow
- Better error handling and feedback
- Consistent state management across screens

### 4. **Developer Experience**

- Better TypeScript support
- Easier to extend and modify
- Clear component hierarchy

## Migration Guide

### From Old to New

1. **State Management**: Replace local state with custom hooks
2. **Navigation**: Use screen-based navigation instead of internal steps
3. **Components**: Break down large components into smaller, focused ones
4. **Types**: Use TypeScript interfaces for better type safety

### File Changes

- `measurement.tsx`: Reduced from 1000+ lines to ~200 lines
- Created: `ConnectionSetup.tsx`, `DeviceList.tsx`, `MeasurementScreen.tsx`
- Created: `useMeasurement.ts` hook with state management
- Created: `measurement.ts` types file

## Usage Examples

### Using the Measurement Hook

```typescript
const {
  selectedExperiment,
  connectedDevice,
  setSelectedExperiment,
  connectToDevice,
  disconnectDevice,
} = useMeasurementState();
```

### Using Components

```typescript
<ConnectionSetup
  selectedExperiment={selectedExperiment}
  onSelectExperiment={handleSelectExperiment}
  onScanForDevices={handleScanForDevices}
/>
```

## Future Improvements

1. **Add unit tests** for components and hooks
2. **Implement real device communication** protocols
3. **Add offline support** with proper data synchronization
4. **Enhance error handling** with retry mechanisms
5. **Add accessibility features** for better usability
6. **Implement proper logging** for debugging

## Best Practices

1. **Keep components focused** on single responsibilities
2. **Use custom hooks** for complex state logic
3. **Implement proper error boundaries**
4. **Use TypeScript interfaces** for all data structures
5. **Follow consistent naming conventions**
6. **Document component props and interfaces**
