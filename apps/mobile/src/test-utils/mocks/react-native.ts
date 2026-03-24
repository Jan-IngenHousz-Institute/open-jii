/**
 * Minimal react-native mock for Vitest.
 *
 * react-native/index.js contains Flow syntax (`import typeof`) which cannot be
 * parsed by esbuild/Node. This file replaces it so no Flow-typed source is
 * ever loaded during tests.
 *
 * Add members here as tests require them.
 */

import React from "react";

const View = ({ children }: any) => React.createElement(React.Fragment, null, children);
const Text = ({ children }: any) => React.createElement(React.Fragment, null, children);
const Pressable = ({ children, onPress }: any) => React.createElement(React.Fragment, null, children);
const Image = () => null;
const ScrollView = ({ children }: any) => React.createElement(React.Fragment, null, children);
const SafeAreaView = ({ children }: any) => React.createElement(React.Fragment, null, children);
const KeyboardAvoidingView = ({ children }: any) => React.createElement(React.Fragment, null, children);
const ActivityIndicator = () => null;
const Linking = { openURL: () => Promise.resolve() };
const Platform = { OS: "ios" as const, select: (obj: any) => obj.ios };

const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (style: any) => {
    if (!style) return {};
    if (Array.isArray(style)) return Object.assign({}, ...style.map(StyleSheet.flatten));
    return style;
  },
  hairlineWidth: 1,
};

export {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
};
