/**
 * RN test harness for vitest — vendored from @srsholmes/vitest-react-native
 * @0.1.3 (MIT, Copyright (c) 2024 Simon Holmes). Upstream has a single
 * maintainer with no active support channel, so we keep the code in-tree.
 *
 * Two things live in this single file:
 *   1. Side-effects (on import): pirates require-hooks + jest-style mocks
 *      for react-native core modules, so RN imports resolve in Node.
 *   2. `reactNative()` — a vite plugin that strips Flow from RN packages,
 *      sets the right resolve conditions, and self-registers this file as
 *      a `setupFiles` entry so the side-effects run in every worker.
 */
import { addHook } from "pirates";
import removeTypes from "flow-remove-types";
import * as esbuild from "esbuild";
import fs from "fs";
import os from "os";
import { existsSync } from "fs";
import { createRequire } from "module";
import path, { dirname, resolve } from "path";
import { fileURLToPath } from "url";
var createTurboModuleProxy = () => {
  return (name) => {
    if (name === "NativeReactNativeFeatureFlagsCxx") {
      return new Proxy(
        {},
        {
          get: (_target, prop) => typeof prop === "string" ? () => false : void 0
        }
      );
    }
    return null;
  };
};
var turboModuleProxy = createTurboModuleProxy();
var g = globalThis;
g.__turboModuleProxy = turboModuleProxy;
g.nativeModuleProxy = new Proxy(
  {},
  {
    get: (_target, name) => turboModuleProxy(name)
  }
);
g.__DEV__ = true;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
g.nativeFabricUIManager = {};
g.window = globalThis;
g.cancelAnimationFrame = (id) => clearTimeout(id);
g.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
g.performance = globalThis.performance || { now: Date.now };
var require2 = createRequire(import.meta.url);
var reactNativeVersion = "0.83.0";
var pluginVersion = "0.2.0";
try {
  const reactNativePkg = require2("react-native/package.json");
  reactNativeVersion = reactNativePkg.version;
} catch {
}
try {
  const pluginPkg = require2("./package.json");
  pluginVersion = pluginPkg.version;
} catch {
}
var tmpDir = os.tmpdir();
var cacheDirBase = path.join(tmpDir, "vrn");
var version = `${reactNativeVersion}_${pluginVersion}`;
var cacheDir = path.join(cacheDirBase, version);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
try {
  const folders = fs.readdirSync(cacheDirBase);
  folders.forEach((folder) => {
    if (folder !== version) {
      try {
        fs.rmSync(path.join(cacheDirBase, folder), { recursive: true });
      } catch {
      }
    }
  });
} catch {
}
var root = process.cwd();
var mocked = [];
var getMocked = (filePath) => mocked.find((entry) => filePath.includes(entry.path));
var transformCode = (code) => {
  const result = removeTypes(code, { all: true }).toString();
  return esbuild.transformSync(result, {
    loader: "jsx",
    format: "cjs",
    platform: "node"
  }).code;
};
var normalize = (p) => p.replace(/\\/g, "/");
var cacheExists = (cachePath) => fs.existsSync(cachePath);
var readFromCache = (cachePath) => fs.readFileSync(cachePath, "utf-8");
var writeToCache = (cachePath, code) => fs.writeFileSync(cachePath, code);
addHook(
  (code) => {
    const b64 = Buffer.from(code).toString("base64");
    return `module.exports = Buffer.from("${b64}", "base64")`;
  },
  {
    exts: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    ignoreNodeModules: false
  }
);
require2.extensions[".ios.js"] = require2.extensions[".js"];
var processReactNative = (code, filename) => {
  const cacheName = normalize(path.relative(root, filename)).replace(/\//g, "_");
  const cachePath = path.join(cacheDir, cacheName);
  if (cacheExists(cachePath)) {
    return readFromCache(cachePath);
  }
  const mock2 = getMocked(filename);
  if (mock2) {
    const original = mock2.code.includes("__vitest__original__") ? `const __vitest__original__ = ((module, exports) => {
      ${transformCode(code)}
      return module.exports
    })(module, exports);` : "";
    const mockCode = `${original}
${mock2.code}`;
    writeToCache(cachePath, mockCode);
    return mockCode;
  }
  const transformed = transformCode(code);
  writeToCache(cachePath, transformed);
  return transformed;
};
addHook((code, filename) => processReactNative(code, filename), {
  exts: [".js", ".ios.js"],
  ignoreNodeModules: false,
  matcher: (id) => {
    const p = normalize(id);
    return (p.includes("/node_modules/react-native/") || p.includes("/node_modules/@react-native/") || p.includes("/node_modules/@react-native-community/")) && !p.includes("Renderer/implementations");
  }
});
// (upstream also tried to load @react-native/polyfills and regenerator-runtime
// here — both wrapped in try/catch. Dropped to keep the dep surface minimal;
// our tests don't depend on either.)
var mock = (modulePath, mockCode) => {
  const code = typeof mockCode === "function" ? mockCode() : mockCode;
  mocked.push({ path: modulePath, code: `module.exports = ${code}` });
};
var createAccessibleTouchableMock = (displayName) => `(() => {
  const React = require('react');
  const ${displayName} = React.forwardRef((props, ref) => {
    const { disabled, accessibilityState, ...rest } = props;
    const mergedAccessibilityState = disabled != null || accessibilityState
      ? { ...accessibilityState, ...(disabled != null ? { disabled: !!disabled } : {}) }
      : undefined;
    return React.createElement('${displayName}', {
      ...rest,
      disabled,
      accessible: props.accessible !== false,
      ...(mergedAccessibilityState ? { accessibilityState: mergedAccessibilityState } : {}),
      ref,
    }, props.children);
  });
  ${displayName}.displayName = '${displayName}';
  return { __esModule: true, default: ${displayName} };
})()`;
mock("react-native/Libraries/Core/InitializeCore", () => "{}");
mock(
  "react-native/Libraries/Core/NativeExceptionsManager",
  () => `{
  __esModule: true,
  default: {
    reportFatalException: vi.fn(),
    reportSoftException: vi.fn(),
    updateExceptionMessage: vi.fn(),
    dismissRedbox: vi.fn(),
    reportException: vi.fn(),
  }
}`
);
mock(
  "react-native/Libraries/TurboModule/TurboModuleRegistry",
  () => `{
  get: (name) => global.__turboModuleProxy ? global.__turboModuleProxy(name) : null,
  getEnforcing: (name) => {
    const module = global.__turboModuleProxy ? global.__turboModuleProxy(name) : null;
    if (module) return module;
    // Return a safe Proxy mock instead of {} so any method call
    // (like getConstants()) is a no-op rather than a crash
    return new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop !== 'string') return undefined;
        if (prop === 'getConstants' || prop === 'getConstantsForViewManager') return () => ({});
        if (prop === 'getDefaultEventTypes') return () => [];
        return () => {};
      },
    });
  },
}`
);
mock(
  "react-native/src/private/featureflags/ReactNativeFeatureFlags",
  () => `(() => {
  const defaults = { isLayoutAnimationEnabled: () => true };
  return new Proxy(defaults, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      if (typeof prop === 'string') return () => false;
      return undefined;
    },
  });
})()`
);
mock(
  "react-native/src/private/featureflags/ReactNativeFeatureFlagsBase",
  () => `{
  createJavaScriptFlagGetter: (configGetter, flagName, defaultValue) => () => defaultValue,
  createNativeFlagGetter: (flagName, defaultValue) => () => defaultValue,
  setOverrides: () => {},
}`
);
mock(
  "react-native/src/private/featureflags/specs/NativeReactNativeFeatureFlags",
  () => `{
  __esModule: true,
  default: global.__turboModuleProxy ? global.__turboModuleProxy('NativeReactNativeFeatureFlagsCxx') : {},
}`
);
mock(
  "react-native/Libraries/StyleSheet/StyleSheet",
  () => `(() => {
  const StyleSheet = {
    create: (styles) => styles,
    flatten: (style) => {
      if (!style) return {};
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }
      return style;
    },
    compose: (style1, style2) => [style1, style2],
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    hairlineWidth: 0.5,
    setStyleAttributePreprocessor: () => {},
  };
  return { __esModule: true, default: StyleSheet, ...StyleSheet };
})()`
);
mock(
  "react-native/Libraries/Utilities/Platform",
  () => `(() => {
  const Platform = {
    OS: 'ios',
    Version: '17.0',
    isPad: false,
    isTesting: true,
    isTV: false,
    isVision: false,
    constants: {
      reactNativeVersion: { major: 0, minor: 83, patch: 0 },
    },
    select: (obj) => {
      if ('ios' in obj) return obj.ios;
      if ('native' in obj) return obj.native;
      return obj.default;
    },
  };
  return { __esModule: true, default: Platform, ...Platform };
})()`
);
mock(
  "react-native/Libraries/ReactNative/UIManager",
  () => `{
  __esModule: true,
  default: {
    AndroidViewPager: { Commands: { setPage: vi.fn(), setPageWithoutAnimation: vi.fn() } },
    blur: vi.fn(),
    createView: vi.fn(),
    customBubblingEventTypes: {},
    customDirectEventTypes: {},
    dispatchViewManagerCommand: vi.fn(),
    focus: vi.fn(),
    getViewManagerConfig: vi.fn((name) => {
      if (name === 'AndroidDrawerLayout') {
        return { Constants: { DrawerPosition: { Left: 10 } } };
      }
      return null;
    }),
    hasViewManagerConfig: vi.fn((name) => name === 'AndroidDrawerLayout'),
    measure: vi.fn(),
    manageChildren: vi.fn(),
    removeSubviewsFromContainerWithID: vi.fn(),
    replaceExistingNonRootView: vi.fn(),
    setChildren: vi.fn(),
    updateView: vi.fn(),
    AndroidDrawerLayout: { Constants: { DrawerPosition: { Left: 10 } } },
    AndroidTextInput: { Commands: {} },
    ScrollView: { Constants: {} },
    View: { Constants: {} },
  },
}`
);
mock(
  "react-native/Libraries/BatchedBridge/NativeModules",
  () => `{
  __esModule: true,
  default: {
    AlertManager: { alertWithArgs: vi.fn() },
    AsyncLocalStorage: {
      multiGet: vi.fn((keys, cb) => process.nextTick(() => cb(null, []))),
      multiSet: vi.fn((entries, cb) => process.nextTick(() => cb(null))),
      multiRemove: vi.fn((keys, cb) => process.nextTick(() => cb(null))),
      multiMerge: vi.fn((entries, cb) => process.nextTick(() => cb(null))),
      clear: vi.fn((cb) => process.nextTick(() => cb(null))),
      getAllKeys: vi.fn((cb) => process.nextTick(() => cb(null, []))),
    },
    DeviceInfo: {
      getConstants: () => ({
        Dimensions: {
          window: { fontScale: 2, height: 1334, scale: 2, width: 750 },
          screen: { fontScale: 2, height: 1334, scale: 2, width: 750 },
        },
      }),
    },
    DevSettings: { addMenuItem: vi.fn(), reload: vi.fn() },
    ImageLoader: {
      getSize: vi.fn(() => Promise.resolve([320, 240])),
      getSizeWithHeaders: vi.fn(() => Promise.resolve({ width: 320, height: 240 })),
      prefetchImage: vi.fn(() => Promise.resolve()),
      prefetchImageWithMetadata: vi.fn(() => Promise.resolve()),
      queryCache: vi.fn(() => Promise.resolve({})),
    },
    ImageViewManager: {
      getSize: vi.fn((uri, success) => process.nextTick(() => success(320, 240))),
      prefetchImage: vi.fn(),
    },
    KeyboardObserver: { addListener: vi.fn(), removeListeners: vi.fn() },
    NativeAnimatedModule: {
      createAnimatedNode: vi.fn(),
      updateAnimatedNodeConfig: vi.fn(),
      getValue: vi.fn(),
      startListeningToAnimatedNodeValue: vi.fn(),
      stopListeningToAnimatedNodeValue: vi.fn(),
      connectAnimatedNodes: vi.fn(),
      disconnectAnimatedNodes: vi.fn(),
      startAnimatingNode: vi.fn((animationId, nodeTag, config, endCallback) => {
        setTimeout(() => endCallback({ finished: true }), 16);
      }),
      stopAnimation: vi.fn(),
      setAnimatedNodeValue: vi.fn(),
      setAnimatedNodeOffset: vi.fn(),
      flattenAnimatedNodeOffset: vi.fn(),
      extractAnimatedNodeOffset: vi.fn(),
      connectAnimatedNodeToView: vi.fn(),
      disconnectAnimatedNodeFromView: vi.fn(),
      restoreDefaultValues: vi.fn(),
      dropAnimatedNode: vi.fn(),
      addAnimatedEventToView: vi.fn(),
      removeAnimatedEventFromView: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      removeListeners: vi.fn(),
    },
    Networking: { sendRequest: vi.fn(), abortRequest: vi.fn(), addListener: vi.fn(), removeListeners: vi.fn() },
    PlatformConstants: {
      getConstants: () => ({ isTesting: true, reactNativeVersion: { major: 0, minor: 83, patch: 0 } }),
    },
    SourceCode: { getConstants: () => ({ scriptURL: null }) },
    StatusBarManager: {
      setColor: vi.fn(),
      setStyle: vi.fn(),
      setHidden: vi.fn(),
      setNetworkActivityIndicatorVisible: vi.fn(),
      setBackgroundColor: vi.fn(),
      setTranslucent: vi.fn(),
      getConstants: () => ({ HEIGHT: 42, DEFAULT_BACKGROUND_COLOR: 0 }),
    },
    Timing: { createTimer: vi.fn(), deleteTimer: vi.fn() },
    UIManager: {},
    BlobModule: {
      getConstants: () => ({ BLOB_URI_SCHEME: 'content', BLOB_URI_HOST: null }),
      addNetworkingHandler: vi.fn(),
      enableBlobSupport: vi.fn(),
      disableBlobSupport: vi.fn(),
      createFromParts: vi.fn(),
      sendBlob: vi.fn(),
      release: vi.fn(),
    },
    WebSocketModule: {
      connect: vi.fn(),
      send: vi.fn(),
      sendBinary: vi.fn(),
      ping: vi.fn(),
      close: vi.fn(),
      addListener: vi.fn(),
      removeListeners: vi.fn(),
    },
    I18nManager: {
      allowRTL: vi.fn(),
      forceRTL: vi.fn(),
      swapLeftAndRightInRTL: vi.fn(),
      getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en_US' }),
    },
  },
}`
);
mock(
  "react-native/Libraries/NativeComponent/NativeComponentRegistry",
  () => `{
  get: (name, viewConfigProvider) => {
    const requireNativeComponent = require('react-native/Libraries/ReactNative/requireNativeComponent');
    return requireNativeComponent(name);
  },
  getWithFallback_DEPRECATED: (name, viewConfigProvider) => {
    const requireNativeComponent = require('react-native/Libraries/ReactNative/requireNativeComponent');
    return requireNativeComponent(name);
  },
  setRuntimeConfigProvider: () => {},
}`
);
mock(
  "react-native/Libraries/ReactNative/requireNativeComponent",
  () => `(() => {
  const React = require('react');
  let nativeTag = 1;

  const requireNativeComponent = (viewName) => {
    const Component = class extends React.Component {
      _nativeTag = nativeTag++;
      render() {
        return React.createElement(viewName, this.props, this.props.children);
      }
      blur = vi.fn();
      focus = vi.fn();
      measure = vi.fn();
      measureInWindow = vi.fn();
      measureLayout = vi.fn();
      setNativeProps = vi.fn();
    };
    Component.displayName = viewName === 'RCTView' ? 'View' : viewName;
    return Component;
  };
  return { __esModule: true, default: requireNativeComponent };
})()`
);
mock(
  "react-native/Libraries/Components/View/View",
  () => `(() => {
  const React = require('react');
  const View = React.forwardRef((props, ref) => {
    const accessible = props.accessible !== undefined ? props.accessible
      : !!(props.accessibilityRole || props.accessibilityLabel || props.role);
    return React.createElement('View', { ...props, accessible, ref }, props.children);
  });
  View.displayName = 'View';
  return { __esModule: true, default: View };
})()`
);
mock(
  "react-native/Libraries/Components/View/ViewNativeComponent",
  () => `(() => {
  const React = require('react');
  const ViewNativeComponent = React.forwardRef((props, ref) => {
    const accessible = props.accessible !== undefined ? props.accessible
      : !!(props.accessibilityRole || props.accessibilityLabel || props.role);
    return React.createElement('View', { ...props, accessible, ref }, props.children);
  });
  ViewNativeComponent.displayName = 'View';
  return { __esModule: true, default: ViewNativeComponent };
})()`
);
mock(
  "react-native/Libraries/Text/Text",
  () => `(() => {
  const React = require('react');
  const Text = React.forwardRef((props, ref) => {
    return React.createElement('Text', { ...props, ref }, props.children);
  });
  Text.displayName = 'Text';
  return { __esModule: true, default: Text };
})()`
);
mock(
  "react-native/Libraries/Components/TextInput/TextInput",
  () => `(() => {
  const React = require('react');
  const TextInput = React.forwardRef((props, ref) => {
    return React.createElement('TextInput', { ...props, ref });
  });
  TextInput.displayName = 'TextInput';
  TextInput.State = {
    currentlyFocusedInput: vi.fn(() => null),
    currentlyFocusedField: vi.fn(() => null),
    focusTextInput: vi.fn(),
    blurTextInput: vi.fn(),
  };
  return { __esModule: true, default: TextInput };
})()`
);
mock(
  "react-native/Libraries/Image/Image",
  () => `(() => {
  const React = require('react');
  const Image = React.forwardRef((props, ref) => {
    return React.createElement('Image', { ...props, ref });
  });
  Image.displayName = 'Image';
  Image.getSize = vi.fn((uri, success, failure) => success && success(100, 100));
  Image.getSizeWithHeaders = vi.fn(() => Promise.resolve({ width: 100, height: 100 }));
  Image.prefetch = vi.fn(() => Promise.resolve());
  Image.prefetchWithMetadata = vi.fn(() => Promise.resolve());
  Image.queryCache = vi.fn(() => Promise.resolve({}));
  Image.resolveAssetSource = vi.fn((source) => source);
  return { __esModule: true, default: Image };
})()`
);
mock(
  "react-native/Libraries/Modal/Modal",
  () => `(() => {
  const React = require('react');
  class Modal extends React.Component {
    render() {
      if (this.props.visible === false) {
        return null;
      }
      return React.createElement('Modal', this.props, this.props.children);
    }
  }
  Modal.displayName = 'Modal';
  return { __esModule: true, default: Modal };
})()`
);
mock(
  "react-native/Libraries/Modal/NativeModalManager",
  () => `{
  __esModule: true,
  default: null,
}`
);
mock(
  "react-native/src/private/specs_DEPRECATED/modules/NativeModalManager",
  () => `{
  __esModule: true,
  default: null,
}`
);
mock(
  "react-native/Libraries/Components/ScrollView/ScrollView",
  () => `(() => {
  const React = require('react');
  class ScrollView extends React.Component {
    scrollTo = vi.fn();
    scrollToEnd = vi.fn();
    flashScrollIndicators = vi.fn();
    getScrollResponder = vi.fn(() => this);
    getScrollableNode = vi.fn();
    getInnerViewNode = vi.fn();
    getInnerViewRef = vi.fn();
    getNativeScrollRef = vi.fn();
    scrollResponderZoomTo = vi.fn();
    scrollResponderScrollNativeHandleToKeyboard = vi.fn();

    render() {
      return React.createElement('ScrollView', this.props, this.props.children);
    }
  }
  ScrollView.displayName = 'ScrollView';
  return { __esModule: true, default: ScrollView };
})()`
);
mock(
  "react-native/Libraries/Components/ActivityIndicator/ActivityIndicator",
  () => `(() => {
  const React = require('react');
  const ActivityIndicator = React.forwardRef((props, ref) => {
    return React.createElement('ActivityIndicator', { ...props, ref });
  });
  ActivityIndicator.displayName = 'ActivityIndicator';
  return { __esModule: true, default: ActivityIndicator };
})()`
);
mock(
  "react-native/Libraries/Components/Pressable/Pressable",
  () => `(() => {
  const React = require('react');
  const Pressable = React.forwardRef((props, ref) => {
    const { children, style, disabled, accessibilityState, onPress, onPressIn, onPressOut, onLongPress, ...rest } = props;
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
    const resolvedChildren = typeof children === 'function' ? children({ pressed: false }) : children;
    const mergedAccessibilityState = disabled != null || accessibilityState
      ? { ...accessibilityState, ...(disabled != null ? { disabled: !!disabled } : {}) }
      : undefined;
    return React.createElement('Pressable', {
      ...rest,
      accessible: props.accessible !== false,
      style: resolvedStyle,
      ref,
      onPress: disabled ? undefined : onPress,
      onPressIn,
      onPressOut,
      onLongPress,
      disabled,
      ...(mergedAccessibilityState ? { accessibilityState: mergedAccessibilityState } : {}),
    }, resolvedChildren);
  });
  Pressable.displayName = 'Pressable';
  return { __esModule: true, default: Pressable };
})()`
);
mock(
  "react-native/Libraries/Components/Touchable/TouchableOpacity",
  () => createAccessibleTouchableMock("TouchableOpacity")
);
mock(
  "react-native/Libraries/Components/Touchable/TouchableHighlight",
  () => createAccessibleTouchableMock("TouchableHighlight")
);
mock(
  "react-native/Libraries/Components/SafeAreaView/SafeAreaView",
  () => `(() => {
  const React = require('react');
  const SafeAreaView = React.forwardRef((props, ref) => {
    return React.createElement('SafeAreaView', { ...props, ref }, props.children);
  });
  SafeAreaView.displayName = 'SafeAreaView';
  return { __esModule: true, default: SafeAreaView };
})()`
);
mock(
  "react-native/Libraries/Components/StatusBar/StatusBar",
  () => `(() => {
  const React = require('react');
  class StatusBar extends React.Component {
    static currentHeight = 42;
    static setBarStyle = vi.fn();
    static setBackgroundColor = vi.fn();
    static setHidden = vi.fn();
    static setNetworkActivityIndicatorVisible = vi.fn();
    static setTranslucent = vi.fn();
    static pushStackEntry = vi.fn(() => ({}));
    static popStackEntry = vi.fn();
    static replaceStackEntry = vi.fn(() => ({}));
    render() { return null; }
  }
  return { __esModule: true, default: StatusBar };
})()`
);
mock(
  "react-native/Libraries/Components/Switch/Switch",
  () => `(() => {
  const React = require('react');
  const Switch = React.forwardRef((props, ref) => {
    const { disabled, accessibilityState, ...rest } = props;
    const mergedAccessibilityState = disabled != null || accessibilityState
      ? { ...accessibilityState, ...(disabled != null ? { disabled: !!disabled } : {}) }
      : undefined;
    return React.createElement('Switch', {
      ...rest,
      disabled,
      ...(mergedAccessibilityState ? { accessibilityState: mergedAccessibilityState } : {}),
      ref,
    });
  });
  Switch.displayName = 'Switch';
  return { __esModule: true, default: Switch };
})()`
);
mock(
  "react-native/Libraries/Lists/FlatList",
  () => `(() => {
  const React = require('react');
  class FlatList extends React.Component {
    scrollToEnd = vi.fn();
    scrollToIndex = vi.fn();
    scrollToItem = vi.fn();
    scrollToOffset = vi.fn();
    recordInteraction = vi.fn();
    flashScrollIndicators = vi.fn();
    getScrollResponder = vi.fn();
    getNativeScrollRef = vi.fn();
    getScrollableNode = vi.fn();

    render() {
      const { data, renderItem, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent, keyExtractor, ...rest } = this.props;
      const children = [];

      if (ListHeaderComponent) {
        children.push(React.createElement('View', { key: 'header' },
          typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent));
      }

      if (data && data.length > 0) {
        data.forEach((item, index) => {
          if (index > 0 && ItemSeparatorComponent) {
            children.push(React.createElement(ItemSeparatorComponent, { key: 'sep-' + index }));
          }
          const key = keyExtractor ? keyExtractor(item, index) : index.toString();
          children.push(renderItem({ item, index, separators: {} }));
        });
      } else if (ListEmptyComponent) {
        children.push(typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent);
      }

      if (ListFooterComponent) {
        children.push(React.createElement('View', { key: 'footer' },
          typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent));
      }

      return React.createElement('FlatList', rest, children);
    }
  }
  FlatList.displayName = 'FlatList';
  return { __esModule: true, default: FlatList };
})()`
);
mock(
  "react-native/Libraries/Lists/SectionList",
  () => `(() => {
  const React = require('react');
  class SectionList extends React.Component {
    scrollToLocation = vi.fn();
    recordInteraction = vi.fn();
    flashScrollIndicators = vi.fn();
    getScrollResponder = vi.fn();
    getNativeScrollRef = vi.fn();
    getScrollableNode = vi.fn();

    render() {
      const { sections, renderItem, renderSectionHeader, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent, SectionSeparatorComponent, keyExtractor, ...rest } = this.props;
      const children = [];

      if (ListHeaderComponent) {
        children.push(React.createElement('View', { key: 'list-header' },
          typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent));
      }

      if (sections && sections.length > 0) {
        sections.forEach((section, sectionIndex) => {
          if (renderSectionHeader) {
            children.push(React.cloneElement(renderSectionHeader({ section }), { key: 'section-header-' + sectionIndex }));
          }
          if (section.data && section.data.length > 0) {
            section.data.forEach((item, itemIndex) => {
              if (itemIndex > 0 && ItemSeparatorComponent) {
                children.push(React.createElement(ItemSeparatorComponent, { key: 'sep-' + sectionIndex + '-' + itemIndex }));
              }
              const key = keyExtractor ? keyExtractor(item, itemIndex) : sectionIndex + '-' + itemIndex;
              const element = renderItem({ item, index: itemIndex, section, separators: {} });
              children.push(React.cloneElement(element, { key }));
            });
          }
          if (sectionIndex < sections.length - 1 && SectionSeparatorComponent) {
            children.push(React.createElement(SectionSeparatorComponent, { key: 'section-sep-' + sectionIndex }));
          }
        });
      } else if (ListEmptyComponent) {
        children.push(React.createElement('View', { key: 'empty' },
          typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent));
      }

      if (ListFooterComponent) {
        children.push(React.createElement('View', { key: 'list-footer' },
          typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent));
      }

      return React.createElement('SectionList', rest, children);
    }
  }
  SectionList.displayName = 'SectionList';
  return { __esModule: true, default: SectionList };
})()`
);
mock(
  "react-native/Libraries/Utilities/Dimensions",
  () => `{
  __esModule: true,
  default: {
    get: (dim) => {
      if (dim === 'window' || dim === 'screen') {
        return { width: 750, height: 1334, scale: 2, fontScale: 2 };
      }
      return {};
    },
    set: vi.fn(),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}`
);
mock(
  "react-native/Libraries/Utilities/PixelRatio",
  () => `{
  __esModule: true,
  default: {
    get: () => 2,
    getFontScale: () => 2,
    getPixelSizeForLayoutSize: (size) => size * 2,
    roundToNearestPixel: (size) => Math.round(size * 2) / 2,
  },
}`
);
mock(
  "react-native/Libraries/AppState/AppState",
  () => `{
  __esModule: true,
  default: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    currentState: 'active',
    isAvailable: true,
  },
}`
);
mock(
  "react-native/Libraries/Linking/Linking",
  () => `{
  __esModule: true,
  default: {
    openURL: vi.fn(() => Promise.resolve()),
    canOpenURL: vi.fn(() => Promise.resolve(true)),
    openSettings: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    getInitialURL: vi.fn(() => Promise.resolve(null)),
    sendIntent: vi.fn(() => Promise.resolve()),
  },
}`
);
mock(
  "react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo",
  () => `{
  __esModule: true,
  default: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    announceForAccessibility: vi.fn(),
    announceForAccessibilityWithOptions: vi.fn(),
    isAccessibilityServiceEnabled: vi.fn(() => Promise.resolve(false)),
    isBoldTextEnabled: vi.fn(() => Promise.resolve(false)),
    isGrayscaleEnabled: vi.fn(() => Promise.resolve(false)),
    isInvertColorsEnabled: vi.fn(() => Promise.resolve(false)),
    isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
    prefersCrossFadeTransitions: vi.fn(() => Promise.resolve(false)),
    isReduceTransparencyEnabled: vi.fn(() => Promise.resolve(false)),
    isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
    setAccessibilityFocus: vi.fn(),
    sendAccessibilityEvent: vi.fn(),
    getRecommendedTimeoutMillis: vi.fn(() => Promise.resolve(0)),
  },
}`
);
mock(
  "react-native/Libraries/Components/Clipboard/Clipboard",
  () => `{
  __esModule: true,
  default: {
    getString: vi.fn(() => Promise.resolve('')),
    setString: vi.fn(),
    hasString: vi.fn(() => Promise.resolve(false)),
  },
}`
);
mock(
  "react-native/Libraries/Components/RefreshControl/RefreshControl",
  () => `(() => {
  const React = require('react');
  const RefreshControl = React.forwardRef((props, ref) => {
    return React.createElement('RefreshControl', { ...props, ref });
  });
  RefreshControl.displayName = 'RefreshControl';
  return { __esModule: true, default: RefreshControl };
})()`
);
mock(
  "react-native/Libraries/Vibration/Vibration",
  () => `{
  __esModule: true,
  default: {
    vibrate: vi.fn(),
    cancel: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Alert/Alert",
  () => `{
  __esModule: true,
  default: {
    alert: vi.fn(),
    prompt: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Share/Share",
  () => `{
  __esModule: true,
  default: {
    share: vi.fn(() => Promise.resolve({ action: 'sharedAction' })),
  },
}`
);
mock(
  "react-native/Libraries/Components/Keyboard/Keyboard",
  () => `{
  __esModule: true,
  default: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    dismiss: vi.fn(),
    scheduleLayoutAnimation: vi.fn(),
    isVisible: vi.fn(() => false),
    metrics: vi.fn(() => null),
  },
}`
);
mock(
  "react-native/Libraries/LayoutAnimation/LayoutAnimation",
  () => `{
  __esModule: true,
  default: {
    configureNext: vi.fn(),
    create: vi.fn(),
    checkConfig: vi.fn(),
    Types: { spring: 'spring', linear: 'linear', easeInEaseOut: 'easeInEaseOut', easeIn: 'easeIn', easeOut: 'easeOut', keyboard: 'keyboard' },
    Properties: { opacity: 'opacity', scaleX: 'scaleX', scaleY: 'scaleY', scaleXY: 'scaleXY' },
    Presets: {
      easeInEaseOut: { duration: 300, type: 'easeInEaseOut' },
      linear: { duration: 500, type: 'linear' },
      spring: { duration: 700, type: 'spring', springDamping: 0.4 },
    },
  },
}`
);
mock(
  "react-native/Libraries/Interaction/InteractionManager",
  () => `{
  __esModule: true,
  default: {
    runAfterInteractions: vi.fn((task) => {
      if (typeof task === 'function') {
        task();
      } else if (task && typeof task.gen === 'function') {
        task.gen();
      }
      return { then: vi.fn(), done: vi.fn(), cancel: vi.fn() };
    }),
    createInteractionHandle: vi.fn(() => 1),
    clearInteractionHandle: vi.fn(),
    setDeadline: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Interaction/PanResponder",
  () => `{
  __esModule: true,
  default: {
    create: vi.fn((config) => ({
      panHandlers: {
        onStartShouldSetResponder: vi.fn(),
        onMoveShouldSetResponder: vi.fn(),
        onStartShouldSetResponderCapture: vi.fn(),
        onMoveShouldSetResponderCapture: vi.fn(),
        onResponderGrant: vi.fn(),
        onResponderMove: vi.fn(),
        onResponderRelease: vi.fn(),
        onResponderTerminate: vi.fn(),
        onResponderTerminationRequest: vi.fn(),
      },
    })),
  },
}`
);
mock(
  "react-native/Libraries/EventEmitter/NativeEventEmitter",
  () => `(() => {
  class NativeEventEmitter {
    constructor(nativeModule) { this._nativeModule = nativeModule; }
    addListener(eventType, listener, context) { return { remove: vi.fn() }; }
    removeListener(eventType, listener) {}
    removeAllListeners(eventType) {}
    removeSubscription(subscription) {}
    emit(eventType, ...args) {}
  }
  return { __esModule: true, default: NativeEventEmitter };
})()`
);
mock(
  "react-native/Libraries/Animated/Animated",
  () => `{
  __esModule: true,
  default: {
    Value: class AnimatedValue {
      constructor(value) { this._value = value || 0; }
      setValue(value) { this._value = value; }
      setOffset(offset) {}
      flattenOffset() {}
      extractOffset() {}
      addListener(callback) { return '0'; }
      removeListener(id) {}
      removeAllListeners() {}
      stopAnimation(callback) { callback && callback(this._value); }
      resetAnimation(callback) { callback && callback(this._value); }
      interpolate(config) { return new this.constructor(0); }
    },
    ValueXY: class AnimatedValueXY {
      constructor(value) {
        this.x = new (require('react-native/Libraries/Animated/Animated').default.Value)(value?.x || 0);
        this.y = new (require('react-native/Libraries/Animated/Animated').default.Value)(value?.y || 0);
      }
      setValue(value) { this.x.setValue(value.x); this.y.setValue(value.y); }
      setOffset(offset) {}
      flattenOffset() {}
      extractOffset() {}
      stopAnimation(callback) { callback && callback({ x: 0, y: 0 }); }
      resetAnimation(callback) { callback && callback({ x: 0, y: 0 }); }
      addListener(callback) { return '0'; }
      removeListener(id) {}
      removeAllListeners() {}
      getLayout() { return { left: this.x, top: this.y }; }
      getTranslateTransform() { return [{ translateX: this.x }, { translateY: this.y }]; }
    },
    Color: class AnimatedColor {
      constructor(value) { this._value = value; }
      setValue(value) { this._value = value; }
      resetAnimation(callback) { callback && callback(this._value); }
    },
    View: require('react-native/Libraries/Components/View/View').default,
    Text: require('react-native/Libraries/Text/Text').default,
    Image: require('react-native/Libraries/Image/Image').default,
    ScrollView: require('react-native/Libraries/Components/ScrollView/ScrollView').default,
    FlatList: require('react-native/Libraries/Lists/FlatList').default,
    SectionList: require('react-native/Libraries/Lists/SectionList').default,
    timing: vi.fn((value, config) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    spring: vi.fn((value, config) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    decay: vi.fn((value, config) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    parallel: vi.fn((animations) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    sequence: vi.fn((animations) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    stagger: vi.fn((delay, animations) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    loop: vi.fn((animation) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    delay: vi.fn((time) => ({
      start: vi.fn((callback) => callback && callback({ finished: true })),
      stop: vi.fn(),
      reset: vi.fn(),
    })),
    event: vi.fn(() => vi.fn()),
    add: vi.fn(),
    subtract: vi.fn(),
    divide: vi.fn(),
    multiply: vi.fn(),
    modulo: vi.fn(),
    diffClamp: vi.fn(),
    createAnimatedComponent: vi.fn((Component) => Component),
  },
}`
);
mock(
  "react-native/Libraries/Components/Button",
  () => `(() => {
  const React = require('react');
  const Text = require('react-native/Libraries/Text/Text').default;
  function Button({ title, onPress, disabled, testID, color, accessibilityLabel, accessibilityState, accessibilityRole, role, accessible, ...rest }) {
    const mergedAccessibilityState = disabled != null || accessibilityState
      ? { ...accessibilityState, ...(disabled != null ? { disabled: !!disabled } : {}) }
      : undefined;
    return React.createElement('Button', {
      onPress, disabled, testID, color, accessibilityLabel,
      accessibilityRole: accessibilityRole || 'button',
      role: role,
      accessible: accessible !== undefined ? accessible : true,
      ...(mergedAccessibilityState ? { accessibilityState: mergedAccessibilityState } : {}),
      ...rest,
    },
      React.createElement(Text, null, title)
    );
  }
  return { __esModule: true, default: Button };
})()`
);
mock(
  "react-native/Libraries/Image/ImageBackground",
  () => `(() => {
  const React = require('react');
  const ImageBackground = React.forwardRef((props, ref) => {
    return React.createElement('ImageBackground', { ...props, ref }, props.children);
  });
  ImageBackground.displayName = 'ImageBackground';
  return { __esModule: true, default: ImageBackground };
})()`
);
mock(
  "react-native/Libraries/Components/Keyboard/KeyboardAvoidingView",
  () => `(() => {
  const React = require('react');
  const KeyboardAvoidingView = React.forwardRef((props, ref) => {
    return React.createElement('KeyboardAvoidingView', { ...props, ref }, props.children);
  });
  KeyboardAvoidingView.displayName = 'KeyboardAvoidingView';
  return { __esModule: true, default: KeyboardAvoidingView };
})()`
);
mock(
  "react-native/Libraries/Utilities/verifyComponentAttributeEquivalence",
  () => `{ __esModule: true, default: () => {} }`
);
mock(
  "react-native/Libraries/Components/Touchable/TouchableWithoutFeedback",
  () => createAccessibleTouchableMock("TouchableWithoutFeedback")
);
mock(
  "react-native/Libraries/Lists/VirtualizedList",
  () => `(() => {
  const React = require('react');
  class VirtualizedList extends React.Component {
    scrollToEnd = vi.fn();
    scrollToIndex = vi.fn();
    scrollToItem = vi.fn();
    scrollToOffset = vi.fn();
    recordInteraction = vi.fn();
    flashScrollIndicators = vi.fn();
    getScrollResponder = vi.fn();
    getNativeScrollRef = vi.fn();
    getScrollableNode = vi.fn();

    render() {
      const { data, renderItem, getItem, getItemCount, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent, keyExtractor, ...rest } = this.props;
      const children = [];

      if (ListHeaderComponent) {
        children.push(React.createElement('View', { key: 'header' },
          typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent));
      }

      const itemCount = getItemCount ? getItemCount(data) : (data ? data.length : 0);
      if (itemCount > 0) {
        for (let i = 0; i < itemCount; i++) {
          if (i > 0 && ItemSeparatorComponent) {
            children.push(React.createElement(ItemSeparatorComponent, { key: 'sep-' + i }));
          }
          const item = getItem ? getItem(data, i) : data[i];
          const key = keyExtractor ? keyExtractor(item, i) : i.toString();
          children.push(renderItem({ item, index: i, separators: {} }));
        }
      } else if (ListEmptyComponent) {
        children.push(typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent);
      }

      if (ListFooterComponent) {
        children.push(React.createElement('View', { key: 'footer' },
          typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent));
      }

      return React.createElement('VirtualizedList', rest, children);
    }
  }
  VirtualizedList.displayName = 'VirtualizedList';
  return { __esModule: true, default: VirtualizedList };
})()`
);
mock(
  "react-native/Libraries/Utilities/BackHandler",
  () => `{
  __esModule: true,
  default: {
    exitApp: vi.fn(),
    addEventListener: vi.fn((eventName, handler) => ({
      remove: vi.fn(),
    })),
    removeEventListener: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Components/DrawerAndroid/DrawerLayoutAndroid",
  () => `(() => {
  const React = require('react');
  class DrawerLayoutAndroid extends React.Component {
    openDrawer = vi.fn();
    closeDrawer = vi.fn();

    render() {
      const { children, renderNavigationView, ...rest } = this.props;
      return React.createElement('DrawerLayoutAndroid', rest, children);
    }
  }
  DrawerLayoutAndroid.displayName = 'DrawerLayoutAndroid';
  DrawerLayoutAndroid.positions = { Left: 'left', Right: 'right' };
  return { __esModule: true, default: DrawerLayoutAndroid };
})()`
);
mock(
  "react-native/Libraries/PermissionsAndroid/PermissionsAndroid",
  () => `{
  __esModule: true,
  default: {
    PERMISSIONS: {
      READ_CALENDAR: 'android.permission.READ_CALENDAR',
      WRITE_CALENDAR: 'android.permission.WRITE_CALENDAR',
      CAMERA: 'android.permission.CAMERA',
      READ_CONTACTS: 'android.permission.READ_CONTACTS',
      WRITE_CONTACTS: 'android.permission.WRITE_CONTACTS',
      GET_ACCOUNTS: 'android.permission.GET_ACCOUNTS',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
      CALL_PHONE: 'android.permission.CALL_PHONE',
      READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
      WRITE_CALL_LOG: 'android.permission.WRITE_CALL_LOG',
      ADD_VOICEMAIL: 'com.android.voicemail.permission.ADD_VOICEMAIL',
      USE_SIP: 'android.permission.USE_SIP',
      PROCESS_OUTGOING_CALLS: 'android.permission.PROCESS_OUTGOING_CALLS',
      BODY_SENSORS: 'android.permission.BODY_SENSORS',
      SEND_SMS: 'android.permission.SEND_SMS',
      RECEIVE_SMS: 'android.permission.RECEIVE_SMS',
      READ_SMS: 'android.permission.READ_SMS',
      RECEIVE_WAP_PUSH: 'android.permission.RECEIVE_WAP_PUSH',
      RECEIVE_MMS: 'android.permission.RECEIVE_MMS',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_ADVERTISE: 'android.permission.BLUETOOTH_ADVERTISE',
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
      READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
      READ_MEDIA_VIDEO: 'android.permission.READ_MEDIA_VIDEO',
      READ_MEDIA_AUDIO: 'android.permission.READ_MEDIA_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    check: vi.fn(() => Promise.resolve('granted')),
    request: vi.fn(() => Promise.resolve('granted')),
    requestMultiple: vi.fn(() => Promise.resolve({})),
  },
}`
);
mock(
  "react-native/Libraries/Components/ToastAndroid/ToastAndroid",
  () => `{
  __esModule: true,
  default: {
    SHORT: 0,
    LONG: 1,
    TOP: 0,
    BOTTOM: 1,
    CENTER: 2,
    show: vi.fn(),
    showWithGravity: vi.fn(),
    showWithGravityAndOffset: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Components/Touchable/TouchableNativeFeedback",
  () => `(() => {
  const React = require('react');
  class TouchableNativeFeedback extends React.Component {
    render() {
      const { disabled, accessibilityState, ...rest } = this.props;
      const mergedAccessibilityState = disabled != null || accessibilityState
        ? { ...accessibilityState, ...(disabled != null ? { disabled: !!disabled } : {}) }
        : undefined;
      return React.createElement('TouchableNativeFeedback', {
        ...rest,
        disabled,
        accessible: this.props.accessible !== false,
        ...(mergedAccessibilityState ? { accessibilityState: mergedAccessibilityState } : {}),
      }, this.props.children);
    }
  }
  TouchableNativeFeedback.displayName = 'TouchableNativeFeedback';
  TouchableNativeFeedback.SelectableBackground = vi.fn(() => ({}));
  TouchableNativeFeedback.SelectableBackgroundBorderless = vi.fn(() => ({}));
  TouchableNativeFeedback.Ripple = vi.fn((color, borderless) => ({}));
  TouchableNativeFeedback.canUseNativeForeground = vi.fn(() => false);
  return { __esModule: true, default: TouchableNativeFeedback };
})()`
);
mock(
  "react-native/Libraries/ActionSheetIOS/ActionSheetIOS",
  () => `{
  __esModule: true,
  default: {
    showActionSheetWithOptions: vi.fn(),
    showShareActionSheetWithOptions: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Components/TextInput/InputAccessoryView",
  () => `(() => {
  const React = require('react');
  const InputAccessoryView = (props) => {
    return React.createElement('InputAccessoryView', props, props.children);
  };
  InputAccessoryView.displayName = 'InputAccessoryView';
  return { __esModule: true, default: InputAccessoryView };
})()`
);
mock(
  "react-native/Libraries/Utilities/Appearance",
  () => `{
  __esModule: true,
  getColorScheme: vi.fn(() => 'light'),
  setColorScheme: vi.fn(),
  addChangeListener: vi.fn(() => ({ remove: vi.fn() })),
}`
);
mock(
  "react-native/Libraries/Utilities/NativeAppearance",
  () => `{
  __esModule: true,
  default: {
    getColorScheme: vi.fn(() => 'light'),
    setColorScheme: vi.fn(),
    addListener: vi.fn(),
    removeListeners: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/Utilities/useColorScheme",
  () => `{
  __esModule: true,
  default: vi.fn(() => 'light'),
}`
);
mock(
  "react-native/Libraries/Utilities/useWindowDimensions",
  () => `{
  __esModule: true,
  default: vi.fn(() => ({ width: 750, height: 1334, scale: 2, fontScale: 2 })),
}`
);
mock(
  "react-native/Libraries/Performance/Systrace",
  () => `{
  __esModule: true,
  default: {
    isEnabled: vi.fn(() => false),
    setEnabled: vi.fn(),
    beginEvent: vi.fn(),
    endEvent: vi.fn(),
    beginAsyncEvent: vi.fn(() => 0),
    endAsyncEvent: vi.fn(),
    counterEvent: vi.fn(),
  },
}`
);
mock(
  "react-native/Libraries/EventEmitter/RCTDeviceEventEmitter",
  () => `(() => {
  class DeviceEventEmitter {
    listeners = {};
    addListener(eventType, listener, context) {
      if (!this.listeners[eventType]) {
        this.listeners[eventType] = [];
      }
      this.listeners[eventType].push(listener);
      return { remove: () => this.removeListener(eventType, listener) };
    }
    removeListener(eventType, listener) {
      if (this.listeners[eventType]) {
        this.listeners[eventType] = this.listeners[eventType].filter(l => l !== listener);
      }
    }
    removeAllListeners(eventType) {
      if (eventType) {
        delete this.listeners[eventType];
      } else {
        this.listeners = {};
      }
    }
    emit(eventType, ...args) {
      if (this.listeners[eventType]) {
        this.listeners[eventType].forEach(listener => listener(...args));
      }
    }
  }
  return { __esModule: true, default: new DeviceEventEmitter() };
})()`
);
mock(
  "react-native/Libraries/Settings/Settings",
  () => `{
  __esModule: true,
  default: {
    get: vi.fn((key) => null),
    set: vi.fn((settings) => {}),
    watchKeys: vi.fn((keys, callback) => 0),
    clearWatch: vi.fn((watchId) => {}),
  },
}`
);
mock(
  "react-native/Libraries/StyleSheet/processTransform",
  () => `{
  __esModule: true,
  default: (transform) => transform,
}`
);
mock(
  "react-native/Libraries/PushNotificationIOS/PushNotificationIOS",
  () => `{
  __esModule: true,
  default: {
    presentLocalNotification: vi.fn(),
    scheduleLocalNotification: vi.fn(),
    cancelAllLocalNotifications: vi.fn(),
    removeAllDeliveredNotifications: vi.fn(),
    getDeliveredNotifications: vi.fn((callback) => callback([])),
    removeDeliveredNotifications: vi.fn(),
    setApplicationIconBadgeNumber: vi.fn(),
    getApplicationIconBadgeNumber: vi.fn((callback) => callback(0)),
    cancelLocalNotifications: vi.fn(),
    getScheduledLocalNotifications: vi.fn((callback) => callback([])),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    requestPermissions: vi.fn(() => Promise.resolve({ alert: true, badge: true, sound: true })),
    abandonPermissions: vi.fn(),
    checkPermissions: vi.fn((callback) => callback({ alert: true, badge: true, sound: true })),
    getInitialNotification: vi.fn(() => Promise.resolve(null)),
    FetchResult: {
      NewData: 'UIBackgroundFetchResultNewData',
      NoData: 'UIBackgroundFetchResultNoData',
      ResultFailed: 'UIBackgroundFetchResultFailed',
    },
  },
}`
);
try {
  const files = fs.readdirSync(cacheDir);
  files.forEach((file) => {
    try {
      fs.unlinkSync(path.join(cacheDir, file));
    } catch {
    }
  });
} catch {
}
try {
  const { configure } = require2("@testing-library/react-native");
  configure({
    // Tell RNTL these are our host component names
    hostComponentNames: {
      text: "Text",
      textInput: "TextInput",
      switch: "Switch",
      scrollView: "ScrollView",
      modal: "Modal",
      image: "Image"
    }
  });
} catch {
}

// Consumer apps supply their own vitest.setup.ts with `vi.mock(...)` calls
// for whatever native-wrapper packages they actually import (expo-linear-
// gradient, react-native-reanimated, react-native-safe-area-context, etc.).
// Mocks live in the consumer so `vi.mock` stays at module top-level and
// gets hoisted correctly.

// ---------------------------------------------------------------------------
// Vite/vitest plugin. Registers Flow stripping for RN packages + points
// `setupFiles` back at this same file so the side-effects above run in every
// test worker.
// ---------------------------------------------------------------------------

const __selfFile = fileURLToPath(import.meta.url);

/**
 * Absolute path to this file, intended to be passed as a `setupFiles` entry
 * so the pirates hooks + RN mocks above register in each test worker.
 */
export const rnSetupFile = __selfFile;

// Re-export so consumer apps don't need @vitejs/plugin-react as a direct dep.
export { default as react } from "@vitejs/plugin-react";

export function reactNative(options = {}) {
  const { additionalExtensions = [], transformPackages = [] } = options;
  const defaultExtensions = [
    ".ios.js",
    ".ios.jsx",
    ".ios.ts",
    ".ios.tsx",
    ".native.js",
    ".native.jsx",
    ".native.ts",
    ".native.tsx",
    ".mjs",
    ".js",
    ".mts",
    ".ts",
    ".jsx",
    ".tsx",
    ".json"
  ];
  const extensions = [...additionalExtensions, ...defaultExtensions];
  return {
    name: "vitest-plugin-react-native",
    enforce: "pre",
    config() {
      return {
        resolve: {
          extensions,
          conditions: ["react-native"]
        },
        test: {
          setupFiles: [__selfFile],
          globals: true,
          server: {
            deps: {
              inline: ["react-native", /react-native/, /@react-native/, /@react-native-community/]
            }
          }
        }
      };
    },
    // Resolve extensionless imports from node_modules packages that ship
    // TypeScript source (e.g., @d11/react-native-fast-image).
    // Node's require() doesn't try .ts/.tsx extensions, so these fail at runtime.
    resolveId(source, importer) {
      if (!importer || !source.startsWith(".") || !importer.includes("node_modules")) return;
      const lastSegment = source.split("/").pop() || "";
      if (lastSegment.includes(".")) return;
      const importerDir = dirname(importer);
      for (const ext of extensions) {
        const candidate = resolve(importerDir, source + ext);
        if (existsSync(candidate)) return candidate;
      }
      for (const ext of extensions) {
        const candidate = resolve(importerDir, source, "index" + ext);
        if (existsSync(candidate)) return candidate;
      }
    },
    transform(code, id) {
      const normalized = id.replace(/\\/g, "/");
      const rnSpecificExts = [".ios.js", ".ios.jsx", ".android.js", ".android.jsx", ".native.js", ".native.jsx"];
      const transformableExts = [".js", ".jsx", ...rnSpecificExts];
      if (!transformableExts.some((ext) => normalized.endsWith(ext))) return;
      if (!normalized.includes("/node_modules/")) return;
      const nodeModIdx = normalized.lastIndexOf("/node_modules/");
      if (nodeModIdx === -1) return;
      const depPath = normalized.slice(nodeModIdx + "/node_modules/".length);
      const segments = depPath.split("/");
      const pkgName = segments[0]?.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
      if (!pkgName) return;
      const isRNPackage = pkgName === "react-native" || pkgName.startsWith("@react-native/") || pkgName.includes("react-native") || rnSpecificExts.some((ext) => normalized.endsWith(ext));
      const isExtraPackage = transformPackages.length > 0 && transformPackages.some((pkg) => pkgName === pkg || pkgName.startsWith(pkg + "/"));
      if (!isRNPackage && !isExtraPackage) return;
      const flowStripped = removeTypes(code, { all: true }).toString();
      const result = esbuild.transformSync(flowStripped, {
        loader: "jsx",
        sourcefile: id
      });
      return { code: result.code, map: null };
    }
  };
}
export default reactNative;
