export interface CreateVolumeParams {
  /**
   * The name of the catalog where the schema and the volume are
   */
  catalog_name: string;

  /**
   * The comment attached to the volume
   */
  comment?: string;

  /**
   * The name of the volume
   */
  name: string;

  /**
   * The name of the schema where the volume is
   */
  schema_name: string;

  /**
   * The storage location on the cloud
   */
  storage_location?: string;

  /**
   * The type of the volume. An external volume is located in the specified external location.
   * A managed volume is located in the default location which is specified by the parent schema,
   * or the parent catalog, or the Metastore.
   */
  volume_type: "EXTERNAL" | "MANAGED";
}

export interface GetVolumeParams {
  /**
   * The three-level (fully qualified) name of the volume
   * Format: "catalog_name.schema_name.volume_name"
   */
  name: string;

  /**
   * Whether to include volumes in the response for which the principal can only access selective metadata for
   */
  include_browse?: boolean;
}

export interface VolumeResponse {
  /**
   * The AWS access point to use when accesing s3 for this external location.
   */
  access_point?: string;

  /**
   * Indicates whether the principal is limited to retrieving metadata for the
   * associated object through the BROWSE privilege when include_browse is enabled in the request.
   */
  browse_only?: boolean;

  /**
   * The name of the catalog where the schema and the volume are
   */
  catalog_name: string;

  /**
   * The comment attached to the volume
   */
  comment?: string;

  /**
   * Timestamp when the volume was created
   */
  created_at: number;

  /**
   * The identifier of the user who created the volume
   */
  created_by: string;

  /**
   * The three-level (fully qualified) name of the volume
   */
  full_name: string;

  /**
   * The unique identifier of the metastore
   */
  metastore_id: string;

  /**
   * The name of the volume
   */
  name: string;

  /**
   * The identifier of the user who owns the volume
   */
  owner: string;

  /**
   * The name of the schema where the volume is
   */
  schema_name: string;

  /**
   * The storage location on the cloud
   */
  storage_location?: string;

  /**
   * Timestamp when the volume was last updated
   */
  updated_at: number;

  /**
   * The identifier of the user who updated the volume last time
   */
  updated_by: string;

  /**
   * The unique identifier of the volume
   */
  volume_id: string;

  /**
   * The type of the volume
   */
  volume_type: "EXTERNAL" | "MANAGED";
}
