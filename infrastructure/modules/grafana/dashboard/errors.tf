# Errors, from PostHog error tracking
#
# The daily report's errors section and the error inbox read the same issues through Infinity,
# with one scope and one set of links. PostHog alerts on new, reopened and spiking issues itself,
# so nothing here fires. PostHog runs three queries at a time and queues the rest, so each
# dashboard keeps to a handful.
locals {
  heartbeat_errors_uid = "${var.environment}-heartbeat-errors"

  heartbeat_posthog_url        = "https://eu.posthog.com"
  heartbeat_posthog_issues_url = "${local.heartbeat_posthog_url}/project/${var.posthog_project_id}/error_tracking"
  heartbeat_posthog_datasource = { type = "yesoreyeram-infinity-datasource", uid = one(grafana_data_source.posthog[*].uid) }

  # HogQL through Infinity: PostHog answers rows under `results`, read by column position.
  heartbeat_posthog_target = {
    refId         = "A"
    datasource    = local.heartbeat_posthog_datasource
    type          = "json"
    source        = "url"
    format        = "table"
    parser        = "backend"
    url           = "${local.heartbeat_posthog_url}/api/projects/${var.posthog_project_id}/query/"
    root_selector = "results"
  }
  heartbeat_posthog_request = {
    method            = "POST"
    body_type         = "raw"
    body_content_type = "application/json"
  }

  heartbeat_error_tracking_link = { title = "Error tracking", url = local.heartbeat_posthog_issues_url, targetBlank = true }
  heartbeat_error_inbox_link    = { title = "Error inbox", url = "/d/${local.heartbeat_errors_uid}?$${__url_time_range}", targetBlank = false }

  # Pages and app builds from before events named their environment still report. Most of them run
  # against prod, so prod counts them, marked untagged.
  heartbeat_exception_environment = (
    var.environment == "prod"
    ? "(properties.environment = 'prod' OR properties.environment IS NULL)"
    : "properties.environment = '${var.environment}'"
  )

  # Exceptions from this environment over the dashboard's time range; the inbox also by service.
  heartbeat_exception_scope = "event = '$exception' AND ${local.heartbeat_exception_environment} AND timestamp >= toDateTime('$${__from:date:iso}') AND timestamp < toDateTime('$${__to:date:iso}')"
  heartbeat_error_scopes = {
    daily = local.heartbeat_exception_scope
    inbox = "${local.heartbeat_exception_scope} AND ('$${service}' = 'all' OR coalesce(properties.service, 'untagged') = '$${service}')"
  }

  # The numbers count what the tables list: exceptions of issues still open.
  heartbeat_open_issues_filter = "issue_id IN (SELECT id FROM system.error_tracking_issues WHERE status = 'active')"

  # New issues first, then the most frequent. An issue is new when PostHog first grouped it inside
  # the time range. Where is the backend or page server route, with the operation the backend
  # logged, or the page, or the app screen.
  heartbeat_error_issue_queries = {
    for key, scope in local.heartbeat_error_scopes : key => <<-EOT
      SELECT i.id AS id, i.created_at >= toDateTime('$${__from:date:iso}') AS new, e.service AS service,
        substring(concat(i.name, ': ', i.description), 1, 160) AS issue, e.code AS code,
        if(isNull(e.operation), e.place, concat(e.place, ' · ', e.operation)) AS place,
        e.device AS device, e.version AS version, e.events AS events, e.users AS users,
        i.created_at AS first_seen, e.last_seen AS last_seen, e.request_id AS request_id
      FROM system.error_tracking_issues AS i
      INNER JOIN (
        SELECT issue_id, count() AS events, uniq(distinct_id) AS users, max(timestamp) AS last_seen,
          any(coalesce(properties.service, 'untagged')) AS service,
          argMax(properties.error_code, timestamp) AS code,
          any(coalesce(properties.route, properties.$pathname, properties.$screen_name)) AS place,
          argMax(properties.operation, timestamp) AS operation,
          any(coalesce(properties.$browser, nullIf(trim(concat(coalesce(properties.$device_manufacturer, ''), ' ', coalesce(properties.$os_name, ''), ' ', coalesce(properties.$os_version, ''))), ''))) AS device,
          argMax(properties.$app_version, timestamp) AS version,
          argMax(properties.request_id, timestamp) AS request_id
        FROM events
        WHERE ${scope}
        GROUP BY issue_id
      ) AS e ON e.issue_id = i.id
      WHERE i.status = 'active'
      ORDER BY new DESC, events DESC
      LIMIT 100
    EOT
  }

  heartbeat_error_issue_prompt = replace(replace(
    urlencode("/openjii-triage __ISSUE__ on ${var.environment}"),
  "+", "%20"), "__ISSUE__", "$${__data.fields.id}")

  # A backend row opens its latest request's log lines in Explore, by the request id both carry.
  heartbeat_error_logs_url = replace(local.log_explore_urls.backend, "__ID__", "$${__data.fields.request_id}")

  heartbeat_error_issue_columns = [
    for i, column in [
      { text = "id", type = "string" },
      { text = "new", type = "number" },
      { text = "service", type = "string" },
      { text = "issue", type = "string" },
      { text = "code", type = "string" },
      { text = "place", type = "string" },
      { text = "device", type = "string" },
      { text = "version", type = "string" },
      { text = "events", type = "number" },
      { text = "users", type = "number" },
      { text = "first_seen", type = "timestamp" },
      { text = "last_seen", type = "timestamp" },
      { text = "request_id", type = "string" },
    ] : merge(column, { selector = tostring(i) })
  ]

  # The daily report keeps to what decides whether a person is needed; the inbox shows what to
  # triage with too.
  heartbeat_error_hidden_columns = {
    daily = ["code", "place", "device", "version", "first_seen", "request_id"]
    inbox = []
  }

  heartbeat_error_tables = {
    for key, hidden in local.heartbeat_error_hidden_columns : key => {
      type        = "table"
      title       = key == "daily" ? "Error issues" : "Inbox"
      description = "Open issues with exceptions over the time range, new ones first. Click an issue to open it in PostHog or to triage it."
      datasource  = local.heartbeat_posthog_datasource
      links       = key == "daily" ? [local.heartbeat_error_inbox_link] : [local.heartbeat_error_tracking_link]
      fieldConfig = {
        defaults = {
          noValue = "No exceptions"
          custom  = { align = "auto", cellOptions = { type = "auto" }, inspect = false }
        }
        overrides = concat(
          [
            for column in concat(["id"], hidden) : { matcher = { id = "byName", options = column }, properties = [{ id = "custom.hidden", value = true }] }
          ],
          [
            {
              matcher = { id = "byName", options = "new" }
              properties = [
                { id = "displayName", value = "New" },
                { id = "custom.width", value = 64 },
                { id = "custom.cellOptions", value = { type = "color-text" } },
                { id = "mappings", value = [{ type = "value", options = { "1" = { text = "New", color = "orange", index = 0 }, "0" = { text = " ", index = 1 } } }] },
              ]
            },
            # The table's own empty message would otherwise fill a blank cell too.
            { matcher = { id = "byName", options = "service" }, properties = [{ id = "displayName", value = "Service" }, { id = "custom.width", value = 96 }, { id = "noValue", value = "-" }] },
            {
              matcher = { id = "byName", options = "issue" }
              properties = [
                { id = "displayName", value = "Issue" },
                # What went wrong is what a row is read for, so it keeps room when the rest fill.
                { id = "custom.minWidth", value = 360 },
                {
                  id = "links"
                  value = [
                    { title = "Open in PostHog", url = "${local.heartbeat_posthog_issues_url}/$${__data.fields.id}", targetBlank = true },
                    { title = "Triage in VS Code", url = "vscode://anthropic.claude-code/open?prompt=${local.heartbeat_error_issue_prompt}", targetBlank = false },
                    { title = "Triage in terminal", url = "claude-cli://open?repo=${local.heartbeat_repository}&q=${local.heartbeat_error_issue_prompt}", targetBlank = false },
                  ]
                },
              ]
            },
            { matcher = { id = "byName", options = "code" }, properties = [{ id = "displayName", value = "Code" }, { id = "custom.width", value = 140 }, { id = "noValue", value = "-" }] },
            { matcher = { id = "byName", options = "place" }, properties = [{ id = "displayName", value = "Where" }, { id = "custom.width", value = 200 }, { id = "noValue", value = "-" }] },
            { matcher = { id = "byName", options = "device" }, properties = [{ id = "displayName", value = "Device" }, { id = "custom.width", value = 140 }, { id = "noValue", value = "-" }] },
            { matcher = { id = "byName", options = "version" }, properties = [{ id = "displayName", value = "Version" }, { id = "custom.width", value = 80 }, { id = "noValue", value = "-" }] },
            { matcher = { id = "byName", options = "events" }, properties = [{ id = "displayName", value = "Events" }, { id = "custom.width", value = 80 }] },
            { matcher = { id = "byName", options = "users" }, properties = [{ id = "displayName", value = "Users" }, { id = "custom.width", value = 72 }] },
            { matcher = { id = "byName", options = "first_seen" }, properties = [{ id = "displayName", value = "First seen" }, { id = "unit", value = "dateTimeFromNow" }, { id = "custom.width", value = 120 }] },
            { matcher = { id = "byName", options = "last_seen" }, properties = [{ id = "displayName", value = "Last seen" }, { id = "unit", value = "dateTimeFromNow" }, { id = "custom.width", value = 120 }] },
            # Only backend reports carry a request id, so only their rows have logs to open.
            {
              matcher = { id = "byName", options = "request_id" }
              properties = [
                { id = "displayName", value = "Logs" },
                { id = "custom.width", value = 64 },
                { id = "noValue", value = "-" },
                { id = "mappings", value = [{ type = "regex", options = { pattern = ".+", result = { text = "Logs", index = 0 } } }] },
                { id = "links", value = [{ title = "Log lines of the latest request", url = local.heartbeat_error_logs_url, targetBlank = true }] },
              ]
            },
          ],
        )
      }
      options = {
        showHeader = true
        cellHeight = "sm"
        footer     = { show = false, reducer = ["sum"], countRows = false, fields = "" }
      }
      # Infinity names its fields in its own order, so they are put back in reading order.
      transformations = [{
        id = "organize"
        options = {
          indexByName = {
            new   = 0, service = 1, issue = 2, code = 3, place = 4, device = 5, version = 6, events = 7,
            users = 8, first_seen = 9, last_seen = 10, request_id = 11, id = 12,
          }
        }
      }]
      targets = [merge(local.heartbeat_posthog_target, {
        url_options = merge(local.heartbeat_posthog_request, {
          data = jsonencode({ query = { kind = "HogQLQuery", query = local.heartbeat_error_issue_queries[key] } })
        })
        columns = local.heartbeat_error_issue_columns
      })]
    }
  }

  # The inbox's headline numbers, one query each.
  heartbeat_inbox_tiles = [
    {
      title       = "Exceptions"
      description = "Every exception of an open issue over the time range."
      query       = "SELECT count() FROM events WHERE ${local.heartbeat_error_scopes.inbox} AND ${local.heartbeat_open_issues_filter}"
    },
    {
      title       = "Issues"
      description = "Open issues with at least one exception over the time range."
      query       = "SELECT uniq(issue_id) FROM events WHERE ${local.heartbeat_error_scopes.inbox} AND ${local.heartbeat_open_issues_filter}"
    },
    {
      title       = "New issues"
      description = "Open issues PostHog first grouped inside the time range."
      query       = "SELECT uniq(issue_id) FROM events WHERE ${local.heartbeat_error_scopes.inbox} AND issue_id IN (SELECT id FROM system.error_tracking_issues WHERE status = 'active' AND created_at >= toDateTime('$${__from:date:iso}'))"
    },
    {
      title       = "Users"
      description = "People an open issue reached. Server errors nobody was signed in for count as one per service."
      query       = "SELECT uniq(distinct_id) FROM events WHERE ${local.heartbeat_error_scopes.inbox} AND ${local.heartbeat_open_issues_filter}"
    },
  ]

  heartbeat_inbox_chart_query = <<-EOT
    SELECT toStartOfHour(timestamp) AS time, coalesce(properties.service, 'untagged') AS service,
      count() AS exceptions
    FROM events
    WHERE ${local.heartbeat_error_scopes.inbox} AND ${local.heartbeat_open_issues_filter}
    GROUP BY time, service
    ORDER BY time
  EOT

  heartbeat_inbox_panels = concat(
    [
      for i, tile in local.heartbeat_inbox_tiles : {
        id            = 1 + i
        type          = "stat"
        title         = tile.title
        description   = tile.description
        pluginVersion = "10.4.1"
        datasource    = local.heartbeat_posthog_datasource
        gridPos       = { h = 4, w = 6, x = i * 6, y = 0 }
        fieldConfig = {
          defaults = {
            noValue    = "0"
            unit       = "short"
            color      = { mode = "thresholds" }
            thresholds = { mode = "absolute", steps = [{ color = "text", value = null }] }
          }
          overrides = []
        }
        options = {
          colorMode         = "value"
          graphMode         = "none"
          justifyMode       = "center"
          orientation       = "auto"
          textMode          = "value"
          text              = { titleSize = 13, valueSize = 34 }
          wideLayout        = true
          showPercentChange = false
          reduceOptions     = { calcs = ["lastNotNull"], fields = "", values = false }
        }
        targets = [merge(local.heartbeat_posthog_target, {
          url_options = merge(local.heartbeat_posthog_request, { data = jsonencode({ query = { kind = "HogQLQuery", query = tile.query } }) })
          columns     = [{ selector = "0", text = tile.title, type = "number" }]
        })]
      }
    ],
    [{
      id          = 5
      type        = "timeseries"
      title       = "Exceptions over time"
      description = "Exceptions of open issues per hour, by the service that reported them. Untagged are from pages and app builds older than the tags."
      datasource  = local.heartbeat_posthog_datasource
      gridPos     = { h = 8, w = 18, x = 6, y = 4 }
      fieldConfig = {
        defaults = {
          displayName = "$${__field.labels.service}"
          min         = 0
          color       = { mode = "palette-classic" }
          custom      = { drawStyle = "bars", fillOpacity = 80, lineWidth = 1, stacking = { mode = "normal", group = "A" }, showPoints = "never" }
        }
        overrides = []
      }
      options = {
        legend  = { displayMode = "list", placement = "bottom", showLegend = true }
        tooltip = { mode = "multi", sort = "desc" }
      }
      # PostHog answers one row per hour and service; each service becomes its own series.
      transformations = [{ id = "prepareTimeSeries", options = { format = "multi" } }]
      targets = [merge(local.heartbeat_posthog_target, {
        url_options = merge(local.heartbeat_posthog_request, { data = jsonencode({ query = { kind = "HogQLQuery", query = local.heartbeat_inbox_chart_query } }) })
        columns = [
          { selector = "0", text = "time", type = "timestamp" },
          { selector = "1", text = "service", type = "string" },
          { selector = "2", text = "exceptions", type = "number" },
        ]
      })]
    }],
    [merge(local.flow_caption, {
      id      = 7
      gridPos = { h = 8, w = 6, x = 0, y = 4 }
      options = { mode = "markdown", content = "**An issue** is every exception PostHog grouped by the same stack, and the table lists the open ones. **New** means first seen in this time range.\n\nHand one to `/openjii-triage` with its id, or resolve or suppress it in PostHog, so this stays a list of open work. The Logs column opens that request's log lines.\n\n**Untagged** events come from releases that predate service tagging, such as app versions still in the field." }
    })],
    [merge(local.heartbeat_error_tables.inbox, { id = 6, gridPos = { h = 16, w = 24, x = 0, y = 12 } })],
  )

  # Every heartbeat dashboard's header opens the inbox, once there is one.
  heartbeat_errors_header_links = [
    for link in [{ title = "Errors", type = "link", icon = "bolt", url = "/d/${local.heartbeat_errors_uid}", tooltip = "The error inbox", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] }] :
    link if local.heartbeat_errors_shown
  ]
}

