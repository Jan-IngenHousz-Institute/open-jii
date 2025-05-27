"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { formatDate } from "@/util/date";
import {
  generateMockSensorSummaries,
  generateMockNotifications,
  generateMockTimeline,
  generateHistoricalSensorData,
  generateMockExperimentPhases,
} from "@/util/mock-data";
import { subDays, subHours, addDays } from "date-fns";
import {
  ChartBarIcon,
  BeakerIcon,
  BellIcon,
  CalendarIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
} from "lucide-react";
import { useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Progress,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  RechartsPrimitive,
  Tooltip,
} from "@repo/ui/components";

interface ExperimentOverviewPageProps {
  params: { id: string };
}

export default function ExperimentOverviewPage({
  params,
}: ExperimentOverviewPageProps) {
  const { id } = params;
  const { data, isLoading, error } = useExperiment(id);
  const [dateRange, setDateRange] = useState<string>("7d");

  // Mock data for UI components
  const mockSensors = generateMockSensorSummaries(5);
  const mockNotifications = generateMockNotifications(6);
  const mockTimeline = generateMockTimeline(6);
  const mockPhases = generateMockExperimentPhases();

  // Generate chart data for a sample sensor
  const sensorData = generateHistoricalSensorData(
    "temp-sensor-1",
    "Temperature Sensor 1",
    24,
    5,
    "°C",
    7,
    24,
  );

  // Create chart data structure
  const chartData = sensorData.map((reading) => ({
    date: new Date(reading.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    time: new Date(reading.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: reading.value,
  }));

  if (isLoading) {
    return <div>Loading experiment details...</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title="Failed to load experiment" />;
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  const experiment = data.body;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "provisioning":
        return <Badge className="bg-yellow-500">Provisioning</Badge>;
      case "archived":
        return <Badge className="bg-gray-500">Archived</Badge>;
      case "stale":
        return <Badge className="bg-orange-500">Stale</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPhaseStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "upcoming":
        return <Badge className="bg-gray-400">Upcoming</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Experiment info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{experiment.name}</CardTitle>
              <CardDescription>
                {experiment.description || "No description provided"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(experiment.status)}
              <Badge variant="outline" className="ml-2 capitalize">
                {experiment.visibility}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Created
              </h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" />
                {formatDate(experiment.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Updated
              </h4>
              <p>{formatDate(experiment.updatedAt)}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Embargo Period
              </h4>
              <p>{experiment.embargoIntervalDays} days</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">ID</h4>
              <p className="truncate font-mono text-xs">{experiment.id}</p>
            </div>
          </div>

          {/* Metadata tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {experiment?.tags?.map((tag: string) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            )) || <p className="text-muted-foreground text-sm">No tags</p>}
          </div>

          {/* Quick actions */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Schedule
            </Button>
            <Button variant="outline" size="sm">
              Export Data
            </Button>
            <Button variant="outline" size="sm">
              Clone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Sensors
            </CardTitle>
            <BeakerIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockSensors.filter((s) => s.status === "online").length}
            </div>
            <p className="text-muted-foreground text-xs">
              Out of {mockSensors.length} total sensors
            </p>
            <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-green-500"
                style={{
                  width: `${(mockSensors.filter((s) => s.status === "online").length / mockSensors.length) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Readings
            </CardTitle>
            <ChartBarIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockSensors
                .reduce((acc, sensor) => acc + sensor.readingsCount, 0)
                .toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">Across all sensors</p>
            <div className="mt-3 grid grid-cols-5 gap-1">
              {mockSensors.map((sensor) => (
                <div
                  key={sensor.sensorId}
                  className="h-1 rounded-full"
                  style={{
                    backgroundColor:
                      sensor.status === "online"
                        ? "rgb(34, 197, 94)"
                        : sensor.status === "warning"
                          ? "rgb(234, 179, 8)"
                          : "rgb(239, 68, 68)",
                    opacity: 0.4 + (sensor.readingsCount / 1500) * 0.6,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Experiment Progress
            </CardTitle>
            <CalendarIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">65%</div>
            <Progress value={65} className="h-2" />
            <p className="text-muted-foreground mt-2 text-xs">
              Estimated completion: {formatDate(addDays(new Date(), 15))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data download section */}
      <Card>
        <CardHeader>
          <CardTitle>Available Data Sets</CardTitle>
          <CardDescription>
            Download experiment data for analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">Raw Sensor Data</h3>
                    <p className="text-muted-foreground text-sm">
                      Unprocessed readings from all sensors
                    </p>
                  </div>
                  <Badge>CSV</Badge>
                </div>
                <div className="mt-2 text-sm">
                  <p>Last updated: {formatDate(subHours(new Date(), 2))}</p>
                  <p className="text-muted-foreground">Size: 2.4 MB</p>
                </div>
                <Button className="mt-auto" size="sm">
                  Download
                </Button>
              </div>

              <div className="flex flex-col rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">Processed Readings</h3>
                    <p className="text-muted-foreground text-sm">
                      Cleaned and normalized data
                    </p>
                  </div>
                  <Badge>JSON</Badge>
                </div>
                <div className="mt-2 text-sm">
                  <p>Last updated: {formatDate(subDays(new Date(), 1))}</p>
                  <p className="text-muted-foreground">Size: 1.8 MB</p>
                </div>
                <Button className="mt-auto" size="sm">
                  Download
                </Button>
              </div>

              <div className="flex flex-col rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">Analysis Report</h3>
                    <p className="text-muted-foreground text-sm">
                      Generated summary with charts
                    </p>
                  </div>
                  <Badge>PDF</Badge>
                </div>
                <div className="mt-2 text-sm">
                  <p>Last updated: {formatDate(subDays(new Date(), 3))}</p>
                  <p className="text-muted-foreground">Size: 4.2 MB</p>
                </div>
                <Button className="mt-auto" size="sm">
                  Download
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sensors and Timeline */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Sensors List */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle>Sensors</CardTitle>
              <CardDescription>
                Status and readings of all experiment sensors
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sensors</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span>
                  Online (
                  {mockSensors.filter((s) => s.status === "online").length})
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <span>
                  Warning (
                  {mockSensors.filter((s) => s.status === "warning").length})
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span>
                  Offline (
                  {mockSensors.filter((s) => s.status === "offline").length})
                </span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sensor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Reading</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSensors.map((sensor) => (
                  <TableRow key={sensor.sensorId}>
                    <TableCell className="font-medium">
                      {sensor.sensorName}
                    </TableCell>
                    <TableCell>{sensor.type}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {sensor.lastReading} {sensor.unit}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Avg: {sensor.average} {sensor.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{sensor.min}</span>
                        <div className="bg-muted relative h-1.5 w-16 rounded-full">
                          <div
                            className="bg-primary absolute h-full rounded-full"
                            style={{
                              left: `${((sensor.min - sensor.min * 0.8) / (sensor.max * 1.2 - sensor.min * 0.8)) * 100}%`,
                              width: `${((sensor.max - sensor.min) / (sensor.max * 1.2 - sensor.min * 0.8)) * 100}%`,
                            }}
                          />
                          <div
                            className="-top-0.75 absolute h-3 w-1.5 -translate-x-1/2 transform rounded-full bg-blue-500"
                            style={{
                              left: `${((sensor.lastReading - sensor.min * 0.8) / (sensor.max * 1.2 - sensor.min * 0.8)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs">{sensor.max}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`mr-2 h-2.5 w-2.5 rounded-full ${
                            sensor.status === "online"
                              ? "bg-green-500"
                              : sensor.status === "warning"
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                        ></div>
                        <span className="capitalize">{sensor.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">
              View All Sensors
            </Button>
            <Button variant="outline" size="sm">
              Export Data
            </Button>
          </CardFooter>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  Notifications
                  <Badge className="ml-2 bg-red-500">
                    {mockNotifications.filter((n) => !n.read).length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Recent experiment alerts and updates
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon">
                <BellIcon className="text-muted-foreground h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockNotifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-2 border-b pb-3 last:border-0 ${
                    notification.read ? "opacity-70" : ""
                  }`}
                >
                  <div className="bg-muted mt-0.5 rounded-full p-1">
                    {notification.type === "error" ? (
                      <AlertTriangleIcon className="h-3.5 w-3.5 text-red-500" />
                    ) : notification.type === "warning" ? (
                      <AlertTriangleIcon className="h-3.5 w-3.5 text-yellow-500" />
                    ) : notification.type === "success" ? (
                      <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <InfoIcon className="h-3.5 w-3.5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between">
                      <p
                        className={`text-sm ${!notification.read ? "font-medium" : ""}`}
                      >
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <Badge
                          variant="outline"
                          className="ml-2 h-5 shrink-0 text-[10px]"
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">
                        {formatDate(notification.timestamp)}
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                        {notification.type === "error"
                          ? "Resolve"
                          : notification.type === "warning"
                            ? "Check"
                            : "Acknowledge"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">
              View All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={mockNotifications.every((n) => n.read)}
            >
              Mark All Read
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Chart and Phases */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Sensor Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Sensor Readings</CardTitle>
                <CardDescription>Environmental data over time</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select defaultValue="temp-sensor-1">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select Sensor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temp-sensor-1">Temperature</SelectItem>
                    <SelectItem value="humidity-sensor-1">Humidity</SelectItem>
                    <SelectItem value="light-sensor-1">Light</SelectItem>
                    <SelectItem value="co2-sensor-1">CO₂</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24h</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="all">All Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4">
              <div className="flex-1 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">Current</p>
                <p className="text-xl font-medium">24.8°C</p>
              </div>
              <div className="flex-1 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">Average</p>
                <p className="text-xl font-medium">23.5°C</p>
              </div>
              <div className="flex-1 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">Min</p>
                <p className="text-xl font-medium">19.2°C</p>
              </div>
              <div className="flex-1 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">Max</p>
                <p className="text-xl font-medium">26.7°C</p>
              </div>
            </div>
            <div className="h-[300px]">
              <ChartContainer
                config={{
                  temperature: {
                    label: "Temperature",
                    color: "#0ea5e9",
                  },
                  anomaly: {
                    label: "Anomaly",
                    color: "#ef4444",
                  },
                }}
              >
                <RechartsPrimitive.ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <RechartsPrimitive.LineChart
                    data={chartData}
                    margin={{
                      top: 5,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <RechartsPrimitive.XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={10}
                    />
                    <RechartsPrimitive.YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={ChartTooltip} />
                    <RechartsPrimitive.Line
                      type="monotone"
                      dataKey="value"
                      name="temperature"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {/* Add reference areas for anomalies */}
                    {chartData.length > 10 && (
                      <RechartsPrimitive.ReferenceArea
                        x1={chartData[Math.floor(chartData.length * 0.6)].date}
                        x2={chartData[Math.floor(chartData.length * 0.7)].date}
                        y1={chartData[0].value * 0.8}
                        y2={chartData[0].value * 1.2}
                        fill="rgba(239, 68, 68, 0.1)"
                        strokeOpacity={0.3}
                      />
                    )}
                    <RechartsPrimitive.ReferenceLine
                      y={24}
                      stroke="#0ea5e9"
                      strokeDasharray="3 3"
                    />
                    <RechartsPrimitive.Brush
                      dataKey="date"
                      height={20}
                      stroke="#8884d8"
                      startIndex={Math.max(0, chartData.length - 20)}
                      endIndex={chartData.length - 1}
                    />
                    <ChartLegend />
                  </RechartsPrimitive.LineChart>
                </RechartsPrimitive.ResponsiveContainer>
              </ChartContainer>
            </div>
            <div className="text-muted-foreground mt-4 flex items-center justify-between text-xs">
              <div>Sampling Frequency: Every 60 minutes</div>
              <div>Last Updated: {formatDate(new Date())}</div>
            </div>
          </CardContent>
        </Card>

        {/* Experiment Phases */}
        <Card>
          <CardHeader>
            <CardTitle>Experiment Phases</CardTitle>
            <CardDescription>Progress through planned phases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockPhases.map((phase, index) => (
                <div
                  key={phase.id}
                  className={`relative space-y-2 ${index < mockPhases.length - 1 ? "pb-6" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center font-medium">
                      <span className="bg-primary text-primary-foreground mr-2 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                        {index + 1}
                      </span>
                      {phase.name}
                    </h4>
                    {getPhaseStatusBadge(phase.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress
                      value={phase.progress}
                      className={`h-2 flex-1 ${
                        phase.status === "completed"
                          ? "bg-muted"
                          : phase.status === "active"
                            ? "bg-muted"
                            : "bg-muted/50"
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {phase.progress}%
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <div>
                      <p className="text-muted-foreground">
                        {formatDate(phase.startDate)} -{" "}
                        {formatDate(phase.endDate)}
                      </p>
                      <p className="mt-1">{phase.description}</p>
                    </div>

                    {phase.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                      >
                        Details
                      </Button>
                    )}
                  </div>

                  {/* Connecting line between phases */}
                  {index < mockPhases.length - 1 && (
                    <div className="border-border absolute bottom-0 left-2.5 top-5 h-[calc(100%-12px)] w-px border-l border-dashed" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Manage Phases
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Experiment Timeline</CardTitle>
            <CardDescription>Key events and milestones</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="milestone">Milestones</SelectItem>
                <SelectItem value="observation">Observations</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="data">Data Events</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-border relative ml-2 space-y-6 border-l pl-6">
            {mockTimeline.map((event, index) => (
              <div key={event.id} className="relative">
                <div className="bg-background border-border absolute -left-[30px] rounded-full border p-1">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      event.type === "milestone"
                        ? "bg-purple-500"
                        : event.type === "observation"
                          ? "bg-blue-500"
                          : event.type === "maintenance"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                    }`}
                  ></div>
                </div>
                <div className="pb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{event.title}</h4>
                    <Badge
                      variant="outline"
                      className={`capitalize ${
                        event.type === "milestone"
                          ? "border-purple-200 bg-purple-50 text-purple-700"
                          : event.type === "observation"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : event.type === "maintenance"
                              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                              : "border-green-200 bg-green-50 text-green-700"
                      }`}
                    >
                      {event.type}
                    </Badge>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatDate(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {event.description}
                  </p>
                  {index < mockTimeline.length - 1 && (
                    <div className="border-border absolute bottom-0 left-[-8px] top-[30px] border-l border-dashed" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">View Full Timeline</Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <span className="mr-1 h-3 w-3 rounded-full bg-purple-500" />{" "}
              Milestones
            </Button>
            <Button variant="ghost" size="sm">
              <span className="mr-1 h-3 w-3 rounded-full bg-blue-500" />{" "}
              Observations
            </Button>
          </div>
        </CardFooter>
      </Card>
      {/* Related Experiments */}
      <Card>
        <CardHeader>
          <CardTitle>Related Experiments</CardTitle>
          <CardDescription>
            Other experiments in the same series or with similar parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="hover:border-primary rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium">
                    {experiment.name.replace(/\d+$/, "")}{" "}
                    {i === 2
                      ? parseInt(/\d+$/.exec(experiment.name)?.[0] || "0") - 1
                      : parseInt(/\d+$/.exec(experiment.name)?.[0] || "0") + i}
                  </h3>
                  {getStatusBadge(
                    i === 1 ? "active" : i === 2 ? "archived" : "provisioning",
                  )}
                </div>
                <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                  {i === 2
                    ? "Previous experiment in the series with different sensor calibrations."
                    : i === 3
                      ? "Similar setup but using the enhanced measurement protocol."
                      : "Follow-up experiment using findings from the current study."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-muted-foreground text-xs">
                    Created:{" "}
                    {formatDate(subDays(new Date(), i * 15).toISOString())}
                  </div>
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">
            Find More Related Experiments
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
