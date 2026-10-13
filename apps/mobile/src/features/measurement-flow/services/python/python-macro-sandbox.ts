/**
 * Inline listener for the hidden WebView that runs Python macros via Pyodide.
 * Exported separately so tests can execute the same source without parsing HTML.
 */
export const pythonMacroSandboxScript = `(function() {
  var pyodideReady = false;
  var loadError = null;
  var pending = [];

  function send(obj) {
    if (window.ReactNativeWebView && ReactNativeWebView.postMessage) {
      ReactNativeWebView.postMessage(typeof obj === 'string' ? obj : JSON.stringify(obj));
    }
  }

  function rejectUnavailable(payload) {
    send({ requestId: payload.requestId, error: loadError, runtimeUnavailable: true });
  }

  function failLoad(err) {
    loadError = 'Pyodide failed to load: ' + (err && err.message ? err.message : err);
    send({ type: 'error', message: loadError });
    pending.forEach(rejectUnavailable);
    pending.length = 0;
  }

  function indent(s) {
    return s.split('\\n').map(function(line) { return '    ' + line; }).join('\\n');
  }

  async function runMacro(requestId, code, json, ctx) {
    try {
      var resultHolder = {};
      pyodide.globals.set('__result_holder__', resultHolder);
      var jsonB64 = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
      var ctxB64 = btoa(unescape(encodeURIComponent(JSON.stringify(ctx || {}))));
      var wrapped =
        'import base64, json\\n' +
        '__json_input__ = json.loads(base64.b64decode("' + jsonB64 + '").decode("utf-8"))\\n' +
        '__ctx_input__ = json.loads(base64.b64decode("' + ctxB64 + '").decode("utf-8"))\\n' +
        'def __macro__(json, ctx):\\n' + indent(code) + '\\n\\n' +
        '__result__ = __macro__(__json_input__, __ctx_input__)\\n' +
        '__result_holder__.result = json.dumps(__result__)\\n';
      await pyodide.runPythonAsync(wrapped);
      var raw = resultHolder.result;
      var str = (typeof raw === 'string') ? raw : (raw != null ? String(raw) : '');
      var jsResult = {};
      if (str) {
        try { jsResult = JSON.parse(str); } catch (e) {}
      }
      send({ requestId: requestId, result: jsResult });
    } catch (err) {
      send({ requestId: requestId, error: err.message || String(err) });
    }
  }

  window.addEventListener('message', function(event) {
    var data = event.data;
    try {
      var payload = typeof data === 'string' ? JSON.parse(data) : data;
      if (!payload || payload.requestId === undefined || payload.code === undefined) return;
      if (pyodideReady) {
        var macroJson = Object.prototype.hasOwnProperty.call(payload, 'json') ? payload.json : {};
        runMacro(payload.requestId, payload.code, macroJson, payload.ctx || {});
      } else if (loadError) {
        rejectUnavailable(payload);
      } else {
        pending.push(payload);
      }
    } catch (e) {
      // ignore parse errors; no requestId to report back
    }
  });

  // Without a connection the CDN script tag fails and loadPyodide never exists.
  if (typeof loadPyodide !== 'function') {
    failLoad(new Error('the runtime script did not load'));
    return;
  }

  loadPyodide().then(function(pyodide) {
    window.pyodide = pyodide;
    pyodideReady = true;
    send({ type: 'ready' });
    pending.forEach(function(p) {
      var macroJson = Object.prototype.hasOwnProperty.call(p, 'json') ? p.json : {};
      runMacro(p.requestId, p.code, macroJson, p.ctx || {});
    });
    pending.length = 0;
  }).catch(failLoad);
})();`;

/**
 * Inline HTML for a hidden WebView that runs Python macros via Pyodide.
 * Listens for postMessage({ requestId, code, json, ctx }), wraps code in a function
 * that receives json and ctx, runs it, and posts back { requestId, result } or { requestId, error }.
 */
export const pythonMacroSandboxHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><title>Python Macro</title></head>
<body>
<script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
<script>
${pythonMacroSandboxScript}
</script>
</body>
</html>
`;
