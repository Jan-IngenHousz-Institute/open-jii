/**
 * Inline HTML for a hidden WebView that runs Python macros via Pyodide.
 * Listens for postMessage({ requestId, code, json }), wraps code in a function
 * that receives json, runs it, and posts back { requestId, result } or { requestId, error }.
 */
export const pythonMacroSandboxHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><title>Python Macro</title></head>
<body>
<script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
<script>
(function() {
  var pyodideReady = false;
  var pending = [];

  function send(obj) {
    if (window.ReactNativeWebView && ReactNativeWebView.postMessage) {
      ReactNativeWebView.postMessage(typeof obj === 'string' ? obj : JSON.stringify(obj));
    }
  }

  function indent(s) {
    return s.split('\\n').map(function(line) { return '    ' + line; }).join('\\n');
  }

  async function runMacro(requestId, code, json) {
    try {
      var resultHolder = {};
      pyodide.globals.set('__result_holder__', resultHolder);
      var jsonB64 = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
      var wrapped =
        'import base64, json\\n' +
        '__json_input__ = json.loads(base64.b64decode("' + jsonB64 + '").decode("utf-8"))\\n' +
        'def __macro__(json):\\n' + indent(code) + '\\n\\n' +
        '__result__ = __macro__(__json_input__)\\n' +
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
        runMacro(payload.requestId, payload.code, payload.json || {});
      } else {
        pending.push(payload);
      }
    } catch (e) {
      // ignore parse errors; no requestId to report back
    }
  });

  loadPyodide().then(function(pyodide) {
    window.pyodide = pyodide;
    pyodideReady = true;
    send({ type: 'ready' });
    pending.forEach(function(p) { runMacro(p.requestId, p.code, p.json || {}); });
    pending.length = 0;
  }).catch(function(err) {
    send({ type: 'error', message: err.message || String(err) });
    pending.forEach(function(p) {
      send({ requestId: p.requestId, error: 'Pyodide failed to load: ' + (err.message || err) });
    });
    pending.length = 0;
  });
})();
</script>
</body>
</html>
`;
