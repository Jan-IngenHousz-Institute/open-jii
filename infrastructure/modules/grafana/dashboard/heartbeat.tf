# Heartbeat reports
#
# The daily report says whether anything needs a person; the weekly report says how the
# platform was used. Both are generated from the catalog, so a signal that is not in it
# cannot appear here, and one that is active cannot be missing.
#
# Authenticated on purpose. A Grafana snapshot would be reachable without a login and
# would embed the rendered datapoints and series names permanently, which is the wrong
# trade for a platform that keeps device and experiment identifiers out of CloudWatch.
locals {
  heartbeat_catalog = yamldecode(file("${path.module}/../../../../docs/monitoring/metrics-catalog.yaml"))

  heartbeat_live = [
    for metric in local.heartbeat_catalog.metrics :
    metric if try(metric.active, false) && try(metric.signal, null) != null
  ]

  heartbeat_daily = [
    for m in local.heartbeat_live : m
    if m.family == "observability" && (contains(m.slots, "exception") || contains(m.slots, "alert"))
  ]
  heartbeat_weekly = [for m in local.heartbeat_live : m if contains(m.slots, "weekly")]

  heartbeat_daily_uid  = "${var.environment}-heartbeat-daily"
  heartbeat_weekly_uid = "${var.environment}-heartbeat-weekly"

  # A rule links to its entry's chart on the daily report, whose panel id is the entry's num.
  heartbeat_panel_ids = { for m in local.heartbeat_daily : m.id => tostring(m.num) }

  # Two export cycles plus margin, so one missed run does not fire the dead-man. The board
  # bridges gaps up to the same window, so a half-hourly gauge draws as one band and a
  # silence the alert would call a stop shows as a gap.
  heartbeat_dead_man_window_minutes = 75

  # Within its limit, a board row is a muted green, so a red reading is the only thing that
  # stands out. Solid, because the panel's fill opacity replaces any alpha a colour carries.
  heartbeat_ok_colour = "#2c4a33"

  # Reading order: can people use the platform, is data arriving, is it processed, do
  # macros run.
  heartbeat_daily_areas = [
    { key = "web", title = "Web" },
    { key = "api", title = "API and database" },
    { key = "ingest", title = "Ingest" },
    { key = "lakehouse", title = "Lakehouse" },
    { key = "sandboxes", title = "Sandboxes" },
  ]

  heartbeat_alert_height = 6

  # The data path's own section: volume entries share one chart, latency entries another,
  # and path entries are the tiles beneath them.
  heartbeat_path_areas = ["volume", "latency", "path"]

  # Usage is what stakeholders open the report for, so it leads. A weekly section gathers entries
  # from one or more areas, so the data path's own areas sit here as one section.
  heartbeat_weekly_areas = [
    {
      key     = "usage"
      title   = "Usage"
      areas   = ["usage"]
      caption = "**Active** means at least one measurement uploaded in the seven days, so people who only browse do not count. **New researchers** and **Researchers** are counted each Monday at 06:00 UTC. A sharp drop shows first on the [daily report](/d/${local.heartbeat_daily_uid}), as devices or experiments gone quiet."
    },
    {
      key     = "path"
      title   = "Data pipeline"
      areas   = ["volume", "latency", "path"]
      caption = "**Published** counts every message devices sent, device events included, so it runs above the rows that reach experiments. When Published grows and **Into experiments** does not, data is held up on the way, and the [Data pipeline dashboard](/d/${local.flow_uids["data-pipeline"]}) shows where."
    },
    {
      key     = "platform"
      title   = "Platform"
      areas   = ["platform"]
      caption = "**Site uptime** is the share of the week the site's health check passed. Which deploys failed, and how long each took from commit to production, are on [Delivery](/d/${local.flow_uids.delivery}); database storage sits with every other store on [Throughput and storage](/d/${local.flow_uids["throughput-storage"]})."
    },
  ]

  heartbeat_datasource = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_source.uid }

  heartbeat_limits = {
    for m in local.heartbeat_live :
    m.id => try(m.baseline.per_environment[var.environment].max, m.baseline.max, null)
  }

  heartbeat_facts = {
    for m in local.heartbeat_live : m.id => {
      unit     = try(local.heartbeat_units[m.signal.unit], "short")
      is_count = m.signal.stat == "Sum"
      # AWS publishes a count only when something happened, so its absence is a zero. The
      # heartbeat exporter reports every half hour, zeros included, so its absence is a gap.
      counts_events = m.signal.stat == "Sum" && m.source != "dbx"
      # An event count with nothing published counted nothing. CloudWatch answers an empty
      # frame rather than none, which a tile renders blank unless this is set.
      no_value = m.signal.stat == "Sum" && m.source != "dbx" ? "0" : "No data"
      floor    = try(m.baseline.min, null)
      decimals = contains(["percent", "ratio"], try(m.signal.unit, "")) ? 2 : null
      period   = try(m.signal.period, null)
      search   = templatestring(try(m.signal.search, ""), local.heartbeat_placeholders)
      # Rules read "more than N", so a limit of zero is red from the first one, and a count,
      # always whole, from N + 1.
      red_from = (
        try(m.baseline.anomaly, "") == "any-nonzero" ? 1 :
        local.heartbeat_limits[m.id] == null ? null :
        local.heartbeat_limits[m.id] == 0 ? 1 :
        m.signal.stat == "Sum" ? local.heartbeat_limits[m.id] + 1 :
        local.heartbeat_limits[m.id]
      )
    }
  }

  # A SEARCH entry and a plain metric entry differ only in which fields carry the query,
  # so both declare the same keys; terraform requires it and Grafana ignores the empty ones.
  heartbeat_queries = {
    for m in local.heartbeat_live : m.id => {
      refId            = "A"
      id               = "q"
      region           = try(m.signal.region, var.aws_region)
      namespace        = try(m.signal.namespace, "")
      statistic        = m.signal.stat
      metricQueryType  = 0
      metricEditorMode = local.heartbeat_facts[m.id].search != "" ? 1 : 0
      expression       = local.heartbeat_facts[m.id].search
      metricName       = try(m.signal.metric, "")
      matchExact       = local.heartbeat_facts[m.id].search == ""
      dimensions = local.heartbeat_facts[m.id].search != "" ? {} : {
        for name, value in try(m.signal.dimensions, {}) :
        name => templatestring(value, local.heartbeat_placeholders)
      }
    }
  }

  # A count as a search, so it can be summed across its series whatever its dimensions.
  heartbeat_count_searches = {
    for m in local.heartbeat_live : m.id => (
      local.heartbeat_facts[m.id].search != "" ? local.heartbeat_facts[m.id].search : format(
        "SEARCH('{%s} %s', 'Sum')",
        join(",", concat([m.signal.namespace], keys(try(m.signal.dimensions, {})))),
        join(" AND ", concat(
          ["MetricName=\"${m.signal.metric}\""],
          [for name, value in try(m.signal.dimensions, {}) : "${name}=\"${templatestring(value, local.heartbeat_placeholders)}\""],
        )),
      )
    ) if m.signal.stat == "Sum"
  }

  # One series per entry for its tile and its board row. An event count has its empty periods
  # as zero, and TIME_SERIES(0) keeps a row of zeros when CloudWatch no longer lists the metric
  # at all. FILL sits inside the SUM because Grafana's CloudWatch plugin crashes on FILL over
  # a SUM that matched nothing. A search that is not a count reads as its worst series.
  heartbeat_readings = {
    for m in local.heartbeat_live : m.id => merge(local.heartbeat_queries[m.id], {
      expression = (
        local.heartbeat_facts[m.id].counts_events ? "SUM([TIME_SERIES(0), SUM(FILL(${local.heartbeat_count_searches[m.id]}, 0))])" :
        local.heartbeat_facts[m.id].is_count && local.heartbeat_facts[m.id].search != "" ? "SUM(${local.heartbeat_facts[m.id].search})" :
        local.heartbeat_facts[m.id].search != "" ? "MAX(${local.heartbeat_facts[m.id].search})" :
        ""
      )
      metricEditorMode = local.heartbeat_facts[m.id].counts_events || local.heartbeat_facts[m.id].search != "" ? 1 : 0
    })
  }

  # A weekly tile reads its last bucket, and TIME_SERIES(0) would add an empty one at the
  # end of the range, so weekly counts keep only their own periods.
  heartbeat_weekly_readings = {
    for m in local.heartbeat_weekly : m.id => merge(local.heartbeat_queries[m.id], {
      expression = (
        local.heartbeat_facts[m.id].search == "" ? "" :
        local.heartbeat_facts[m.id].is_count ? "SUM(FILL(${local.heartbeat_facts[m.id].search}, 0))" :
        "MAX(${local.heartbeat_facts[m.id].search})"
      )
    })
  }

  # Grafana fills ${__from} and ${__to} when a link is clicked, so encoded text carries
  # tokens and gets the variables back afterwards. Spaces go as %20, which every handler reads.
  heartbeat_repository = regex("github\\.com/([^/]+/[^/]+)", var.runbook_base_url)[0]

  heartbeat_console_graphs = {
    for m in local.heartbeat_live : m.id => jsonencode({
      view    = "timeSeries"
      stacked = false
      region  = try(m.signal.region, var.aws_region)
      title   = m.name
      start   = "__FROM__"
      end     = "__TO__"
      period  = 300
      metrics = jsondecode(
        local.heartbeat_facts[m.id].search != ""
        ? jsonencode([{ expression = local.heartbeat_facts[m.id].search }])
        : jsonencode([concat(
          [m.signal.namespace, m.signal.metric],
          flatten([for name, value in local.heartbeat_queries[m.id].dimensions : [name, value]]),
          [{ stat = m.signal.stat }],
        )])
      )
    })
  }

  # The same URL Grafana's own "View in CloudWatch console" link uses. Through the access
  # portal when one is configured, so it lands in this environment's account and asks which
  # of the developer's roles to use.
  heartbeat_console_urls = {
    for m in local.heartbeat_live : m.id => replace(replace(replace(
      var.aws_access_portal_url == ""
      ? "https://${try(m.signal.region, var.aws_region)}.console.aws.amazon.com/cloudwatch/deeplink.js?region=${try(m.signal.region, var.aws_region)}#metricsV2:graph=${urlencode(local.heartbeat_console_graphs[m.id])}"
      : "${trimsuffix(var.aws_access_portal_url, "/")}/#/console?account_id=${data.aws_caller_identity.current.account_id}&destination=${urlencode("https://${try(m.signal.region, var.aws_region)}.console.aws.amazon.com/cloudwatch/deeplink.js?region=${try(m.signal.region, var.aws_region)}#metricsV2:graph=${urlencode(local.heartbeat_console_graphs[m.id])}")}",
    "+", "%20"), "__FROM__", "$${__from:date:iso}"), "__TO__", "$${__to:date:iso}")
  }

  heartbeat_triage_prompts = {
    for m in local.heartbeat_live : m.id => replace(replace(replace(
      urlencode("/openjii-triage ${m.id} on ${var.environment} between __FROM__ and __TO__"),
    "+", "%20"), "__FROM__", "$${__from:date:iso}"), "__TO__", "$${__to:date:iso}")
  }

  heartbeat_runbook_links = {
    for m in local.heartbeat_live : m.id => [
      for path in compact([try(m.runbook, "")]) : { title = "Runbook", url = "${var.runbook_base_url}/${path}", targetBlank = true }
    ]
  }

  # Worded like the link Grafana adds to a query's own values, since a menu can show both.
  heartbeat_console_links = {
    for m in local.heartbeat_live : m.id => [{ title = "View in CloudWatch console", url = local.heartbeat_console_urls[m.id], targetBlank = true }]
  }

  # Custom schemes open in place; a new tab would stay blank. Usage numbers have nothing to triage.
  heartbeat_triage_links = {
    for m in local.heartbeat_live : m.id => [
      for link in [
        { title = "Triage in VS Code", url = "vscode://anthropic.claude-code/open?prompt=${local.heartbeat_triage_prompts[m.id]}", targetBlank = false },
        { title = "Triage in terminal", url = "claude-cli://open?repo=${local.heartbeat_repository}&q=${local.heartbeat_triage_prompts[m.id]}", targetBlank = false },
      ] : link if m.family == "observability"
    ]
  }

  heartbeat_charts = {
    for m in local.heartbeat_live : m.id => {
      id         = m.num
      type       = "timeseries"
      title      = m.name
      datasource = local.heartbeat_datasource
      links      = concat(local.heartbeat_runbook_links[m.id], local.heartbeat_console_links[m.id], local.heartbeat_triage_links[m.id])
      fieldConfig = {
        defaults = {
          unit    = local.heartbeat_facts[m.id].unit
          noValue = local.heartbeat_facts[m.id].is_count ? "None" : "No data"
          color   = { mode = "palette-classic" }
          custom = merge(
            {
              drawStyle       = local.heartbeat_facts[m.id].period != null ? "bars" : "line"
              stacking        = { mode = local.heartbeat_facts[m.id].period != null ? "normal" : "none", group = "A" }
              lineWidth       = 2
              fillOpacity     = local.heartbeat_facts[m.id].period != null ? 80 : 8
              showPoints      = "never"
              thresholdsStyle = { mode = local.heartbeat_facts[m.id].red_from == null && local.heartbeat_facts[m.id].floor == null ? "off" : "dashed" }
            },
            # Keeps the limit on the chart when the data sits far below it.
            local.heartbeat_facts[m.id].red_from == null ? {} : { axisSoftMax = local.heartbeat_facts[m.id].red_from },
          )
          thresholds = {
            mode = "absolute"
            steps = concat(
              [{ color = "green", value = null }],
              local.heartbeat_facts[m.id].red_from == null ? [] : [{ color = "red", value = local.heartbeat_facts[m.id].red_from }],
              local.heartbeat_facts[m.id].floor == null ? [] : [{ color = "red", value = local.heartbeat_facts[m.id].floor }],
            )
          }
          decimals = local.heartbeat_facts[m.id].decimals
          # A share of time spans 0 to 100%, whatever the data does.
          min = local.heartbeat_facts[m.id].unit == "percentunit" ? 0 : null
          max = local.heartbeat_facts[m.id].unit == "percentunit" ? 1 : null
        }
        overrides = []
      }
      options = {
        # Only a SEARCH draws several series; a single one is already named by the title.
        legend  = { displayMode = "list", placement = "bottom", showLegend = local.heartbeat_facts[m.id].search != "" }
        tooltip = { mode = "multi", sort = "desc" }
      }
    }
  }

  # A quiet number with its shape beneath. The daily report gives one only to levels without a
  # limit, since the board carries the rest.
  heartbeat_level_tiles = {
    for m in local.heartbeat_daily : m.id => {
      id            = 100 + m.num
      type          = "stat"
      title         = m.name
      pluginVersion = "10.4.1"
      datasource    = local.heartbeat_datasource
      description = join(" ", [
        local.heartbeat_facts[m.id].is_count ? "Total over the time range." : "Highest value over the time range.",
        "Investigate with /openjii-triage ${m.id}.",
      ])
      fieldConfig = {
        defaults = {
          noValue    = local.heartbeat_facts[m.id].no_value
          unit       = local.heartbeat_facts[m.id].unit
          decimals   = local.heartbeat_facts[m.id].decimals
          color      = { mode = "thresholds" }
          thresholds = { mode = "absolute", steps = [{ color = "text", value = null }] }
          # On the value rather than the header, where a link icon would crowd out the title.
          # Grafana adds its own console link to a query's values, so the tile does not repeat it.
          links = concat(
            [{ title = "Over time", url = "/d/${local.heartbeat_daily_uid}?viewPanel=${m.num}&$${__url_time_range}", targetBlank = false }],
            local.heartbeat_flow_links[m.id],
            local.heartbeat_runbook_links[m.id],
            local.heartbeat_triage_links[m.id],
          )
        }
        overrides = []
      }
      options = {
        colorMode         = "value"
        graphMode         = "area"
        justifyMode       = "center"
        orientation       = "auto"
        textMode          = "value"
        text              = { titleSize = 13, valueSize = 26 }
        wideLayout        = true
        showPercentChange = false
        reduceOptions     = { calcs = [local.heartbeat_facts[m.id].is_count ? "sum" : "max"], fields = "", values = false }
      }
      targets = [merge(local.heartbeat_readings[m.id], { period = "300" })]
    }
  }

  # The latest value against the oldest in range. A rolling seven-day counter read daily
  # over seven days compares with a week ago; a signal counted per week compares its
  # last two weeks.
  heartbeat_weekly_tiles = {
    for m in local.heartbeat_weekly : m.id => {
      id               = 100 + m.num
      type             = "stat"
      title            = m.name
      pluginVersion    = "10.4.1"
      datasource       = local.heartbeat_datasource
      timeFrom         = local.heartbeat_facts[m.id].period != null ? "${2 * local.heartbeat_facts[m.id].period / 86400}d" : null
      hideTimeOverride = true
      description = (
        local.heartbeat_facts[m.id].period != null
        ? "The latest week against the week before."
        : "The last seven days against the seven days before."
      )
      # No data link: Grafana 10.4 leaves the percent change off a clickable value.
      fieldConfig = {
        defaults = {
          noValue    = local.heartbeat_facts[m.id].no_value
          unit       = local.heartbeat_facts[m.id].unit
          color      = { mode = "thresholds" }
          thresholds = { mode = "absolute", steps = [{ color = "text", value = null }] }
        }
        overrides = []
      }
      options = {
        colorMode   = "value"
        graphMode   = "area"
        justifyMode = "center"
        orientation = "auto"
        textMode    = "value"
        text        = { titleSize = 13, valueSize = 34 }
        wideLayout  = true
        # A change in a percentage reads as noise ("99.9%, down 0.1%"), so those show the level.
        showPercentChange = !contains(["percent", "percentunit"], local.heartbeat_facts[m.id].unit)
        reduceOptions     = { calcs = ["lastNotNull"], fields = "", values = false }
      }
      targets = [merge(local.heartbeat_weekly_readings[m.id], {
        period = tostring(coalesce(local.heartbeat_facts[m.id].period, 86400))
      })]
    }
  }

  heartbeat_trends = {
    for m in local.heartbeat_weekly : m.id => merge(local.heartbeat_charts[m.id], {
      links    = concat(local.heartbeat_flow_links[m.id], local.heartbeat_charts[m.id].links)
      timeFrom = "90d"
      targets = [merge(local.heartbeat_queries[m.id], {
        period = tostring(coalesce(local.heartbeat_facts[m.id].period, 86400))
      })]
    })
  }

  # Daily layout: what is firing, the data path, a board of every
  # rule-backed signal over the day, the levels without a limit, then every chart in one
  # collapsed row the board and tiles link into.
  # Panel ids below 100 are entry nums and 100 to 199 their tiles, so the rest sit above.
  heartbeat_alert_list = {
    id          = 900
    type        = "alertlist"
    title       = "Firing now"
    description = "Every rule in this workspace that is firing, pending, failing to evaluate or without data. Grafana posts each one to Slack when it fires."
    gridPos     = { h = local.heartbeat_alert_height, w = 16, x = 0, y = 0 }
    options = {
      viewMode                 = "list"
      groupMode                = "default"
      groupBy                  = []
      maxItems                 = 20
      sortOrder                = 3
      dashboardAlerts          = false
      alertName                = ""
      alertInstanceLabelFilter = ""
      showInstances            = false
      stateFilter              = { firing = true, pending = true, noData = true, error = true, normal = false }
    }
  }

  # The data path first, then area by area in reading order, critical signals first within each.
  heartbeat_daily_ordered = flatten([
    for area in concat([for key in local.heartbeat_path_areas : { key = key }], local.heartbeat_daily_areas) : [
      for severity in ["critical", "warning", ""] : [
        for m in local.heartbeat_daily : m if try(m.area, "") == area.key && try(m.severity, "") == severity
      ]
    ]
  ])
  heartbeat_watched    = [for m in local.heartbeat_daily_ordered : m if contains(m.slots, "alert")]
  heartbeat_path_tiles = [for m in local.heartbeat_daily_ordered : m if try(m.area, "") == "path"]
  heartbeat_levels = [
    for m in local.heartbeat_daily_ordered : m
    if !contains(m.slots, "alert") && !contains(local.heartbeat_path_areas, try(m.area, ""))
  ]

  heartbeat_board_steps = {
    for m in local.heartbeat_watched : m.id => (
      local.heartbeat_facts[m.id].floor != null ? [
        { color = "red", value = null },
        { color = local.heartbeat_ok_colour, value = local.heartbeat_facts[m.id].floor },
      ] :
      local.heartbeat_facts[m.id].red_from != null ? [
        { color = local.heartbeat_ok_colour, value = null },
        { color = "red", value = local.heartbeat_facts[m.id].red_from },
      ] :
      [{ color = local.heartbeat_ok_colour, value = null }]
    )
  }

  heartbeat_path_top     = local.heartbeat_alert_height
  heartbeat_path_height  = 1 + 10 + 3 * ceil(length(local.heartbeat_path_tiles) / 6)
  heartbeat_board_top    = local.heartbeat_path_top + local.heartbeat_path_height
  heartbeat_board_height = 3 + ceil(length(local.heartbeat_watched) * 0.7)
  heartbeat_levels_top   = local.heartbeat_board_top + 1 + local.heartbeat_board_height
  heartbeat_charts_top   = local.heartbeat_levels_top + 1 + 3 * ceil(length(local.heartbeat_levels) / 3)

  # Half-hour points, the exporter's bucket, so every stage lines up on the same instants.
  heartbeat_path_charts = [
    for index, chart in [
      {
        title       = "How much flows"
        description = "Rows through each stage per half hour, from device publishes to macro results; the legend totals the time range. A gap between two stages that stays open is data held up or lost between them."
        area        = "volume"
        calcs       = ["sum"]
      },
      {
        title       = "How long each hop takes"
        description = "The slowest twentieth of each hop per half hour: arrival to bronze, bronze to the experiment tables, the experiment tables to macro results, and the whole trip from the broker until the API can read it."
        area        = "latency"
        calcs       = ["mean", "max"]
      },
      ] : {
      id          = 902 + index
      type        = "timeseries"
      title       = chart.title
      description = chart.description
      datasource  = local.heartbeat_datasource
      # Tall enough for every stage's row in the legend's table.
      gridPos = { h = 10, w = 12, x = index * 12, y = local.heartbeat_path_top + 1 }
      fieldConfig = {
        defaults = {
          color  = { mode = "palette-classic" }
          custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never", spanNulls = 3600000 }
        }
        overrides = [
          for m in local.heartbeat_daily_ordered : {
            matcher = { id = "byFrameRefID", options = "P${m.num}" }
            properties = concat(
              [
                { id = "displayName", value = m.name },
                { id = "unit", value = local.heartbeat_facts[m.id].unit },
                { id = "links", value = [{ title = "Over time", url = "/d/${local.heartbeat_daily_uid}?viewPanel=${m.num}&$${__url_time_range}", targetBlank = false }] },
              ],
              [for colour in compact([lookup(local.flow_signal_colours, m.id, "")]) : { id = "color", value = { mode = "fixed", fixedColor = colour } }],
            )
          } if try(m.area, "") == chart.area
        ]
      }
      options = {
        legend  = { displayMode = "table", placement = "bottom", showLegend = true, calcs = chart.calcs }
        tooltip = { mode = "multi", sort = "none" }
      }
      targets = [
        for m in local.heartbeat_daily_ordered : merge(local.heartbeat_readings[m.id], { refId = "P${m.num}", id = "p${m.num}", period = "1800" })
        if try(m.area, "") == chart.area
      ]
    }
  ]

  heartbeat_board = {
    id            = 901
    type          = "state-timeline"
    title         = "Signals with an alert rule"
    description   = "One row per signal. Muted green is within its limit; red is a five-minute reading past it, even one too brief for its rule to fire; a gap is no data. Click a row for its chart."
    pluginVersion = "10.4.1"
    datasource    = local.heartbeat_datasource
    gridPos       = { h = local.heartbeat_board_height, w = 24, x = 0, y = local.heartbeat_board_top + 1 }
    fieldConfig = {
      defaults = {
        color      = { mode = "thresholds" }
        thresholds = { mode = "absolute", steps = [{ color = local.heartbeat_ok_colour, value = null }] }
        custom     = { fillOpacity = 100, lineWidth = 0, spanNulls = local.heartbeat_dead_man_window_minutes * 60000 }
      }
      overrides = [
        for m in local.heartbeat_watched : {
          matcher = { id = "byFrameRefID", options = "E${m.num}" }
          properties = [
            { id = "displayName", value = m.name },
            { id = "unit", value = local.heartbeat_facts[m.id].unit },
            { id = "thresholds", value = { mode = "absolute", steps = local.heartbeat_board_steps[m.id] } },
            {
              id = "links"
              # These replace the links Grafana adds to the values, so the console link is spelled out.
              value = concat(
                [{ title = "Over time", url = "/d/${local.heartbeat_daily_uid}?viewPanel=${m.num}&$${__url_time_range}", targetBlank = false }],
                local.heartbeat_flow_links[m.id],
                local.heartbeat_runbook_links[m.id],
                local.heartbeat_console_links[m.id],
                local.heartbeat_triage_links[m.id],
              )
            },
          ]
        }
      ]
    }
    options = {
      showValue   = "never"
      mergeValues = true
      rowHeight   = 0.7
      alignValue  = "left"
      legend      = { showLegend = false, displayMode = "list", placement = "bottom" }
      tooltip     = { mode = "single", sort = "none" }
    }
    targets = [
      for m in local.heartbeat_watched : merge(local.heartbeat_readings[m.id], { refId = "E${m.num}", id = "e${m.num}", period = "300" })
    ]
  }

  heartbeat_daily_panels = concat(
    [local.heartbeat_alert_list],
    [merge(local.flow_caption, {
      id      = 910
      gridPos = { h = local.heartbeat_alert_height, w = 8, x = 16, y = 0 }
      options = { mode = "markdown", content = "**The round, top to bottom.** Anything firing has already posted to Slack, and its rule links its runbook. Beneath: the data pipeline, the board of every rule (red is a five-minute reading past its limit) and the levels without one.\n\nHand anything odd to `/openjii-triage <id>`, or run the whole round from the header's Daily round in VS Code." }
    })],
    [{
      id        = 240
      type      = "row"
      title     = "Data pipeline"
      collapsed = false
      panels    = []
      gridPos   = { h = 1, w = 24, x = 0, y = local.heartbeat_path_top }
    }],
    [
      for chart in local.heartbeat_path_charts : merge(chart, {
        links = [{ title = "${local.flow_dashboards["data-pipeline"].title} dashboard", url = "/d/${local.flow_uids["data-pipeline"]}?$${__url_time_range}", targetBlank = false }]
      })
    ],
    [
      for j, m in local.heartbeat_path_tiles : merge(local.heartbeat_level_tiles[m.id], {
        gridPos = { h = 3, w = 4, x = (j % 6) * 4, y = local.heartbeat_path_top + 11 + floor(j / 6) * 3 }
      })
    ],
    [{
      id        = 245
      type      = "row"
      title     = "Alert rules"
      collapsed = false
      panels    = []
      gridPos   = { h = 1, w = 24, x = 0, y = local.heartbeat_board_top }
    }],
    [local.heartbeat_board],
    [{
      id        = 250
      type      = "row"
      title     = "Levels without a limit"
      collapsed = false
      panels    = []
      gridPos   = { h = 1, w = 24, x = 0, y = local.heartbeat_levels_top }
    }],
    [
      for j, m in local.heartbeat_levels : merge(local.heartbeat_level_tiles[m.id], {
        # Three to a line, so titles fit beside a docked navigation menu.
        gridPos = { h = 3, w = 8, x = (j % 3) * 8, y = local.heartbeat_levels_top + 1 + floor(j / 3) * 3 }
      })
    ],
    [{
      id        = 299
      type      = "row"
      title     = "Over time"
      collapsed = true
      gridPos   = { h = 1, w = 24, x = 0, y = local.heartbeat_charts_top }
      panels = [
        for j, m in local.heartbeat_daily_ordered : merge(local.heartbeat_charts[m.id], {
          description = "Investigate with /openjii-triage ${m.id}."
          links       = concat(local.heartbeat_flow_links[m.id], local.heartbeat_charts[m.id].links)
          gridPos     = { h = 8, w = 12, x = (j % 2) * 12, y = local.heartbeat_charts_top + 1 + floor(j / 2) * 8 }
          targets     = [merge(local.heartbeat_queries[m.id], { period = "300" })]
          # Rule and function names crowd a half-width chart; the tooltip still names each series.
          options = merge(local.heartbeat_charts[m.id].options, {
            legend = { displayMode = "list", placement = "bottom", showLegend = false }
          })
        })
      ]
    }],
  )

  # Weekly layout: a section per area, a line or two on reading it, then a card per signal, the
  # week against the week before above its 90 days, three to a line on the flows' grid.
  heartbeat_weekly_sections = [
    for area in local.heartbeat_weekly_areas : merge(area, {
      metrics = [for m in local.heartbeat_weekly : m if contains(area.areas, try(m.area, ""))]
    }) if length([for m in local.heartbeat_weekly : m if contains(area.areas, try(m.area, ""))]) > 0
  ]

  heartbeat_weekly_card_lines = [for s in local.heartbeat_weekly_sections : ceil(length(s.metrics) / 3)]
  heartbeat_weekly_tops = [
    for i, s in local.heartbeat_weekly_sections :
    sum(concat([0], [for line in slice(local.heartbeat_weekly_card_lines, 0, i) : 3 + 9 * line]))
  ]

  heartbeat_weekly_panels = flatten([
    for i, section in local.heartbeat_weekly_sections : concat(
      [{
        id        = 200 + i
        type      = "row"
        title     = section.title
        collapsed = false
        panels    = []
        gridPos   = { h = 1, w = 24, x = 0, y = local.heartbeat_weekly_tops[i] }
      }],
      [merge(local.flow_caption, {
        id      = 220 + i
        gridPos = { h = 2, w = 24, x = 0, y = local.heartbeat_weekly_tops[i] + 1 }
        options = { mode = "markdown", content = section.caption }
      })],
      flatten([
        for j, m in section.metrics : [
          merge(local.heartbeat_weekly_tiles[m.id], {
            gridPos = {
              h = 3
              w = 24 / local.flow_grid[tostring(length(section.metrics))][j].size
              x = local.flow_grid[tostring(length(section.metrics))][j].column * 24 / local.flow_grid[tostring(length(section.metrics))][j].size
              y = local.heartbeat_weekly_tops[i] + 3 + local.flow_grid[tostring(length(section.metrics))][j].line * 9
            }
          }),
          merge(local.heartbeat_trends[m.id], {
            title            = "Over 90 days"
            hideTimeOverride = true
            gridPos = {
              h = 6
              w = 24 / local.flow_grid[tostring(length(section.metrics))][j].size
              x = local.flow_grid[tostring(length(section.metrics))][j].column * 24 / local.flow_grid[tostring(length(section.metrics))][j].size
              y = local.heartbeat_weekly_tops[i] + 6 + local.flow_grid[tostring(length(section.metrics))][j].line * 9
            }
            # A path stage keeps the colour it has on the Data pipeline dashboard.
            fieldConfig = merge(local.heartbeat_trends[m.id].fieldConfig, {
              defaults = merge(local.heartbeat_trends[m.id].fieldConfig.defaults, {
                for name, colour in { color = { mode = "fixed", fixedColor = lookup(local.flow_signal_colours, m.id, "") } } : name => colour
                if contains(keys(local.flow_signal_colours), m.id)
              })
            })
          }),
        ]
      ]),
    )
  ])

  heartbeat_dashboard = {
    editable      = false
    graphTooltip  = 1
    refresh       = ""
    schemaVersion = 39
    timezone      = "browser"
    weekStart     = ""
    timepicker    = {}
    templating    = { list = [] }
    # The built-in query is what draws a linked rule's state changes on its chart.
    annotations = {
      list = [{
        builtIn    = 1
        datasource = { type = "grafana", uid = "-- Grafana --" }
        enable     = true
        hide       = true
        iconColor  = "rgba(0, 211, 255, 1)"
        name       = "Annotations & Alerts"
        type       = "dashboard"
      }]
    }
  }

  # Derived here rather than passed in, so the panels and the rules name the same series.
  alb_arn_suffix_heartbeat = element(split("loadbalancer/", var.load_balancer_arn), 1)

  heartbeat_macro_filter = join(" OR ", [
    for name in concat(
      values(var.macro_sandbox_function_names),
      [var.calibration_sandbox_function_name],
    ) : "FunctionName=\"${name}\""
  ])

  # The catalog writes its placeholders in terraform's own template syntax, so the panels
  # resolve them with templatestring rather than a chain of replaces. A name missing here
  # fails the plan instead of rendering a panel that queries a literal forever.
  heartbeat_placeholders = {
    ENVIRONMENT                     = var.environment
    KINESIS_STREAM_NAME             = var.kinesis_stream_name
    ALB_ARN_SUFFIX                  = local.alb_arn_suffix_heartbeat
    CLOUDFRONT_DISTRIBUTION_ID      = var.cloudfront_distribution_id
    SERVER_FUNCTION_NAME            = var.server_function_name
    MACRO_FUNCTION_FILTER           = local.heartbeat_macro_filter
    DB_CLUSTER_IDENTIFIER           = var.db_cluster_identifier
    HEALTH_CHECK_ID                 = var.route53_health_check_id
    TARGET_GROUP_DIMENSION          = local.dashboard_vars.target_group_dimension
    ECS_CLUSTER_NAME                = var.ecs_cluster_name
    ECS_SERVICE_NAME                = var.ecs_service_name
    METRICS_FORWARDER_FUNCTION_NAME = var.metrics_forwarder_function_name
  }

  # Grafana's unit ids for the units the catalog declares.
  heartbeat_units = {
    milliseconds = "ms"
    seconds      = "s"
    minutes      = "m"
    bytes        = "bytes"
    percent      = "percent"
    ratio        = "percentunit"
  }
}

