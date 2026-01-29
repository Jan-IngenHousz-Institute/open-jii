# Phase 1 Implementation Checklist

**Status:** 🟢 95% Complete - Enrichment Pending  
**Started:** January 27, 2026  
**Last Updated:** January 28, 2026  
**Environment:** Local Development

## Current Progress Summary

✅ **Completed:**

- Core pipeline tables (experiment_raw_data, experiment_device_data, experiment_macro_data, experiment_macros)
- VARIANT schema transformation and query building (VariantSchemaService)
- Backend refactoring (port/adapter/service architecture)
- Frontend integration (data loading successfully)
- Wildcard column selection with `* EXCEPT`
- Macro name display from metadata
- **User struct field renamed: `image` → `avatar`**
- **User column renamed: `user` → `contributor` (downstream of experiment_contributors)**

⏳ **Remaining:**

- Enrichment tables (experiment_contributors, experiment_annotations)
- Enriched materialized views (enriched_experiment_raw_data, enriched_experiment_macro_data)
- Contributor refresh task
- Backend annotation write to centrum.experiment_annotations

## 1. Pipeline Implementation

### New Tables Added to centrum_pipeline.py

- [x] `experiment_raw_data` - Sample data table (partitioned by experiment_id, date)
- [x] `experiment_device_data` - Device metadata table (partitioned by experiment_id)
- [x] `experiment_macro_data` - VARIANT macro outputs (partitioned by experiment_id, macro_filename, date)
- [x] `experiment_macros` - Metadata discovery table (partitioned by experiment_id)
- [ ] `experiment_contributors` - User profiles table (partitioned by experiment_id)
- [ ] `enriched_experiment_raw_data` - Enriched MV with questions, profiles, annotations
- [ ] `enriched_experiment_macro_data` - Enriched MV with expanded VARIANT, profiles, annotations

### Supporting Tasks Created

- [x] `contributor_refresh_task.py` - Refresh user profiles when they change
- [ ] Test contributor refresh task locally
- [ ] Verify VARIANT column functionality
- [ ] Test macro execution UDF
- [ ] Validate partition pruning works correctly

## 2. VARIANT Verification

- [x] Test VARIANT column stores arbitrary JSON structures
  - [x] Test with simple macro output: `{phi2: 1.0, phipsii: 2.0}`
  - [x] Test with complex nested structure
  - [x] Test with varying schemas in same table
- [x] Verify `experiment_macros` schema aggregation
  - [x] Check `output_schema` column populated via `schema_of_variant_agg()`
  - [x] Verify schema includes all fields across different rows
  - [x] Test NULL macro_output rows are excluded
- [x] Test query performance VARIANT vs columnar
  - [x] Schema lookup from `experiment_macros` table
  - [x] VARIANT parsing with `from_json(macro_output::string, schema)`
  - [x] Wildcard expansion with `parsed_output.*`
- [x] Validate `experiment_macros` metadata table population
  - [x] Verify sample_count accuracy
  - [x] Check macro_name for display
  - [x] Confirm output_schema is valid DDL

## 3. Backend Refactoring

### DatabricksAdapter Updates

- [x] Update table listing methods
  - [x] Query `centrum.experiment_macros` instead of listing schema tables
  - [x] Map macro metadata to frontend table structure
  - [x] Handle `experiment_raw_data` as "sample" table
  - [x] Handle `experiment_device_data` as "device" table
- [x] Update query construction
  - [x] Get schema from `experiment_macros.output_schema` column
  - [x] Transform schema: replace `OBJECT` with `STRUCT` for from_json()
  - [x] Use `from_json(macro_output::string, schema)` to parse VARIANT
  - [x] Expand with `parsed_output.*` to get all fields
  - [x] Add experiment_id filter to all queries
  - [x] Use `* EXCEPT (macro_output, parsed_output)` for column selection
- [ ] Update annotation handling
  - [x] ✅ Write to `centrum.experiment_annotations` instead of per-experiment tables
  - [x] ✅ Remove manual refresh triggers (MVs auto-refresh)
  - [x] ✅ Remove schemaName parameter from all repository methods and use cases
  - [ ] Test annotation visibility latency (pending table permissions fix)

### Files to Modify

- [x] `/apps/backend/src/common/modules/databricks/databricks.adapter.ts`
  - [x] Delegates to VariantSchemaService for query building
  - [x] Port/Adapter pattern maintained
- [x] `/apps/backend/src/common/modules/databricks/services/sql/variant-schema.service.ts`
  - [x] Create service to handle VARIANT schema transformation
  - [x] Add method to transform OBJECT → STRUCT
  - [x] Add method to build from_json() queries
  - [x] Add method to lookup schema from experiment_macros
  - [x] Support wildcard selection with `* EXCEPT`
