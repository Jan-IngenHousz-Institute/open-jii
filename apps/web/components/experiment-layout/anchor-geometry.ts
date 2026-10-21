import type { LayoutAnchor } from "@repo/api/domains/experiment/layout/experiment-layout.schema";

interface Point {
  latitude: number;
  longitude: number;
}

// Meters per degree on a local, flat approximation, which holds across a field.
const METERS_PER_DEGREE_LATITUDE = 110_540;
const METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111_320;

/**
 * Where an anchored grid lies on the earth: the bearing of row A and the spacing between columns
 * come from the two clicked corners, the spacing between rows is typed, and rows after A lie to the
 * right of row A seen from plot A1.
 */
export class AnchorGeometry {
  readonly bearing: number | null;
  readonly columnSpacing: number | null;

  constructor(
    private readonly anchor: LayoutAnchor,
    private readonly rows: number,
    private readonly columns: number,
  ) {
    const { corner, rowEnd } = anchor;
    if (corner === null || rowEnd === null) {
      this.bearing = null;
      this.columnSpacing = null;
      return;
    }

    const { east, north } = AnchorGeometry.offset(corner, rowEnd);
    this.bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
    this.columnSpacing = Math.hypot(east, north) / columns;
  }

  /** Every plot can be placed once both corners and the row spacing are known. */
  get isComplete(): boolean {
    return this.bearing !== null && this.anchor.rowSpacing !== null;
  }

  /** The field's four outer corners in order, for drawing its outline. */
  outline(): [number, number][] {
    const { corner, rowEnd, rowSpacing } = this.anchor;
    if (corner === null || rowEnd === null || rowSpacing === null || this.bearing === null) {
      return [];
    }

    const depth = rowSpacing * this.rows;
    const across = this.bearing + 90;
    const farEnd = AnchorGeometry.move(rowEnd, across, depth);
    const farStart = AnchorGeometry.move(corner, across, depth);
    return [corner, rowEnd, farEnd, farStart].map((point) => [point.latitude, point.longitude]);
  }

  private static offset(from: Point, to: Point): { east: number; north: number } {
    const latitude = (from.latitude * Math.PI) / 180;
    return {
      east:
        (to.longitude - from.longitude) *
        METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR *
        Math.cos(latitude),
      north: (to.latitude - from.latitude) * METERS_PER_DEGREE_LATITUDE,
    };
  }

  private static move(from: Point, bearing: number, meters: number): Point {
    const radians = (bearing * Math.PI) / 180;
    const latitude = (from.latitude * Math.PI) / 180;
    return {
      latitude: from.latitude + (meters * Math.cos(radians)) / METERS_PER_DEGREE_LATITUDE,
      longitude:
        from.longitude +
        (meters * Math.sin(radians)) /
          (METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(latitude)),
    };
  }
}
