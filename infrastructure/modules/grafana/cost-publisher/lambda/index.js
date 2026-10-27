"use strict";

// Handler only: AWS I/O. Which windows to ask Cost Explorer for, and how its answers become
// datapoints, live in @repo/monitoring, whose compiled output is copied to ./lib at build time.
const {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
} = require("@aws-sdk/client-cost-explorer");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

// Imported directly rather than through a barrel, which would pull in the catalog module and
// its js-yaml dependency, which this function does not ship
const { costDatums, costRequests } = require("./lib/cost.js");
const { batchByNamespace } = require("./lib/forwarder.js");
const services = require("./cost-services.json");

// Cost Explorer answers from us-east-1 only, whichever region calls it.
const costExplorer = new CostExplorerClient({ region: "us-east-1" });
const cloudwatch = new CloudWatchClient({});

// PutMetricData accepts 1000 datapoints per call; stay well under the 1MB request cap
const BATCH_SIZE = 100;

async function allResults(request) {
  const results = [];
  let token;

  do {
    const page = await costExplorer.send(
      new GetCostAndUsageCommand({ ...request, NextPageToken: token }),
    );
    results.push(...(page.ResultsByTime ?? []));
    token = page.NextPageToken;
  } while (token);

  return results;
}

async function monthForecast(request) {
  if (request === null) {
    return null;
  }

  try {
    const response = await costExplorer.send(new GetCostForecastCommand(request));
    const value = Number(response.Total?.Amount);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    // An account with too little history has no forecast, which costs that one datapoint.
    if (error.name === "DataUnavailableException") {
      return null;
    }
    throw error;
  }
}

exports.handler = async () => {
  // A defaulted environment would label every datapoint with the wrong one.
  const environment = process.env.ENVIRONMENT;
  if (!environment) {
    throw new Error("ENVIRONMENT is required");
  }

  const now = new Date();
  const requests = costRequests(now);

  const datums = costDatums({
    now,
    environment,
    services,
    usageByService: await allResults(requests.usageByService),
    totals: await allResults(requests.totals),
    forecast: await monthForecast(requests.forecast),
  });

  for (const batch of batchByNamespace(datums, BATCH_SIZE)) {
    await cloudwatch.send(
      new PutMetricDataCommand({ Namespace: batch.namespace, MetricData: batch.data }),
    );
  }

  console.log(JSON.stringify({ published: datums.length, forecast: requests.forecast !== null }));
};
