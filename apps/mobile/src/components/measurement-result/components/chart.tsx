import React from "react";
import { Text, View } from "react-native";
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from "react-native-svg";
import { useTheme } from "~/hooks/use-theme";

interface ChartProps {
  name: string;
  values: number[];
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 240;
const PADDING = { top: 12, right: 12, bottom: 28, left: 44 };
const TICK_COUNT = 5;

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nice: number;
  if (round) {
    nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  } else {
    nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  }
  return nice * Math.pow(10, exp);
}

function getTicks(min: number, max: number, count: number): number[] {
  if (min === max) {
    return [min - 1, min, min + 1];
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)));
  }
  return ticks;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  if (Number.isInteger(v)) return v.toString();
  return v.toPrecision(3);
}

export function Chart({ name, values }: ChartProps) {
  const theme = useTheme();
  const { colors } = theme;

  if (!values || values.length === 0) {
    return (
      <View
        className="my-5 rounded-2xl border px-5 py-5"
        style={{ borderColor: theme.isDark ? colors.dark.border : colors.light.border }}
      >
        <Text className="mb-5 text-center text-xl font-bold">{name}</Text>
        <Text className="mt-5 text-center text-base">No data available</Text>
      </View>
    );
  }

  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const yTicks = getTicks(minY, maxY, TICK_COUNT);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const toX = (i: number) =>
    PADDING.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const toY = (v: number) =>
    PADDING.top + (yMax === yMin ? plotH / 2 : (1 - (v - yMin) / (yMax - yMin)) * plotH);

  const pointsStr = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  const axisColor = theme.isDark ? colors.dark.border : colors.light.border;
  const labelColor = theme.isDark ? colors.dark.onSurface : colors.light.onSurface;

  return (
    <View
      className="my-5 rounded-2xl border px-5 py-5"
      style={{
        backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        borderColor: theme.isDark ? colors.dark.border : colors.light.border,
      }}
    >
      <Text
        className="mb-5 text-center text-xl font-bold"
        style={{
          color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
        }}
      >
        {name}
      </Text>

      <View
        className="h-[280px] items-center justify-center rounded-xl p-4"
        style={{
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        }}
      >
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Y-axis ticks and labels */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <React.Fragment key={`y-${tick}`}>
                <SvgLine
                  x1={PADDING.left}
                  y1={y}
                  x2={PADDING.left + plotW}
                  y2={y}
                  stroke={axisColor}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={PADDING.left - 6}
                  y={y + 3}
                  fontSize={9}
                  fill={labelColor}
                  textAnchor="end"
                >
                  {formatTick(tick)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* X-axis labels (first, middle, last) */}
          {values.length > 1 &&
            [0, Math.floor(values.length / 2), values.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((i) => (
                <SvgText
                  key={`x-${i}`}
                  x={toX(i)}
                  y={CHART_HEIGHT - 4}
                  fontSize={9}
                  fill={labelColor}
                  textAnchor="middle"
                >
                  {i + 1}
                </SvgText>
              ))}

          {/* Data line */}
          <Polyline
            points={pointsStr}
            fill="none"
            stroke={colors.primary.dark}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}