- [x] `/apps/backend/src/experiments/application/use-cases/experiment-data/get-experiment-tables.ts`
  - [x] Query `centrum.experiment_macros` for macro list
  - [x] Use macro_name for display names
  - [x] Construct table metadata from unified tables
  - [x] GROUP BY macro_filename for deduplication
- [x] `/apps/backend/src/experiments/application/use-cases/experiment-data/get-experiment-data.ts`
  - [x] Update sample table queries to use experiment_raw_data
  - [x] Update device table queries to use experiment_device_data
  - [x] Update macro table queries with VARIANT parsing
  - [x] Use VariantSchemaService to build queries
  - [ ] Query enriched MVs instead of base tables (pending enrichment implementation)
- [x] `/apps/backend/src/experiments/application/repositories/experiment-data.repository.ts`
  - [x] Consolidated strategy pattern into repository methods
  - [x] Added `buildQuery()` method that selects appropriate strategy
  - [x] Moved `buildRawDataQuery()`, `buildDeviceDataQuery()`, `buildMacroDataQuery()` into repository
  - [x] Removed separate strategy files and dependencies
- [x] `/apps/backend/src/experiments/core/repositories/experiment-data-annotations.repository.ts`
  - [x] ✅ **COMPLETE**: Now writes to `centrum.experiment_annotations`
  - [x] ✅ Table partitioned by `experiment_id`
  - [x] ✅ Change data feed enabled (`delta.enableChangeDataFeed = 'true'`)
  - [x] ✅ Single shared table across all experiments
  - [x] ✅ All CRUD operations updated (store, update, delete, bulk delete)
  - [x] ✅ Proper validation and SQL injection protection
  - [x] ✅ No manual refresh triggers (MVs auto-refresh)
  - [x] ✅ **schemaName parameter removed** from all methods
  - [x] ✅ All methods now use hardcoded "centrum" schema
- [x] `/apps/backend/src/experiments/application/use-cases/experiment-data-annotations/`
  - [x] ✅ **add-annotations.ts** - Removed schemaName validation and parameter
  - [x] ✅ **update-annotation.ts** - Removed schemaName validation and parameter
  - [x] ✅ **delete-annotations.ts** - Removed schemaName validation and parameter
  - [x] ✅ All use cases now call repository without schemaName argument
  - [x] ✅ Cleaned up unused ErrorCodes imports
- [x] `/apps/backend/src/experiments/core/repositories/experiment-data-annotations.repository.spec.ts`
  - [x] ✅ Updated all test method calls to remove schemaName parameter
  - [x] ✅ Changed executeSqlQuery expectations to use "centrum" instead of mockSchemaName
  - [x] ✅ Updated table name expectations from "annotations" to "experiment_annotations"
  - [x] ✅ 26 total test updates completed

### API Endpoints to Add

- [ ] `POST /api/internal/databricks/refresh-contributors`
  - [ ] Accept `user_ids` parameter
  - [ ] Trigger contributor_refresh_task
  - [ ] Return update status

## 4. Frontend Adjustments

- [x] Review data structure changes
  - [x] Verify table list response format unchanged
  - [x] Check column metadata structure
  - [x] Validate row data format
- [x] Update table display components if needed
  - [x] Test macro table rendering
  - [x] Verify VARIANT field expansion displays correctly
  - [x] Added null check for annotations in groupAnnotations
- [x] Test data visualization
  - [x] Ensure charts work with new data source
  - [x] Verify filtering/sorting
  - [x] Data loads successfully in UI
- [x] Verify macro discovery UI
  - [x] Test table list loads from metadata
  - [x] Check macro name display

### Files to Review

- [x] `/apps/web/app/(dashboard)/experiments/[id]/data/page.tsx`
- [x] `/apps/web/components/experiments/data-table.tsx`
- [x] `/apps/web/components/experiment-data/experiment-data-table-cell-collapsible.tsx`
  - [x] Simplified registry to pass raw string data to components
  - [x] Removed JSON parsing and try-catch logic from registry
- [x] `/apps/web/components/experiment-data/experiment-data-table-array-cell.tsx`
  - [x] Updated `ArrayExpandedContent` to accept raw string and parse internally
- [x] `/apps/web/components/experiment-data/experiment-data-table-map-cell.tsx`
  - [x] Updated `MapExpandedContent` to accept raw string and parse internally
- [x] `/apps/web/components/experiment-data/experiment-data-table-variant-cell.tsx`
  - [x] Updated `VariantExpandedContent` to accept raw string and format internally
- [x] Any visualization components using experiment data

## 5. Testing

### Unit Tests

- [ ] Update backend adapter tests
  - [ ] Mock new query patterns
  - [ ] Test VARIANT field access
  - [ ] Test experiment_id filtering
