interface SparklineBox {
  width: number;
  height: number;
  padding: number;
}

const toTenths = (value: number) => Math.round(value * 10) / 10;

/**
 * An SVG path for a series drawn into a small box. The lowest and highest point of each pixel
 * column draw the same line as every sample, so a long series costs a couple of kilobytes of
 * markup instead of tens.
 */
export function sparklinePath(data: number[], { width, height, padding }: SparklineBox): string {
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const value of data) {
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }

  const range = maxValue - minValue || 1;
  const xStep = (width - 2 * padding) / (data.length - 1 || 1);
  const yScale = (height - 2 * padding) / range;

  const points: string[] = [];
  const keep = (index: number, value: number) =>
    points.push(
      `${toTenths(padding + index * xStep)},${toTenths(height - padding - (value - minValue) * yScale)}`,
    );

  const isShort = data.length <= 2 * (width - 2 * padding);
  if (isShort) {
    data.forEach((value, index) => keep(index, value));
    return `M ${points.join(" L ")}`;
  }

  let column = -1;
  let lowIndex = 0;
  let lowValue = 0;
  let highIndex = 0;
  let highValue = 0;
  const keepColumn = () => {
    if (lowIndex === highIndex) {
      keep(lowIndex, lowValue);
    } else if (lowIndex < highIndex) {
      keep(lowIndex, lowValue);
      keep(highIndex, highValue);
    } else {
      keep(highIndex, highValue);
      keep(lowIndex, lowValue);
    }
  };

  data.forEach((value, index) => {
    const pixel = Math.round(padding + index * xStep);
    if (pixel !== column) {
      if (column !== -1) {
        keepColumn();
      }
      column = pixel;
      lowIndex = highIndex = index;
      lowValue = highValue = value;
      return;
    }
    if (value < lowValue) {
      lowIndex = index;
      lowValue = value;
    }
    if (value > highValue) {
      highIndex = index;
      highValue = value;
    }
  });
  keepColumn();

  return `M ${points.join(" L ")}`;
}
