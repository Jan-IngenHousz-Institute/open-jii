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
  cost_tax                  = local.cost_services.taxAndFees.category
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
  cost_aws_week = {
    for name, clause in merge(
      { usage = " NOT Category=\"${local.cost_tax}\"" },
      { for category in concat(local.cost_aws_usage_categories, [local.cost_tax]) : category => " AND Category=\"${category}\"" },
    ) : name => replace(local.cost_search["aws-cost"], "', 'Maximum')", "${clause}', 'Maximum')")
  }
  cost_aws_day = {
    for category in local.cost_aws_usage_categories : category => replace(local.cost_search["aws-daily-cost"], "', 'Maximum')", " AND Category=\"${category}\"', 'Maximum')")
  }

  # A week's inputs, hidden. REPEAT carries the latest week across the hours each Monday before the
  # cost publisher's morning run, when Databricks' week has landed and AWS's has not.
  cost_week_inputs = {
    aws          = merge(local.cost_query, { refId = "aws", id = "aws", hide = true, expression = "SUM(FILL(${local.cost_aws_week.usage}, REPEAT))" })
    databricks   = merge(local.cost_query, { refId = "databricks", id = "databricks", hide = true, expression = "SUM(FILL(${local.cost_search["databricks-cost"]}, REPEAT))" })
    vms          = merge(local.cost_query, { refId = "vms", id = "vms", hide = true, expression = "SUM(FILL(${local.cost_aws_week[local.cost_vms]}, REPEAT))" })
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
      decimals    = 0
      timeFrom    = "14d"
      period      = "604800"
      paired      = false
      targets = [
        local.cost_week_inputs.aws,
        local.cost_week_inputs.databricks,
        merge(local.cost_query, { refId = "platform", id = "platform", expression = "aws + databricks" }),
      ]
    },
    {
      title       = "This month so far"
      description = "What the platform cost from the 1st to yesterday, AWS with tax and fees, against the month before at the same day."
      decimals    = 0
      timeFrom    = "3d"
      period      = "86400"
      paired      = true
      targets = [
        local.cost_month_inputs["aws-previous-month-to-date"],
        local.cost_month_inputs["databricks-previous-month-to-date"],
        local.cost_month_inputs["aws-month-to-date"],
        local.cost_month_inputs["databricks-month-to-date"],
        merge(local.cost_query, { refId = "earlier", id = "earlier", label = "Last month, to the same day", expression = "FILL(aws_previous_month_to_date, REPEAT) + FILL(databricks_previous_month_to_date, REPEAT)" }),
        merge(local.cost_query, { refId = "later", id = "later", label = "This month so far", expression = "FILL(aws_month_to_date, REPEAT) + FILL(databricks_month_to_date, REPEAT)" }),
      ]
    },
    {
      title       = "This month, projected"
      description = "AWS's own forecast for the month, actuals included, plus Databricks at the pace of the month's complete days, against the whole month before."
      decimals    = 0
      timeFrom    = "3d"
      period      = "86400"
      paired      = true
      targets = [
        local.cost_month_inputs["aws-previous-month"],
        local.cost_month_inputs["databricks-previous-month"],
        local.cost_month_inputs["aws-month-forecast"],
        local.cost_month_inputs["databricks-month-projected"],
        merge(local.cost_query, { refId = "earlier", id = "earlier", label = "Last month", expression = "FILL(aws_previous_month, REPEAT) + FILL(databricks_previous_month, REPEAT)" }),
        merge(local.cost_query, { refId = "later", id = "later", label = "This month, projected", expression = "FILL(aws_month_forecast, REPEAT) + FILL(databricks_month_projected, REPEAT)" }),
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
        merge(local.cost_query, { refId = "per_1000", id = "per_1000", expression = "1000 * (aws + databricks) / FILL(measurements, REPEAT)" }),
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
    for name in concat([local.cost_databricks], local.cost_aws_usage_categories, [local.cost_tax]) : name => merge(local.cost_query, {
      refId      = "c${index(local.cost_services.categories[*].name, name)}"
      id         = "c${index(local.cost_services.categories[*].name, name)}"
      label      = name
      expression = name == local.cost_databricks ? "SUM(${local.cost_search["databricks-cost"]})" : "SUM(${local.cost_aws_week[name]})"
      period     = "86400"
    })
  }

  cost_stacks = {
    for key, names in {
      everything = concat([local.cost_databricks], local.cost_aws_usage_categories, [local.cost_tax])
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
      merge(local.cost_week_inputs.aws, { expression = "SUM(${local.cost_aws_week.usage})", period = "86400" }),
      merge(local.cost_week_inputs.databricks, { expression = "SUM(${local.cost_search["databricks-cost"]})", period = "86400" }),
      merge(local.cost_week_inputs.measurements, { period = "86400" }),
      merge(local.cost_query, { refId = "per_1000", id = "per_1000", period = "86400", label = "Per 1,000 measurements", expression = "1000 * (aws + databricks) / measurements" }),
    ]
  })

  # Every AWS service and Databricks component, read through a label that carries its category,
  # which the table splits back into two columns.
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
    description = "Every AWS service and Databricks component, biggest first, last week against the week before. Green cost less, red cost more."
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
            { id = "custom.cellOptions", value = { type = "color-text" } },
            { id = "thresholds", value = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "text", value = -0.5 }, { color = "red", value = 0.5 }] } },
          ]
        },
        {
          matcher = { id = "byName", options = "Change %" }
          properties = [
            { id = "unit", value = "percentunit" },
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

  cost_right_legend = merge(local.cost_chart.options, { legend = { displayMode = "list", placement = "right", showLegend = true } })
  cost_no_legend    = merge(local.cost_chart.options, { legend = { displayMode = "list", placement = "bottom", showLegend = false } })

  flow_cost_panels = concat(
    [merge(local.flow_caption, {
      id      = 700
      gridPos = { h = 2, w = 24, x = 0, y = 0 }
      options = { mode = "markdown", content = "**Platform** is what AWS bills, tax included, plus Databricks' own charges at list price, which its billing tables carry. A panel's ⓘ says how its figure is counted. Cost Explorer reports once a day, so yesterday is the latest day." }
    })],
    [for i, tile in local.cost_tile_panels : merge(tile, { gridPos = { h = 4, w = 6, x = i * 6, y = 2 } })],
    [merge(local.flow_row, { id = 710, title = "Where does the money go?", gridPos = { h = 1, w = 24, x = 0, y = 6 } })],
    [merge(local.cost_stacks.everything, {
      id          = 711
      title       = "Platform cost per week"
      description = "Every dollar of the platform per Monday-to-Sunday week, in six parts. Databricks VMs are the EC2 its clusters run on, which AWS bills; network is EC2's disks, NAT and IPs, the VPC and the load balancer; monitoring and audit is CloudWatch, CloudTrail, Config, the security services and Grafana. AWS dates a month's tax and fees on the 1st."
      gridPos     = { h = 10, w = 24, x = 0, y = 7 }
      options     = local.cost_right_legend
    })],
    [merge(local.cost_table, { id = 712, gridPos = { h = 14, w = 24, x = 0, y = 17 } })],
    [merge(local.flow_row, { id = 720, title = "Is anything running away?", gridPos = { h = 1, w = 24, x = 0, y = 31 } })],
    [
      for i, chart in local.cost_running : merge(chart, {
        id = 721 + i
        gridPos = {
          h = 7
          w = 24 / local.flow_grid[tostring(length(local.cost_running))][i].size
          x = local.flow_grid[tostring(length(local.cost_running))][i].column * 24 / local.flow_grid[tostring(length(local.cost_running))][i].size
          y = 32 + local.flow_grid[tostring(length(local.cost_running))][i].line * 7
        }
      })
    ],
    [merge(local.flow_row, { id = 730, title = "What does Databricks really cost?", gridPos = { h = 1, w = 24, x = 0, y = 46 } })],
    [merge(local.cost_stacks.databricks, {
      id          = 731
      title       = "Databricks per week: its charges and the VMs AWS bills for it"
      description = "Databricks bills its own charges; AWS bills the EC2 its clusters run on, which nothing else in the account uses."
      gridPos     = { h = 8, w = 24, x = 0, y = 47 }
      options     = local.cost_right_legend
    })],
    [merge(local.flow_row, { id = 740, title = "What does a measurement cost?", gridPos = { h = 1, w = 24, x = 0, y = 55 } })],
    [
      merge(local.cost_chart, {
        id          = 741
        title       = "Measurements per week"
        description = "Measurements taken in each Monday-to-Sunday week, by measurement time."
        gridPos     = { h = 8, w = 12, x = 0, y = 56 }
        fieldConfig = {
          defaults  = { unit = "short", min = 0, color = { mode = "fixed", fixedColor = local.cost_measurement_colour }, custom = merge(local.cost_bars, { stacking = { mode = "none", group = "A" } }) }
          overrides = []
        }
        options = local.cost_no_legend
        targets = [merge(local.cost_week_inputs.measurements, { hide = false, period = "86400", label = "Measurements" })]
      }),
      merge(local.cost_per_1000_chart, { id = 742, gridPos = { h = 8, w = 12, x = 12, y = 56 } }),
    ],
    [merge(local.flow_row, { id = 750, title = "Tax and fees", gridPos = { h = 1, w = 24, x = 0, y = 64 } })],
    [
      merge(local.cost_chart, {
        id          = 751
        title       = "Tax and fees, as they land"
        description = "Everything AWS billed beyond usage, per Monday-to-Sunday week: tax, monthly fees and subscriptions, less any credits."
        gridPos     = { h = 6, w = 16, x = 0, y = 65 }
        fieldConfig = {
          defaults  = { unit = "currencyUSD", min = 0, color = { mode = "fixed", fixedColor = local.cost_colours[local.cost_tax] }, custom = local.cost_bars }
          overrides = []
        }
        options = local.cost_no_legend
        targets = [local.cost_week_series[local.cost_tax]]
      }),
      merge(local.flow_caption, {
        id      = 752
        gridPos = { h = 6, w = 8, x = 16, y = 65 }
        options = { mode = "markdown", content = "AWS dates a whole month's tax and fees on the 1st and adds to them as the month runs, so they land in the week that holds it.\n\nOn dev in October 2026 they came to a steady 17% of the AWS bill, 21% on top of usage. The weekly figures leave them out so that week compares fairly; the month tiles count them." }
      }),
    ],
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
          merge(local.cost_week_inputs.databricks, { period = "604800" }),
          merge(local.cost_week_inputs.vms, { period = "604800" }),
          merge(local.cost_query, { refId = "total", id = "total", period = "604800", expression = "databricks + vms" }),
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