resource "grafana_dashboard" "heartbeat_daily" {
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = jsonencode(merge(local.heartbeat_dashboard, {
    uid         = local.heartbeat_daily_uid
    title       = "Heartbeat · daily · ${var.environment}"
    description = "Whether anything needs a person: what is firing, and every issue signal over the last day."
    tags        = ["heartbeat", "daily"]
    time        = { from = "now-24h", to = "now" }
    links = concat(
      [{ title = "Weekly report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_weekly_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] }],
      [for key in local.flow_order : local.flow_header_links[key]],
      [
        { title = "Alert rules", type = "link", icon = "bolt", url = "/alerting/list", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
        { title = "Runbooks", type = "link", icon = "doc", url = "${replace(var.runbook_base_url, "blob/", "tree/")}/docs/runbooks", tooltip = "", targetBlank = true, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
        { title = "Daily round in VS Code", type = "link", icon = "external link", url = "vscode://anthropic.claude-code/open?prompt=${urlencode("/openjii-daily-round")}%20${var.environment}", tooltip = "Opens Claude Code in the focused VS Code window with the round pre-filled", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
      ],
    )
    panels = local.heartbeat_daily_panels
  }))
}

resource "grafana_dashboard" "heartbeat_weekly" {
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = jsonencode(merge(local.heartbeat_dashboard, {
    uid         = local.heartbeat_weekly_uid
    title       = "Heartbeat · weekly · ${var.environment}"
    description = "How the platform was used this week, against the week before, with the longer trend."
    tags        = ["heartbeat", "weekly"]
    time        = { from = "now-7d", to = "now" }
    links = concat(
      [{ title = "Daily report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_daily_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] }],
      [for key in local.flow_order : local.flow_header_links[key]],
    )
    panels = local.heartbeat_weekly_panels
  }))
}
