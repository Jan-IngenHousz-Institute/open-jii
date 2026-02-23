# Test Data Generator

Add test cases by creating a directory here. Each directory becomes one test case in the integration test suite.

## Directory structure

```
generate/
  my_test_name/
    macro.py          # or macro.js / macro.R
    input.json        # items to send to the Lambda
    expectations.json # which dataset + expected outcome
    output.json       # (optional) expected per-item output
```

## File reference

### `macro.{py,js,R}`

The macro script, exactly as it would run inside the sandbox. The file extension determines the language:

| Extension | Language   |
| --------- | ---------- |
| `.py`     | Python     |
| `.js`     | JavaScript |
| `.R`      | R          |

The script has access to `json` (item data), `output` (result dict), and any pre-loaded modules (`np`, `pd`, `scipy` for Python; standard globals for JS/R).

### `input.json`

Array of items. Each item has an `id` and a `data` object:

```json
[
  { "id": "item-1", "data": { "readings": [1, 2, 3] } },
  { "id": "item-2", "data": { "readings": [4, 5, 6] } }
]
```

### `expectations.json`

Declares which dataset the test belongs to and what the expected outcome is:

```json
{
  "dataset": "intensive",
  "success": true,
  "error": false,
  "timeout": 15
}
```

| Field         | Type                                         | Description                                                         |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `dataset`     | `"samples"` \| `"intensive"` \| `"security"` | Target JSON file                                                    |
| `success`     | `boolean`                                    | `true` → response `status` must be `"success"`                      |
| `error`       | `boolean`                                    | `true` → at least one item has `success: false` or an `"error"` key |
| `timeout`     | `number` _(optional)_                        | Per-item timeout in seconds (default: `10`)                         |
| `protocol_id` | `string` _(optional)_                        | Override the auto-generated `test-<dataset>-<dirname>` protocol ID  |

### `output.json` _(optional)_

Array of expected output objects, one per item (parallel to `input.json`). When present, the integration test asserts `result.output` matches item-for-item:

```json
[
  { "mean": 2.0, "sum": 6.0 },
  { "mean": 5.0, "sum": 15.0 }
]
```

Omit this file if you don't need output assertions (e.g., security tests that only check success/error).

## Usage

```bash
pnpm generate-test-data
```

This reads scripts from `test/scripts/`, builds hard-coded intensive cases, scans every subdirectory in `generate/`, and writes `samples.json`, `intensive.json`, and `security.json` from scratch.

## Example

Create `generate/my_numpy_test/`:

**macro.py**

```python
arr = np.array(json.get('values', []))
output['mean'] = float(np.mean(arr))
output['sum'] = float(np.sum(arr))
```

**input.json**

```json
[{ "id": "item-1", "data": { "values": [10, 20, 30] } }]
```

**expectations.json**

```json
{
  "dataset": "samples",
  "success": true,
  "error": false
}
```

**output.json**

```json
[{ "mean": 20.0, "sum": 60.0 }]
```

Then run:

```bash
pnpm generate-test-data   # merge into JSON files
pnpm test                  # run tests (includes docker up/down)
```
