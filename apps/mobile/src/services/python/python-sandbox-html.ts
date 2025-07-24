export const pythonSandboxHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Pyodide + NumPy Minimal</title>
</head>
<body>
<script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
<script>
  (async () => {
    const pyodide = await loadPyodide();
    await pyodide.loadPackage(["matplotlib", "numpy", "scipy"]);
    window.pyodide = pyodide;

    // window.ReactNativeWebView?.postMessage("loaded");
    
    window.addEventListener("message", async (event) => {
      const code = event.data;
      try {
        const result = await pyodide.runPythonAsync(code)
        window.ReactNativeWebView?.postMessage(JSON.stringify(result));
      } catch (error) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ error: error.message }));
      }
    });
  })();
</script>
</body>
</html>
`;
