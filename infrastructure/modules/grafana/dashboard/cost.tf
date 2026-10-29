# Cost
#
# What the platform costs: AWS as Cost Explorer bills it, and Databricks' own charges at list
# price. The Cost dashboard asks where the money goes, whether anything is running away, what
# Databricks really costs and what a measurement costs; the weekly report's Cost section carries
# its weekly cards. Each figure is a window its producer adds up and stamps when the window closed,
# read with Maximum, so a daily or weekly bucket holds exactly one point.
locals {
  cost_services = jsondecode(file("${path.module}/../../../../docs/monitoring/cost-services.json"))
  cost_colours  = { for category in local.cost_services.categories : category.name => category.colour }

  # Databricks bills its own charges and AWS bills the rest, its VMs included.
  cost_databricks           = "Databricks charges"
  cost_vms                  = "Databricks VMs"
  cost_tax                  = "Tax and fees"
  cost_aws_usage_categories = [for category in local.cost_services.categories : category.name if !contains([local.cost_databricks, local.cost_tax], category.name)]
  cost_measurement_colour   = "#9085e9"

  cost_query = {
    queryMode        = "Metrics"
    metricQueryType  = 0
    metricEditorMode = 1
    region           = var.aws_region
    namespace        = ""
    metricName       = ""
    dimensions       = {}
    matchExact       = true
    statistic        = "Maximum"
    expression       = ""
    label            = ""
    hide             = false
  }

  # The catalogue's searches, and a clause added inside one, so nothing here names a series the
  # catalogue does not.
  cost_search = { for id in ["aws-cost", "aws-daily-cost", "databricks-cost", "databricks-daily-cost"] : id => local.heartbeat_facts[id].search }
  cost_aws_week = merge(
    { usage = local.cost_search["aws-cost"] },
    { for category in local.cost_aws_usage_categories : category => replace(local.cost_search["aws-cost"], "', 'Maximum')", " AND Category=\"${category}\"', 'Maximum')") },
  )
  cost_aws_day = {
    for category in local.cost_aws_usage_categories : category => replace(local.cost_search["aws-daily-cost"], "', 'Maximum')", " AND Category=\"${category}\"', 'Maximum')")
  }

  # A week's inputs, hidden. A figure that adds both producers' reads only where both have a point
  # for the same window: Databricks' lands from midnight and AWS's from 00:30, and metric math
  # counts a missing point as zero, which would add one producer's week to nothing.
  cost_week_inputs = {
    aws          = merge(local.cost_query, { refId = "aws", id = "aws", hide = true, expression = "SUM(${local.cost_aws_week.usage})" })
    databricks   = merge(local.cost_query, { refId = "databricks", id = "databricks", hide = true, expression = "SUM(${local.cost_search["databricks-cost"]})" })
    vms          = merge(local.cost_query, { refId = "vms", id = "vms", hide = true, expression = "SUM(${local.cost_aws_week[local.cost_vms]})" })
    measurements = merge(local.heartbeat_queries["weekly-measurements"], { refId = "measurements", id = "measurements", hide = true, label = "" })
  }

  cost_month_inputs = {
    for id in [
      "aws-month-to-date", "aws-previous-month-to-date", "aws-previous-month", "aws-month-forecast",
      "databricks-month-to-date", "databricks-previous-month-to-date", "databricks-previous-month", "databricks-month-projected",
    ] : id => merge(local.heartbeat_queries[id], { refId = replace(id, "-", "_"), id = replace(id, "-", "_"), hide = true, label = "" })
  }

  # A month tile compares two series. Grafana reads the first row against the last, so each pair's
  # labels sort the earlier period first.
  cost_month_pair = { id = "reduce", options = { mode = "seriesToRows", reducers = ["lastNotNull"], includeTimeField = false } }

  cost_tiles = [
    {
      title       = "Platform cost, last week"
      description = "AWS's usage plus Databricks' charges at list price for the latest complete Monday-to-Sunday week, against the week before. Tax and fees are left out, since AWS dates a whole month's on the 1st."
      decimals    = null
      timeFrom    = "14d"
      period      = "604800"
      paired      = false
      targets = [
        local.cost_week_inputs.aws,
        local.cost_week_inputs.databricks,
        merge(local.cost_query, { refId = "platform", id = "platform", expression = "IF(aws > 0 AND databricks > 0, aws + databricks)" }),
      ]
    },
    {
      title       = "This month so far"
      description = "What the platform cost from the 1st to yesterday, AWS with the tax and fees accrued so far, against the month before at the same day. AWS dates a month's tax and fees on the 1st and adds to them as its usage grows, so the month before counts them in proportion to its usage by that day."
      decimals    = null
      timeFrom    = "3d"
      period      = "86400"
      paired      = true
      targets = [
        local.cost_month_inputs["aws-previous-month-to-date"],
        local.cost_month_inputs["databricks-previous-month-to-date"],
        local.cost_month_inputs["aws-month-to-date"],
        local.cost_month_inputs["databricks-month-to-date"],
        merge(local.cost_query, { refId = "earlier", id = "earlier", label = "Last month, to the same day", expression = "IF(aws_previous_month_to_date > 0 AND databricks_previous_month_to_date > 0, aws_previous_month_to_date + databricks_previous_month_to_date)" }),
        merge(local.cost_query, { refId = "later", id = "later", label = "This month so far", expression = "IF(aws_month_to_date > 0 AND databricks_month_to_date > 0, aws_month_to_date + databricks_month_to_date)" }),
      ]
    },
    {
      title       = "This month, projected"
      description = "AWS's own forecast for the month, actuals included, plus Databricks at the pace of the month's complete days, against the whole month before."
      decimals    = null
      timeFrom    = "3d"
      period      = "86400"
      paired      = true
      targets = [
        local.cost_month_inputs["aws-previous-month"],
        local.cost_month_inputs["databricks-previous-month"],
        local.cost_month_inputs["aws-month-forecast"],
        local.cost_month_inputs["databricks-month-projected"],
        merge(local.cost_query, { refId = "earlier", id = "earlier", label = "Last month", expression = "IF(aws_previous_month > 0 AND databricks_previous_month > 0, aws_previous_month + databricks_previous_month)" }),
        merge(local.cost_query, { refId = "later", id = "later", label = "This month, projected", expression = "IF(aws_month_forecast > 0 AND databricks_month_projected > 0, aws_month_forecast + databricks_month_projected)" }),
      ]
    },
    {
      title       = "Per 1,000 measurements"
      description = "Last week's platform cost divided by the measurements taken in it, against the week before."
      decimals    = 2
      timeFrom    = "14d"
      period      = "604800"
      paired      = false
      targets = [
        local.cost_week_inputs.aws,
        local.cost_week_inputs.databricks,
        local.cost_week_inputs.measurements,
        merge(local.cost_query, { refId = "per_1000", id = "per_1000", expression = "IF(aws > 0 AND databricks > 0 AND measurements > 0, 1000 * (aws + databricks) / measurements)" }),
      ]
    },
  ]

  cost_tile_panels = [
    for i, tile in local.cost_tiles : {
      id               = 701 + i
      type             = "stat"
      title            = tile.title
      description      = tile.description
      pluginVersion    = "10.4.1"
      datasource       = local.heartbeat_datasource
      timeFrom         = tile.timeFrom
      hideTimeOverride = true
      fieldConfig = {
        defaults = {
          noValue  = "No data"
          unit     = "currencyUSD"
          decimals = tile.decimals
          color    = { mode = "fixed", fixedColor = "text" }
        }
        overrides = []
      }
      options = {
        colorMode   = "none"
        graphMode   = "none"
        justifyMode = "center"
        orientation = "auto"
        textMode    = "value"
        text        = { titleSize = 13, valueSize = 34 }
        wideLayout  = true
        # A rise in cost is the bad direction.
        showPercentChange      = true
        percentChangeColorMode = "inverted"
        reduceOptions          = { calcs = ["lastNotNull"], fields = "", values = false }
      }
      transformations = [
        for transformation in [local.cost_month_pair, { id = "sortBy", options = { sort = [{ field = "Field", desc = false }] } }] :
        transformation if tile.paired
      ]
      targets = [for target in tile.targets : merge(target, { period = tile.period })]
    }
  ]

  cost_chart = {
    type       = "timeseries"
    datasource = local.heartbeat_datasource
    options = {
      legend  = { displayMode = "list", placement = "bottom", showLegend = true }
      tooltip = { mode = "multi", sort = "desc" }
    }
  }

  cost_bars = { drawStyle = "bars", fillOpacity = 80, lineWidth = 0, barWidthFactor = 0.6, showPoints = "never", stacking = { mode = "normal", group = "A" } }

  # One series per category, each bar the week its point closed.
  cost_week_series = {
    for name in concat([local.cost_databricks], local.cost_aws_usage_categories) : name => merge(local.cost_query, {
      refId      = "c${index(local.cost_services.categories[*].name, name)}"
      id         = "c${index(local.cost_services.categories[*].name, name)}"
      label      = name
      expression = name == local.cost_databricks ? "SUM(${local.cost_search["databricks-cost"]})" : "SUM(${local.cost_aws_week[name]})"
      period     = "86400"
    })
  }

  cost_stacks = {
    for key, names in {
      platform   = concat([local.cost_databricks], local.cost_aws_usage_categories)
      aws        = local.cost_aws_usage_categories
      databricks = [local.cost_databricks, local.cost_vms]
      } : key => merge(local.cost_chart, {
        fieldConfig = {
          defaults = { unit = "currencyUSD", min = 0, custom = local.cost_bars }
          overrides = [
            for name in names : {
              matcher    = { id = "byFrameRefID", options = local.cost_week_series[name].refId }
              properties = [{ id = "color", value = { mode = "fixed", fixedColor = local.cost_colours[name] } }]
            }
          ]
        }
        targets = [for name in names : local.cost_week_series[name]]
    })
  }

  cost_per_1000_chart = merge(local.cost_chart, {
    title       = "Platform cost per 1,000 measurements"
    description = "Each week's platform cost, without tax and fees, divided by the measurements taken in it. It rises when spend holds while measurements fall."
    fieldConfig = {
      defaults = {
        unit   = "currencyUSD"
        min    = 0
        color  = { mode = "fixed", fixedColor = local.cost_measurement_colour }
        custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 18, gradientMode = "opacity", showPoints = "always", pointSize = 6, spanNulls = true }
      }
      overrides = []
    }
    options = merge(local.cost_chart.options, { legend = { displayMode = "list", placement = "bottom", showLegend = false } })
    targets = [
      merge(local.cost_week_inputs.aws, { period = "86400" }),
      merge(local.cost_week_inputs.databricks, { period = "86400" }),
      merge(local.cost_week_inputs.measurements, { period = "86400" }),
      merge(local.cost_query, { refId = "per_1000", id = "per_1000", period = "86400", label = "Per 1,000 measurements", expression = "IF(aws > 0 AND databricks > 0 AND measurements > 0, 1000 * (aws + databricks) / measurements)" }),
    ]
  })

  # AWS's services and Databricks' components, read through a label that carries each one's
  # category, which the table splits back into two columns.
  cost_rows = [
    { id = "reduce", options = { mode = "seriesToRows", reducers = ["firstNotNull", "lastNotNull"], includeTimeField = false } },
    { id = "calculateField", options = { mode = "binary", binary = { left = "Last *", operator = "-", right = "First *" }, alias = "Change" } },
    { id = "calculateField", options = { mode = "binary", binary = { left = "Change", operator = "/", right = "First *" }, alias = "Change %" } },
    { id = "extractFields", options = { source = "Field", format = "regexp", regExp = "/(?<What>[^|]+)\\|(?<Category>.+)/", replace = false, keepTime = false } },
  ]

  cost_columns = {
    id = "organize"
    options = {
      excludeByName = { Field = true, "Size of change" = true }
      indexByName   = { What = 0, Category = 1, "Last *" = 2, "First *" = 3, Change = 4, "Change %" = 5 }
      renameByName  = { "Last *" = "Last week", "First *" = "Week before" }
    }
  }

  cost_table = {
    type        = "table"
    title       = "Last week, by service and pipeline"
    description = "The twelve biggest AWS services and Databricks components last week, against the week before. Green cost less, red cost more."
    datasource  = local.heartbeat_datasource
    timeFrom    = "14d"
    fieldConfig = {
      defaults = { unit = "currencyUSD", decimals = 0, custom = { align = "auto", cellOptions = { type = "auto" } } }
      overrides = [
        {
          matcher = { id = "byName", options = "What" }
          properties = [
            { id = "custom.width", value = 260 },
            { id = "mappings", value = [{ type = "value", options = { for component, name in local.cost_services.databricksComponents : component => { text = name } } }] },
          ]
        },
        {
          matcher = { id = "byName", options = "Category" }
          properties = [
            { id = "custom.width", value = 190 },
            { id = "custom.cellOptions", value = { type = "color-text" } },
            { id = "mappings", value = [{ type = "value", options = { for name, colour in local.cost_colours : name => { color = colour } } }] },
          ]
        },
        {
          matcher = { id = "byName", options = "Last week" }
          properties = [
            { id = "min", value = 0 },
            { id = "custom.cellOptions", value = { type = "gauge", mode = "basic", valueDisplayMode = "text" } },
            { id = "color", value = { mode = "fixed", fixedColor = "text" } },
          ]
        },
        {
          matcher = { id = "byName", options = "Change" }
          properties = [
            # A few cents either way would print as -$0.
            { id = "mappings", value = [{ type = "range", options = { from = -0.5, to = 0.5, result = { text = "$0" } } }] },
            { id = "custom.cellOptions", value = { type = "color-text" } },
            { id = "thresholds", value = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "text", value = -0.5 }, { color = "red", value = 0.5 }] } },
          ]
        },
        {
          matcher = { id = "byName", options = "Change %" }
          properties = [
            { id = "unit", value = "percentunit" },
            { id = "mappings", value = [{ type = "range", options = { from = -0.005, to = 0.005, result = { text = "0%" } } }] },
            { id = "custom.cellOptions", value = { type = "color-text" } },
            { id = "thresholds", value = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "text", value = -0.005 }, { color = "red", value = 0.005 }] } },
          ]
        },
      ]
    }
    options = { showHeader = true, cellHeight = "sm", footer = { show = false, reducer = ["sum"], countRows = false, fields = "" } }
    transformations = concat(local.cost_rows, [
      { id = "sortBy", options = { sort = [{ field = "Last *", desc = true }] } },
      { id = "limit", options = { limitField = 12 } },
      local.cost_columns,
    ])
    targets = [
      merge(local.cost_query, { refId = "aws", id = "aws", period = "604800", label = "$${PROP('Dim.Service')}|$${PROP('Dim.Category')}", expression = local.cost_aws_week.usage }),
      merge(local.cost_query, { refId = "databricks", id = "databricks", period = "604800", label = "$${PROP('Dim.Component')}|${local.cost_databricks}", expression = local.cost_search["databricks-cost"] }),
    ]
  }

  cost_movers = merge(local.cost_table, {
    title       = "What moved most"
    description = "The five services and pipelines whose cost changed most from the week before, either way. Green cost less, red cost more."
    transformations = concat(local.cost_rows, [
      { id = "calculateField", options = { mode = "unary", unary = { operator = "abs", fieldName = "Change" }, alias = "Size of change" } },
      { id = "sortBy", options = { sort = [{ field = "Size of change", desc = true }] } },
      { id = "limit", options = { limitField = 5 } },
      local.cost_columns,
    ])
  })

  # A category a chart, its own lines in shades of its colour, so one that runs away stands out
  # against the rest of its kind.
  cost_running = [
    for name in concat([local.cost_databricks], local.cost_aws_usage_categories) : merge(local.cost_chart, {
      title       = name
      description = "Each day's cost over the last 30 days, stamped at the midnight that closed it."
      timeFrom    = "30d"
      fieldConfig = {
        defaults = {
          unit   = "currencyUSD"
          color  = { mode = "shades", fixedColor = local.cost_colours[name] }
          custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never", axisSoftMin = 0, spanNulls = true }
        }
        overrides = []
      }
      transformations = [
        for component, label in local.cost_services.databricksComponents : { id = "renameByRegex", options = { regex = "^${component}$", renamePattern = label } }
        if name == local.cost_databricks
      ]
      targets = [merge(local.cost_query, {
        refId      = "A"
        id         = "a"
        period     = "86400"
        label      = name == local.cost_databricks ? "$${PROP('Dim.Component')}" : "$${PROP('Dim.Service')}"
        expression = name == local.cost_databricks ? local.cost_search["databricks-daily-cost"] : local.cost_aws_day[name]
      })]
    })
  ]

  # Yesterday as a share of each limit, biggest first: the same figure the spend rules alert on.
  cost_limits = {
    id          = 729
    type        = "bargauge"
    title       = "Yesterday, against each limit"
    description = "Each AWS service's and Databricks pipeline's spend yesterday as a share of its limit: twice its usual day, and at least $10 above it. Past 100% its spend rule alerts. Grafana bills its licences monthly and is left out."
    datasource  = local.heartbeat_datasource
    timeFrom    = "2d"
    fieldConfig = {
      defaults = {
        unit       = "percent"
        min        = 0
        max        = 100
        decimals   = 0
        color      = { mode = "thresholds" }
        thresholds = { mode = "absolute", steps = [{ color = "text", value = null }, { color = "orange", value = 75 }, { color = "red", value = 100 }] }
      }
      overrides = []
    }
    options = {
      displayMode   = "basic"
      orientation   = "horizontal"
      valueMode     = "color"
      namePlacement = "left"
      showUnfilled  = true
      sizing        = "manual"
      minVizHeight  = 16
      maxVizHeight  = 22
      text          = { titleSize = 13, valueSize = 14 }
      reduceOptions = { calcs = ["lastNotNull"], fields = "", values = true }
    }
    transformations = concat(
      [for component, label in local.cost_services.databricksComponents : { id = "renameByRegex", options = { regex = "^${component}$", renamePattern = label } }],
      [
        { id = "reduce", options = { mode = "seriesToRows", reducers = ["lastNotNull"], includeTimeField = false } },
        { id = "sortBy", options = { sort = [{ field = "Last *", desc = true }] } },
        { id = "limit", options = { limitField = 10 } },
      ],
    )
    targets = [
      merge(local.cost_query, { refId = "aws", id = "aws", period = "86400", label = "$${PROP('Dim.Service')}", expression = local.heartbeat_facts["aws-spend-limit"].search }),
      merge(local.cost_query, { refId = "databricks", id = "databricks", period = "86400", label = "$${PROP('Dim.Component')}", expression = local.heartbeat_facts["databricks-spend-limit"].search }),
    ]
  }

  cost_right_legend = merge(local.cost_chart.options, { legend = { displayMode = "list", placement = "right", showLegend = true } })
  cost_no_legend    = merge(local.cost_chart.options, { legend = { displayMode = "list", placement = "bottom", showLegend = false } })

  flow_cost_panels = concat(
    [merge(local.flow_caption, {
      id      = 700
      gridPos = { h = 2, w = 24, x = 0, y = 0 }
      options = { mode = "markdown", content = "**Platform** is what AWS bills plus Databricks' own charges at list price, which its billing tables carry. Weekly figures are usage only; the month tiles add AWS's tax and fees. A panel's ⓘ says how its figure is counted. Yesterday is the latest complete day." }
    })],
    [for i, tile in local.cost_tile_panels : merge(tile, { gridPos = { h = 4, w = 6, x = i * 6, y = 2 } })],
    [merge(local.flow_row, { id = 710, title = "Where does the money go?", gridPos = { h = 1, w = 24, x = 0, y = 6 } })],
    [merge(local.cost_stacks.platform, {
      id          = 711
      title       = "Platform cost per week"
      description = "The platform's usage per Monday-to-Sunday week, in five parts. Databricks VMs are the EC2 its clusters run on, which AWS bills; network is EC2's disks, NAT and IPs, the VPC and the load balancer; monitoring and audit is CloudWatch, CloudTrail, Config, the security services and Grafana. Tax and fees are at the bottom of the page."
      gridPos     = { h = 10, w = 24, x = 0, y = 7 }
      options     = local.cost_right_legend
    })],
    [merge(local.cost_table, { id = 712, gridPos = { h = 14, w = 24, x = 0, y = 17 } })],
    [merge(local.flow_row, { id = 720, title = "Is anything running away?", gridPos = { h = 1, w = 24, x = 0, y = 31 } })],
    [merge(local.cost_limits, { gridPos = { h = 10, w = 24, x = 0, y = 32 } })],
    [
      for i, chart in local.cost_running : merge(chart, {
        id = 721 + i
        gridPos = {
          h = 7
          w = 24 / local.flow_grid[tostring(length(local.cost_running))][i].size
          x = local.flow_grid[tostring(length(local.cost_running))][i].column * 24 / local.flow_grid[tostring(length(local.cost_running))][i].size
          y = 42 + local.flow_grid[tostring(length(local.cost_running))][i].line * 7
        }
      })
    ],
    [merge(local.flow_row, { id = 730, title = "What does Databricks really cost?", gridPos = { h = 1, w = 24, x = 0, y = 56 } })],
    [merge(local.cost_stacks.databricks, {
      id          = 731
      title       = "Databricks per week: its charges and the VMs AWS bills for it"
      description = "Databricks bills its own charges; AWS bills the EC2 its clusters run on. Nothing else the platform deploys runs on EC2, so all of EC2 compute counts as its VMs."
      gridPos     = { h = 8, w = 24, x = 0, y = 57 }
      options     = local.cost_right_legend
    })],
    [merge(local.flow_row, { id = 740, title = "What does a measurement cost?", gridPos = { h = 1, w = 24, x = 0, y = 65 } })],
    [
      merge(local.cost_chart, {
        id          = 741
        title       = "Measurements per week"
        description = "Measurements taken in each Monday-to-Sunday week, by measurement time."
        gridPos     = { h = 8, w = 12, x = 0, y = 66 }
        fieldConfig = {
          defaults  = { unit = "short", min = 0, color = { mode = "fixed", fixedColor = local.cost_measurement_colour }, custom = merge(local.cost_bars, { stacking = { mode = "none", group = "A" } }) }
          overrides = []
        }
        options = local.cost_no_legend
        targets = [merge(local.cost_week_inputs.measurements, { hide = false, period = "86400", label = "Measurements" })]
      }),
      merge(local.cost_per_1000_chart, { id = 742, gridPos = { h = 8, w = 12, x = 12, y = 66 } }),
    ],
    [merge(local.flow_row, { id = 750, title = "Tax and fees", gridPos = { h = 1, w = 24, x = 0, y = 74 } })],
    [
      for i, stat in [
        {
          title       = "Tax and fees, last month"
          description = "Everything AWS billed beyond usage for the whole month before: tax, monthly fees and subscriptions, less any credits."
          unit        = "currencyUSD"
          targets     = [merge(local.heartbeat_queries["aws-previous-month-tax"], { refId = "tax", id = "tax", label = "" })]
        },
        {
          title       = "Share of last month's AWS bill"
          description = "Last month's tax and fees as a share of everything AWS billed for it."
          unit        = "percent"
          targets = [
            merge(local.heartbeat_queries["aws-previous-month-tax"], { refId = "tax", id = "tax", label = "", hide = true }),
            merge(local.cost_month_inputs["aws-previous-month"], { hide = true }),
            merge(local.cost_query, { refId = "share", id = "share", expression = "IF(aws_previous_month > 0, 100 * tax / aws_previous_month)" }),
          ]
        },
        ] : {
        id               = 751 + i
        type             = "stat"
        title            = stat.title
        description      = stat.description
        pluginVersion    = "10.4.1"
        datasource       = local.heartbeat_datasource
        timeFrom         = "3d"
        hideTimeOverride = true
        gridPos          = { h = 4, w = 6, x = i * 6, y = 75 }
        fieldConfig = {
          defaults  = { noValue = "No data", unit = stat.unit, decimals = stat.unit == "percent" ? 0 : null, color = { mode = "fixed", fixedColor = "text" } }
          overrides = []
        }
        options = {
          colorMode         = "none"
          graphMode         = "none"
          justifyMode       = "center"
          orientation       = "auto"
          textMode          = "value"
          text              = { titleSize = 13, valueSize = 34 }
          wideLayout        = true
          showPercentChange = false
          reduceOptions     = { calcs = ["lastNotNull"], fields = "", values = false }
        }
        targets = [for target in stat.targets : merge(target, { period = "86400" })]
      }
    ],
    [merge(local.flow_caption, {
      id      = 753
      gridPos = { h = 4, w = 12, x = 12, y = 75 }
      options = { mode = "markdown", content = "AWS dates a month's tax and fees on the 1st and adds to them as the month's usage grows, so no week carries its own share, and the weekly figures leave them out. The month tiles count them, last month's in proportion to its usage by the same day." }
    })],
  )

  # The weekly report's Cost section: a card per figure, as in its other sections, each the week
  # against the week before above its 90 days, then what moved most.
  cost_weekly_cards = [
    {
      tile  = merge(local.cost_tile_panels[0], { title = "Platform cost" })
      trend = local.cost_stacks.platform
    },
    {
      tile = merge(local.cost_tile_panels[0], {
        id          = 762
        title       = "AWS cost"
        description = "What AWS billed for usage in the latest complete week, against the week before. Tax and fees are on the Cost dashboard."
        targets     = [merge(local.cost_week_inputs.aws, { hide = false, period = "604800" })]
      })
      trend = local.cost_stacks.aws
    },
    {
      tile = merge(local.cost_tile_panels[0], {
        id          = 763
        title       = "Databricks, with its VMs"
        description = "Databricks' charges at list price plus the EC2 its clusters ran on, which AWS bills, for the latest complete week against the week before."
        targets = [
          merge(local.cost_week_inputs.aws, { period = "604800" }),
          merge(local.cost_week_inputs.databricks, { period = "604800" }),
          merge(local.cost_week_inputs.vms, { period = "604800" }),
          merge(local.cost_query, { refId = "total", id = "total", period = "604800", expression = "IF(aws > 0 AND databricks > 0, databricks + vms)" }),
        ]
      })
      trend = local.cost_stacks.databricks
    },
    {
      tile  = merge(local.cost_tile_panels[3], { id = 764 })
      trend = local.cost_per_1000_chart
    },
  ]

  # Laid out from the section's top, the way the report's own cards are.
  cost_weekly_body_height = 9 * ceil(length(local.cost_weekly_cards) / 3) + 7
  cost_weekly_panels = concat(
    flatten([
      for j, card in local.cost_weekly_cards : [
        merge(card.tile, {
          gridPos = {
            h = 3
            w = 24 / local.flow_grid[tostring(length(local.cost_weekly_cards))][j].size
            x = local.flow_grid[tostring(length(local.cost_weekly_cards))][j].column * 24 / local.flow_grid[tostring(length(local.cost_weekly_cards))][j].size
            y = local.flow_grid[tostring(length(local.cost_weekly_cards))][j].line * 9
          }
        }),
        merge(card.trend, {
          id               = 765 + j
          title            = "Over 90 days"
          timeFrom         = "90d"
          hideTimeOverride = true
          # Not the report's week: the Cost dashboard reads 90 days.
          links = [{ title = "Cost dashboard", url = "/d/${local.flow_uids.cost}", targetBlank = false }]
          gridPos = {
            h = 6
            w = 24 / local.flow_grid[tostring(length(local.cost_weekly_cards))][j].size
            x = local.flow_grid[tostring(length(local.cost_weekly_cards))][j].column * 24 / local.flow_grid[tostring(length(local.cost_weekly_cards))][j].size
            y = 3 + local.flow_grid[tostring(length(local.cost_weekly_cards))][j].line * 9
          }
        }),
      ]
    ]),
    [merge(local.cost_movers, { id = 769, gridPos = { h = 7, w = 24, x = 0, y = 9 * ceil(length(local.cost_weekly_cards) / 3) } })],
  )
}
