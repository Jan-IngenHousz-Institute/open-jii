/**
 * regl-scatter2d ships precompiled shaders but still passes them through
 * glslify. Keep its browser call while leaving glslify's Node-only compiler
 * and dynamic requires out of the Turbopack module graph.
 */
module.exports = function glslify(strings, ...values) {
  if (typeof strings === "string") return strings;

  return strings.reduce((shader, part, index) => shader + part + (values[index] ?? ""), "");
};