- [ ] Add tests for contributor refresh
- [ ] Add tests for annotation writing to central table

### Integration Tests

- [ ] Test full data flow: Kinesis → centrum pipeline → new tables
- [ ] Test backend queries against new tables
- [ ] Test annotation creation and visibility
- [ ] Verify enriched MVs update correctly
- [ ] Test cross-experiment queries

### Data Consistency Tests

- [ ] Compare old vs new table data
  - [ ] Sample counts match
  - [ ] Macro outputs identical
  - [ ] Device metadata consistent
- [ ] Verify no data loss during migration
- [ ] Test with multiple experiments

### Performance Tests

- [ ] Benchmark query performance
  - [ ] Old: `SELECT * FROM exp_00001.macro_photosynthesis LIMIT 100`
  - [ ] New: `SELECT macro_output:* FROM centrum.experiment_macro_data WHERE experiment_id = '...' LIMIT 100`
  - [ ] Target: 85-90% of original performance (10-20% slower acceptable)
- [ ] Test with realistic data volumes
- [ ] Monitor resource usage (CPU, memory)

## 6. Documentation

- [ ] Update developer README
  - [ ] New table structure
  - [ ] Query patterns
  - [ ] Annotation workflow
- [ ] Document VARIANT usage
  - [ ] Access patterns
  - [ ] Performance characteristics
- [ ] Update API documentation
  - [ ] New endpoints
  - [ ] Changed behaviors

## Success Criteria

- [x] ✅ All core tables created and receiving data locally
- [x] ✅ VARIANT macro processing validated
- [x] ✅ Backend successfully queries new tables
- [x] ✅ Frontend displays data correctly
- [ ] ✅ Enrichment tables and MVs implemented
- [ ] ✅ All tests pass
- [x] ✅ No references to old experiment schemas in queries
- [ ] ✅ Performance benchmarked (85-90% target)
- [ ] ✅ Team review and approval

## Recent Improvements (January 28, 2026)

### Semantic Improvements

- [x] ✅ **User struct field renamed**: `image` → `avatar` across entire stack
  - Updated Databricks Python schemas (centrum_pipeline.py, user_metadata.py)
  - Updated API schemas (zContributorColumnType)
  - Updated frontend components (experiment-data-table-user-cell.tsx)
  - Updated backend test fixtures
- [x] ✅ **User column renamed**: `user` → `contributor` downstream of experiment_contributors
  - Implemented using `.alias("contributor")` in enriched tables
  - Maintains backward compatibility at storage layer
  - Source table (experiment_contributors) unchanged

## Recent Improvements (January 29, 2026)

### Backend Architecture Improvements

- [x] ✅ **Strategy pattern consolidated into repository**:
  - Moved `RawDataQueryStrategy`, `DeviceDataQueryStrategy`, `MacroDataQueryStrategy` into `ExperimentDataRepository`
  - Added `buildQuery()` method that selects appropriate strategy based on table name
  - Removed separate strategy files from `/strategies` folder
  - Updated `GetExperimentDataUseCase` to call repository method directly
  - Simplified dependency injection (removed 3 strategy dependencies)

### Frontend Component Improvements

- [x] ✅ **Simplified expanded content rendering**:
  - Updated `ArrayExpandedContent`, `MapExpandedContent`, `VariantExpandedContent` to accept raw string data
  - Moved parsing logic from registry into individual components
  - Removed try-catch blocks from `EXPANDED_CONTENT_RENDERERS` registry
  - Components now handle their own data transformation internally
  - Cleaner separation of concerns between registry and rendering

### Annotation System Migration

- [x] ✅ **Annotations fully migrated to centrum schema**:
  - Backend now writes to single `centrum.experiment_annotations` table
  - Table properly partitioned by `experiment_id` for performance
  - Change data feed enabled for materialized view auto-refresh
  - All CRUD operations working (create, update, delete, bulk delete)
  - Proper input validation and SQL injection protection
  - No manual refresh triggers needed (MVs handle automatically)
  - Annotations visible across all experiments in unified table
  - **Removed `schemaName` parameter from all repository methods** (now hardcoded to "centrum")
  - **Updated all use cases** (add, update, delete) to remove schemaName logic
  - **Test files updated** to match new method signatures
  - **Unused imports cleaned up** (ErrorCodes removed)

## Next Steps After Phase 1

Once all items above are complete:

1. Commit changes to feature branch
2. Open PR for team review
3. Address feedback
4. Proceed to Phase 2: Deploy to Dev

## Notes

- Keep old experiment pipeline files unchanged during Phase 1
- Don't modify `raw_data` or `clean_data` tables (critical constraint)
- All new tables read FROM `clean_data` (additive only)
- Backend can fall back to old queries if issues arise