resource "grafana_dashboard" "heartbeat_errors" {
  count     = local.heartbeat_errors_shown ? 1 : 0
  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = jsonencode(merge(local.heartbeat_dashboard, {
    uid         = local.heartbeat_errors_uid
    title       = "Heartbeat · errors · ${var.environment}"
    description = "Every open error issue with exceptions in the time range, new ones first, to work through."
    tags        = ["heartbeat", "errors"]
    time        = { from = "now-7d", to = "now" }
    templating = {
      list = [{
        name       = "service"
        label      = "Service"
        type       = "custom"
        query      = "all,web,backend,mobile,untagged"
        current    = { text = "all", value = "all" }
        options    = [for value in ["all", "web", "backend", "mobile", "untagged"] : { text = value, value = value, selected = value == "all" }]
        multi      = false
        includeAll = false
        hide       = 0
      }]
    }
    links = concat(
      [
        { title = "Daily report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_daily_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
        { title = "Weekly report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_weekly_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
      ],
      [for key in local.flow_order : local.flow_header_links[key]],
      [{ title = "Error tracking", type = "link", icon = "external link", url = local.heartbeat_posthog_issues_url, tooltip = "PostHog's issues, across every environment", targetBlank = true, asDropdown = false, includeVars = false, keepTime = false, tags = [] }],
    )
    panels = local.heartbeat_inbox_panels
  }))
}
