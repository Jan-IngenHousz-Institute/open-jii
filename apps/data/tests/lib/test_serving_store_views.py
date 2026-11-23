"""The serving store's reads for the backend: views that name one experiment, the tables under them,
which its reader reads only for the experiment a read names in a setting, the platform metrics'
views, and the contributor and client ids kept beside the rows.

The tests run against the test store ``pnpm test`` starts. The packaged server config allows custom
settings under SQL_, as the store's does.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from xml.etree import ElementTree

import pytest
import requests
from openjii.serving_store import writer as writer_module
from openjii.serving_store.tables import MEASUREMENTS, Settle
from openjii.serving_store.writer import StoreWriter

from tests.serving_store_module import ServingStoreModule

pytestmark = pytest.mark.clickhouse

_DATABASE = "views_test"
_READER = "views_test_reader"
_READER_PROFILE = "views_test_reader_profile"
_READER_POLICY = "views_test_reader_policy"
_EXPERIMENT_SETTING = "SQL_experiment"

_MODULE = Path(__file__).parents[4] / "infrastructure/modules/serving-store"
_USERS_XML = _MODULE / "templates/users.xml.tftpl"


_TEST_READER = Path(__file__).parents[4] / "packages/database/test-store/reader.json"
_STORE_MODULE = ServingStoreModule.read()
_READER_VIEWS = tuple(_STORE_MODULE.local_list("reader_views"))
_READER_TABLES = tuple(_STORE_MODULE.local_list("reader_tables"))
_READER_ROW_FILTER = _STORE_MODULE.local("reader_row_filter")

_DEVICE_MIGRATION = "0011_device_reads.sql"

_COMMIT = "_commit_version, _commit_timestamp"
_WINDOW = "from = '2026-10-19 00:00:00', to = '2026-10-19 23:59:59'"
# The rows the admin fixture writes for e1, by table.
_E1_IDS = {"measurements": [1, 2], "macro_results": [11], "uploads": [21]}


def _reader_profile() -> str:
    """The profile the module gives the reader, with the profiles it inherits, as the store's
    users.xml sets them, its fixed settings fixed, as a statement a test server can run."""
    template = _USERS_XML.read_text()
    profiles = ElementTree.fromstring(
        template[template.index("<profiles>") : template.index("</profiles>") + 11]
    )
    inherited: list[ElementTree.Element] = []
    name: str | None = _STORE_MODULE.local("users")["reader"]["profile"]
    while name is not None:
        profile = profiles.find(name)
        assert profile is not None, f"users.xml has no profile {name}"
        inherited.insert(0, profile)
        name = profile.findtext("profile")
    fixed = {setting.tag for profile in inherited for setting in profile.findall("constraints/*")}
    values = {
        setting.tag: setting.text
        for profile in inherited
        for setting in profile
        if setting.tag not in ("profile", "constraints")
    }
    settings = [f"{name} = {value}{' CONST' if name in fixed else ''}" for name, value in values.items()]
    settings += [f"{name} CONST" for name in sorted(fixed - values.keys())]
    return f"CREATE SETTINGS PROFILE {_READER_PROFILE} SETTINGS {', '.join(settings)}"


def _rendered_databases(row_filters: dict[str, str]) -> ElementTree.Element:
    """A user's ``<databases>`` as users.xml.tftpl renders it for these row filters. Its one
    directive, the loop over the filters, is unrolled as OpenTofu unrolls it, without escaping;
    the rest of the block is markup."""
    template = _USERS_XML.read_text()
    block = template[template.index("<databases>") : template.index("</databases>") + len("</databases>")]
    head, rest = block.split("%{ for table, filter in user.row_filters ~}")
    body, tail = rest.split("%{ endfor ~}")
    tables = "".join(
        body.replace("${table}", table).replace("${filter}", row_filter)
        for table, row_filter in row_filters.items()
    )
    rendered = head + tables + tail
    assert "${" not in rendered and "%{" not in rendered, rendered
    return ElementTree.fromstring(rendered)


class _User:
    """One user's view of a real store."""

    def __init__(self, url: str, user: str, password: str):
        self.url = url
        self.headers = {"X-ClickHouse-User": user, "X-ClickHouse-Key": password}

    def run(
        self,
        sql: str,
        database: str | None = None,
        settings: dict[str, str] | None = None,
        **parameters: str,
    ) -> requests.Response:
        params = {"database": database} if database else {}
        params.update(settings or {})
        params.update({f"param_{name}": value for name, value in parameters.items()})
        return requests.post(self.url, params=params, data=sql.encode(), headers=self.headers, timeout=60)

    def ok(
        self,
        sql: str,
        database: str | None = None,
        settings: dict[str, str] | None = None,
        **parameters: str,
    ) -> str:
        response = self.run(sql, database, settings, **parameters)
        assert response.ok, response.text
        return response.text

    def rows(self, sql: str, settings: dict[str, str] | None = None, **parameters: str) -> list[dict]:
        text = self.ok(f"{sql} FORMAT JSONEachRow", settings=settings, **parameters)
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture
def admin(store_admin: tuple[str, str, str], store_migrations: list[str]) -> Iterator[_User]:
    admin = _User(*store_admin)
    policy_tables = ", ".join(f"{_DATABASE}.{table}" for table in _READER_TABLES)
    admin.ok(f"DROP ROW POLICY IF EXISTS {_READER_POLICY} ON {policy_tables}")
    admin.ok(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    admin.ok(f"DROP USER IF EXISTS {_READER}")
    admin.ok(f"DROP SETTINGS PROFILE IF EXISTS {_READER_PROFILE}")
    admin.ok(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        admin.ok(statement, database=_DATABASE)
    admin.ok(_reader_profile())
    admin.ok(f"CREATE USER {_READER} IDENTIFIED BY 'views-test' SETTINGS PROFILE '{_READER_PROFILE}'")
    for granted in (*_READER_VIEWS, *_READER_TABLES):
        admin.ok(f"GRANT SELECT ON {_DATABASE}.{granted} TO {_READER}")
    admin.ok(f"CREATE ROW POLICY {_READER_POLICY} ON {policy_tables} USING {_READER_ROW_FILTER} TO {_READER}")

    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, user_id, client_id, {_COMMIT}) VALUES "
        "('e1', 1, '2026-10-19 10:00:00', 'u1', 'c1', 3, '2026-10-19 10:00:01'), "
        "('e1', 2, '2026-10-19 11:00:00', 'u2', 'c1', 3, '2026-10-19 11:00:01'), "
        "('e2', 3, '2026-10-19 12:00:00', 'u3', 'c3', 3, '2026-10-19 12:00:01')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.macro_results (experiment_id, id, raw_id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 11, 1, '2026-10-19 10:00:00', 'u4', 'c4', 4, '2026-10-19 10:00:05'), "
        "('e2', 13, 3, '2026-10-19 12:00:00', 'u3', 'c3', 4, '2026-10-19 12:00:05')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.uploads (experiment_id, id, uploaded_at, created_by, {_COMMIT}) "
        "VALUES ('e1', 21, '2026-10-19 09:00:00', 'u5', 5, '2026-10-19 09:00:01'), "
        "('e2', 23, '2026-10-19 12:00:00', 'u3', 5, '2026-10-19 12:00:01')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.device_events (client_id, event_type, event_timestamp, session_identifier, {_COMMIT}) "
        "VALUES ('c1', 'connected', '2026-10-19 09:30:00', 's1', 6, '2026-10-19 09:30:01'), "
        "('c1', 'disconnected', '2026-10-19 12:30:00', 's1', 6, '2026-10-19 12:30:01'), "
        "('c9', 'connected', '2026-10-19 08:00:00', 's9', 6, '2026-10-19 08:00:01')"
    )

    yield admin

    admin.ok(f"DROP ROW POLICY {_READER_POLICY} ON {policy_tables}")
    admin.ok(f"DROP USER {_READER}")
    admin.ok(f"DROP SETTINGS PROFILE {_READER_PROFILE}")
    admin.ok(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def reader(admin: _User) -> _User:
    return _User(admin.url, _READER, "views-test")


@pytest.fixture
def writer(admin: _User, store_admin: tuple[str, str, str]) -> StoreWriter:
    """The feed's writer, which settles the device copy after each insert."""
    return StoreWriter(*store_admin, database=_DATABASE)


def _send(writer: StoreWriter, rows: list[dict]) -> None:
    """``rows`` of measurements, each with its ``_commit_version``, in one insert, as the feed sends a
    chunk."""
    lines = [json.dumps({"_commit_timestamp": "2026-10-19 23:00:00", **row}) for row in rows]
    assert writer.insert("measurements", lines).inserted == len(lines)


def test_the_test_stores_reader_has_the_access_the_module_gives_the_reader() -> None:
    test_reader = json.loads(_TEST_READER.read_text())
    module_reader = _STORE_MODULE.local("users")["reader"]

    granted = [*test_reader["views"], *test_reader["tables"]]
    assert sorted(module_reader["grants"]) == sorted(f"GRANT SELECT ON store.{name}" for name in granted)
    assert module_reader.get("row_filters", {}) == dict.fromkeys(
        test_reader["tables"], test_reader["rowFilter"]
    )
    profile = _reader_profile().split(f"{_READER_PROFILE} SETTINGS ", 1)[1].split(", ")
    assert sorted(test_reader["settings"]) == sorted(profile)


def test_the_shipped_users_xml_keeps_each_reader_table_to_the_row_filter() -> None:
    template = _USERS_XML.read_text()
    row_filters = _STORE_MODULE.local("users")["reader"]["row_filters"]

    [store] = list(_rendered_databases(row_filters))

    # The block is each user's own, inside the loop that writes the users.
    user = template.index("<${user.name}>")
    assert user < template.index("<databases>") < template.index("</${user.name}>")
    assert store.tag == "store"
    assert {table.tag: table.findtext("filter") for table in store} == dict.fromkeys(
        _READER_TABLES, _READER_ROW_FILTER
    )


def test_the_reader_reads_one_experiments_rows_through_each_view_without_the_setting(reader: _User) -> None:
    measurements = reader.rows(
        f"SELECT id FROM {_DATABASE}.experiment_measurements(experiment = {{experiment:String}}) ORDER BY id",
        experiment="e1",
    )
    macro_results = reader.rows(f"SELECT id FROM {_DATABASE}.experiment_macro_results(experiment = 'e1')")
    uploads = reader.rows(f"SELECT id FROM {_DATABASE}.experiment_uploads(experiment = 'e1')")

    assert [int(row["id"]) for row in measurements] == [1, 2]
    assert [int(row["id"]) for row in macro_results] == [11]
    assert [int(row["id"]) for row in uploads] == [21]


@pytest.mark.parametrize("table", _READER_TABLES)
def test_the_reader_cannot_read_a_table_without_naming_an_experiment(reader: _User, table: str) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.{table}")

    # UNKNOWN_SETTING: the row policy reads the setting, which the read never set.
    assert response.headers.get("X-ClickHouse-Exception-Code") == "115"


@pytest.mark.parametrize("table", _READER_TABLES)
def test_the_reader_reads_a_table_only_for_the_experiment_its_setting_names(
    reader: _User, table: str
) -> None:
    setting = {_EXPERIMENT_SETTING: "e1"}

    named = reader.rows(f"SELECT id FROM {_DATABASE}.{table} FINAL ORDER BY id", settings=setting)
    other = reader.rows(
        f"SELECT id FROM {_DATABASE}.{table} FINAL WHERE experiment_id = 'e2'", settings=setting
    )

    assert [int(row["id"]) for row in named] == _E1_IDS[table]
    assert other == []


@pytest.mark.parametrize(
    "table",
    ["contributor_ids", "client_ids", "payload_schemas", "measurements_by_device", "device_events"],
)
def test_the_reader_cannot_read_a_table_the_module_does_not_grant(reader: _User, table: str) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.{table}", settings={_EXPERIMENT_SETTING: "e1"})

    assert response.headers.get("X-ClickHouse-Exception-Code") == "497"


def test_a_view_refuses_a_read_that_names_no_experiment(reader: _User) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.experiment_measurements")

    assert not response.ok
    assert "experiment" in response.text


@pytest.mark.parametrize(
    "view",
    [
        "device_measurements",
        "device_experiment_ids",
        "device_newest_measurements",
        "device_lifecycle_events",
        "device_last_activity",
    ],
)
def test_a_device_view_refuses_a_read_that_names_no_device(reader: _User, view: str) -> None:
    response = reader.run(f"SELECT * FROM {_DATABASE}.{view}")

    assert not response.ok
    assert "device" in response.text


@pytest.mark.parametrize(
    "setting",
    [
        "max_memory_usage = 0",
        "max_execution_time = 0",
        "max_memory_usage_for_user = 0",
        "timeout_overflow_mode = 'break'",
        "apply_deleted_mask = 0",
        "workload = 'metrics_refreshes'",
    ],
)
def test_the_reader_cannot_lift_its_limits_or_see_deleted_rows(reader: _User, setting: str) -> None:
    response = reader.run(
        f"SELECT count() FROM {_DATABASE}.experiment_measurements(experiment = 'e1') SETTINGS {setting}"
    )

    assert response.headers.get("X-ClickHouse-Exception-Code") == "452"


def test_an_experiments_ids_come_from_every_table_that_names_them(reader: _User) -> None:
    contributors = reader.rows(
        f"SELECT user_id FROM {_DATABASE}.experiment_contributor_ids(experiment = 'e1')"
    )
    clients = reader.rows(f"SELECT client_id FROM {_DATABASE}.experiment_client_ids(experiment = 'e1')")

    assert sorted(row["user_id"] for row in contributors) == ["u1", "u2", "u4", "u5"]
    assert sorted(row["client_id"] for row in clients) == ["c1", "c4"]


def test_rows_sent_again_add_no_ids(admin: _User, reader: _User) -> None:
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 1, '2026-10-19 10:00:00', 'u1', 'c1', 3, '2026-10-19 10:00:01')"
    )

    # The view reads distinct ids, so the table itself shows whether it folded the repeat.
    [stored] = admin.rows(
        f"SELECT count() AS ids FROM {_DATABASE}.contributor_ids FINAL WHERE experiment_id = 'e1'"
    )

    assert int(stored["ids"]) == 4


def test_a_row_without_a_contributor_or_a_client_adds_no_id(admin: _User, reader: _User) -> None:
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 4, '2026-10-19 13:00:00', NULL, NULL, 3, '2026-10-19 13:00:01')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.macro_results (experiment_id, id, raw_id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 12, 4, '2026-10-19 13:00:00', NULL, NULL, 4, '2026-10-19 13:00:05')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.uploads (experiment_id, id, uploaded_at, created_by, {_COMMIT}) "
        "VALUES ('e1', 22, '2026-10-19 13:00:00', NULL, 5, '2026-10-19 13:00:01')"
    )

    contributors = reader.rows(
        f"SELECT user_id FROM {_DATABASE}.experiment_contributor_ids(experiment = 'e1')"
    )
    clients = reader.rows(f"SELECT client_id FROM {_DATABASE}.experiment_client_ids(experiment = 'e1')")

    assert sorted(row["user_id"] for row in contributors) == ["u1", "u2", "u4", "u5"]
    assert sorted(row["client_id"] for row in clients) == ["c1", "c4"]


def test_a_tables_schemas_read_once_each_at_their_newest_commit(admin: _User, reader: _User) -> None:
    for version in (3, 4):
        admin.ok(
            f"INSERT INTO {_DATABASE}.payload_schemas VALUES "
            f"('e1', 'upload', 't1', 'uploaded_data', 'OBJECT<ph: DOUBLE>', {version}), "
            f"('e1', 'upload', 't1', 'uploaded_data', 'OBJECT<plot: STRING>', {version}), "
            f"('e2', 'upload', 't9', 'uploaded_data', 'OBJECT<x: BIGINT>', {version})"
        )

    schemas = reader.rows(
        f"SELECT * FROM {_DATABASE}.experiment_payload_schemas(experiment = 'e1') ORDER BY schema"
    )

    assert schemas == [
        {
            "table_type": "upload",
            "identifier": "t1",
            "payload": "uploaded_data",
            "schema": "OBJECT<ph: DOUBLE>",
        },
        {
            "table_type": "upload",
            "identifier": "t1",
            "payload": "uploaded_data",
            "schema": "OBJECT<plot: STRING>",
        },
    ]
    # The view leaves the version out, so the table shows which commit each schema kept.
    stored = admin.rows(
        f"SELECT DISTINCT _commit_version FROM {_DATABASE}.payload_schemas FINAL WHERE experiment_id = 'e1'"
    )
    assert [int(row["_commit_version"]) for row in stored] == [4]


def test_a_row_sent_again_reads_once_at_its_newest_commit_before_any_merge(
    admin: _User, reader: _User
) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.measurements")
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 1, '2026-10-19 10:00:00', 'u1', 'c1', 4, '2026-10-19 10:00:09')"
    )

    rows = reader.rows(
        f"SELECT id, _commit_version FROM {_DATABASE}.experiment_measurements(experiment = 'e1') ORDER BY id"
    )

    assert [(int(row["id"]), int(row["_commit_version"])) for row in rows] == [(1, 4), (2, 3)]


def test_a_sheet_row_reads_at_its_newest_commit_and_not_once_an_edit_or_deletion_removed_it(
    admin: _User, reader: _User
) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.metadata_rows")
    columns = (
        f"experiment_id, sheet_id, sheet_created_at, match_on, identifier, fields, is_deleted, {_COMMIT}"
    )
    sheet = "'e1', 's1', '2026-10-19 08:00:00', 'q1'"
    admin.ok(
        f"INSERT INTO {_DATABASE}.metadata_rows ({columns}) VALUES "
        f"({sheet}, 'plot-1', '{{\"soil\":\"clay\"}}', 0, 1, '2026-10-19 08:01:00'), "
        f"({sheet}, 'plot-2', '{{\"soil\":\"sand\"}}', 0, 1, '2026-10-19 08:01:00'), "
        f"({sheet}, 'plot-1', '{{\"soil\":\"loam\"}}', 0, 2, '2026-10-19 08:02:00'), "
        f"({sheet}, 'plot-2', '{{\"soil\":\"sand\"}}', 1, 2, '2026-10-19 08:02:00')"
    )

    rows = reader.rows(
        f"SELECT identifier, fields FROM {_DATABASE}.experiment_metadata_rows(experiment = 'e1')"
    )

    assert rows == [{"identifier": "plot-1", "fields": '{"soil":"loam"}'}]


def test_a_sheet_reads_its_newest_schema_and_not_once_deleted(admin: _User, reader: _User) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.metadata_sheets")
    columns = "experiment_id, sheet_id, sheet_created_at, match_on, schema, is_deleted, _commit_version"
    admin.ok(
        f"INSERT INTO {_DATABASE}.metadata_sheets ({columns}) VALUES "
        "('e1', 's1', '2026-10-19 08:00:00', 'q1', 'OBJECT<soil: STRING>', 0, 1), "
        "('e1', 's1', '2026-10-19 08:00:00', 'q1', 'OBJECT<area: DECIMAL(2,1), soil: STRING>', 0, 2), "
        "('e1', 's2', '2026-10-19 09:00:00', 'q1', 'OBJECT<ph: BIGINT>', 0, 3), "
        "('e1', 's2', '2026-10-19 09:00:00', 'q1', NULL, 1, 4), "
        "('e2', 's3', '2026-10-19 10:00:00', 'q1', 'OBJECT<ph: BIGINT>', 0, 5)"
    )

    rows = reader.rows(
        f"SELECT sheet_id, schema, _commit_version FROM {_DATABASE}.experiment_metadata_sheets(experiment = 'e1')"
    )

    assert [(row["sheet_id"], row["schema"], int(row["_commit_version"])) for row in rows] == [
        ("s1", "OBJECT<area: DECIMAL(2,1), soil: STRING>", 2)
    ]


def test_the_reader_reads_the_sheet_rows_only_through_their_view(reader: _User) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.metadata_rows")

    assert response.headers.get("X-ClickHouse-Exception-Code") == "497"


def test_the_reader_reads_devices_rows_across_experiments_through_the_device_views(reader: _User) -> None:
    measurements = reader.rows(
        f"SELECT experiment_id, id FROM {_DATABASE}.device_measurements(devices = {{devices:Array(String)}}, "
        f"{_WINDOW}) ORDER BY id",
        devices="['c1', 'c3']",
    )
    events = reader.rows(
        f"SELECT client_id, event_type FROM {_DATABASE}.device_lifecycle_events(devices = ['c1']) "
        "ORDER BY event_timestamp"
    )

    assert [(row["experiment_id"], int(row["id"])) for row in measurements] == [
        ("e1", 1),
        ("e1", 2),
        ("e2", 3),
    ]
    assert events == [
        {"client_id": "c1", "event_type": "connected"},
        {"client_id": "c1", "event_type": "disconnected"},
    ]


def test_a_devices_experiment_ids_are_those_its_rows_in_the_window_name(admin: _User, reader: _User) -> None:
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, {_COMMIT}) VALUES "
        "('e3', 7, '2026-10-19 13:00:00', 'c1', 3, '2026-10-19 13:00:01'), "
        "('e4', 8, '2026-10-20 09:00:00', 'c1', 3, '2026-10-20 09:00:01')"
    )

    rows = reader.rows(
        f"SELECT experiment_id FROM {_DATABASE}.device_experiment_ids(devices = ['c1'], {_WINDOW}) "
        "ORDER BY experiment_id"
    )

    assert [row["experiment_id"] for row in rows] == ["e1", "e3"]


def test_device_reads_are_ready_once_measurements_and_device_events_have_both_reloaded(
    admin: _User, reader: _User
) -> None:
    readiness = f"SELECT reloaded FROM {_DATABASE}.device_events_reloaded"
    # A reload-formatted event, which no longer says the events were reloaded.
    admin.ok(
        f"INSERT INTO {_DATABASE}.device_events (client_id, event_type, event_timestamp, {_COMMIT}, inserted_at) "
        "VALUES ('c2', 'connected', '2026-10-19 08:00:00', 4, '2026-10-19 08:00:01', '2026-10-19 08:00:01')"
    )
    admin.ok(f"INSERT INTO {_DATABASE}.completed_reloads (table_name, version) VALUES ('device_events', 4)")
    waiting = reader.rows(readiness)
    admin.ok(f"INSERT INTO {_DATABASE}.completed_reloads (table_name, version) VALUES ('measurements', 3)")

    assert (waiting, reader.rows(readiness)) == ([], [{"reloaded": 1}])


def test_a_devices_newest_rows_in_a_window_read_with_their_payload(admin: _User, reader: _User) -> None:
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, data, {_COMMIT}) VALUES "
        "('e2', 5, '2026-10-19 13:00:00', 'c1', '{\"par\": 120}', 3, '2026-10-19 13:00:01'), "
        "('e1', 6, '2026-10-19 14:00:00', 'c1', '{\"par\": 130}', 3, '2026-10-19 14:00:01'), "
        "('e1', 7, '2026-10-20 09:00:00', 'c1', '{\"par\": 140}', 3, '2026-10-20 09:00:01')"
    )

    rows = reader.rows(
        f"SELECT experiment_id, id, data FROM {_DATABASE}.device_newest_measurements(device = 'c1', "
        "experiments = ['e1', 'e2'], from = '2026-10-19 00:00:00', to = '2026-10-19 23:59:59', rows = 2) "
        "ORDER BY timestamp DESC"
    )

    assert [(row["experiment_id"], int(row["id"]), row["data"]) for row in rows] == [
        ("e1", 6, '{"par": 130}'),
        ("e2", 5, '{"par": 120}'),
    ]


def _newest(reader: _User, device: str, columns: str, rows: int) -> list[dict]:
    return reader.rows(
        f"SELECT {columns} FROM {_DATABASE}.device_newest_measurements(device = {{device:String}}, "
        f"experiments = ['e1', 'e2'], from = '2026-10-19 00:00:00', to = '2026-10-19 23:59:59', rows = {rows}) "
        "ORDER BY timestamp DESC, id DESC",
        device=device,
    )


def test_a_capture_sent_again_through_another_client_shows_its_payload_and_position_only_to_that_client(
    reader: _User, writer: StoreWriter
) -> None:
    capture = {"experiment_id": "e1", "id": 6, "timestamp": "2026-10-19 14:00:00"}
    _send(
        writer,
        [
            {
                **capture,
                "client_id": "c1",
                "latitude": 52.1,
                "longitude": 5.1,
                "data": '{"par": 130}',
                "_commit_version": 3,
            }
        ],
    )
    _send(
        writer,
        [
            {
                **capture,
                "client_id": "c2",
                "latitude": 48.2,
                "longitude": 16.4,
                "data": '{"par": 131}',
                "_commit_version": 4,
            }
        ],
    )

    readings = "id, latitude, longitude, data"

    first = _newest(reader, "c1", readings, 3)
    second = _newest(reader, "c2", readings, 3)

    assert [(int(row["id"]), row["latitude"], row["longitude"], row["data"]) for row in first] == [
        (2, None, None, None),
        (1, None, None, None),
    ]
    assert [(int(row["id"]), row["latitude"], row["longitude"], row["data"]) for row in second] == [
        (6, 48.2, 16.4, '{"par": 131}')
    ]


def _sent_again(admin: _User, writer: StoreWriter, captures: str) -> None:
    """c1's captures from ``captures``, a SELECT of experiment_id, id and timestamp, then the same
    captures sent again through c2 at a newer commit."""
    rows = [
        {"experiment_id": row["experiment_id"], "id": int(row["id"]), "timestamp": row["timestamp"]}
        for row in admin.rows(f"SELECT experiment_id, id, timestamp FROM ({captures})")
    ]
    for client, version in (("c1", 3), ("c2", 4)):
        _send(writer, [{**row, "client_id": client, "_commit_version": version} for row in rows])


def _counts(reader: _User, device: str) -> list[tuple[str, int]]:
    rows = reader.rows(
        f"SELECT experiment_id, count() AS n FROM {_DATABASE}.device_measurements(devices = [{{device:String}}], "
        f"{_WINDOW}) GROUP BY experiment_id ORDER BY experiment_id",
        device=device,
    )
    return [(row["experiment_id"], int(row["n"])) for row in rows]


def _last_data(reader: _User, device: str) -> str | None:
    [row] = reader.rows(
        f"SELECT last_data_at FROM {_DATABASE}.device_last_activity(devices = [{{device:String}}], "
        "experiments = ['e1', 'e2'])",
        device=device,
    )
    return row["last_data_at"]


def test_a_capture_sent_again_through_another_client_counts_only_for_that_client(
    admin: _User, reader: _User, writer: StoreWriter
) -> None:
    _sent_again(
        admin,
        writer,
        "SELECT 'e1' AS experiment_id, 6 AS id, toDateTime64('2026-10-19 14:00:00', 6, 'UTC') AS timestamp",
    )

    assert (_counts(reader, "c1"), _counts(reader, "c2")) == ([("e1", 2)], [("e1", 1)])
    assert (_last_data(reader, "c1"), _last_data(reader, "c2")) == (
        "2026-10-19 11:00:00.000000",
        "2026-10-19 14:00:00.000000",
    )
    assert [int(row["id"]) for row in _newest(reader, "c1", "id", 1)] == [2]
    assert [int(row["id"]) for row in _newest(reader, "c1", "id", 2)] == [2, 1]
    assert [int(row["id"]) for row in _newest(reader, "c2", "id", 2)] == [6]


def test_last_activity_looks_past_a_devices_newest_copies_when_another_client_sent_them_all_again(
    admin: _User, reader: _User, writer: StoreWriter
) -> None:
    _sent_again(
        admin,
        writer,
        "SELECT 'e2' AS experiment_id, 100 + number AS id, "
        "toDateTime64('2026-10-19 15:00:00', 6, 'UTC') + toIntervalSecond(number) AS timestamp FROM numbers(1000)",
    )

    assert (_last_data(reader, "c1"), _last_data(reader, "c2")) == (
        "2026-10-19 11:00:00.000000",
        "2026-10-19 15:16:39.000000",
    )


# Captures that arrive again, each insert one row as the feed sends them: (id, client, version).
_ARRIVALS = [
    (601, "c11", 3),
    (601, "c12", 4),  # sent again through another client, at a newer version
    (602, "c13", 5),
    (602, "c14", 4),  # an older copy arriving after the newer one, as a reload can send it
    (603, "c15", 3),
    (603, None, 4),  # won by a copy without a client
    (604, "c16", 3),
    (604, "c16", 4),  # sent again through the same client
    (605, "c17", 5),
    (605, "c18", 5),  # a tie, which measurements gives the row inserted last
    (606, "c19", 3),
    (606, "c20", 4),
    (606, "c19", 5),  # back through the first client
    (607, "c21", 1),
    (607, "c22", 3),
    (607, "c22", 2),  # the winner's older copy sent again
    (608, "c23", 5),
    (608, "c24", 40),  # a reload
    (608, "c24", 7),  # then the feed catching up on the reloaded copy's own commit
    (609, None, 3),
    (609, "c25", 2),  # an older copy after a winner without a client
]


def test_device_reads_keep_the_rows_measurements_keeps_however_a_capture_arrives_again(
    admin: _User, reader: _User, writer: StoreWriter
) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.measurements")
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.measurements_by_device")
    for capture, client, version in _ARRIVALS:
        _send(
            writer,
            [
                {
                    "experiment_id": "e1",
                    "id": capture,
                    "timestamp": "2026-10-19 16:00:00",
                    "client_id": client,
                    "_commit_version": version,
                }
            ],
        )
    clients = sorted({client for _, client, _ in _ARRIVALS if client is not None})

    kept = admin.rows(
        f"SELECT id, client_id FROM {_DATABASE}.measurements FINAL WHERE id > 600 AND client_id IS NOT NULL "
        "ORDER BY id"
    )
    read = reader.rows(
        f"SELECT id, client_id FROM {_DATABASE}.device_measurements(devices = {{devices:Array(String)}}, "
        f"{_WINDOW}) WHERE id > 600 ORDER BY id",
        devices=str(clients),
    )

    assert [(int(row["id"]), row["client_id"]) for row in read] == [
        (601, "c12"),
        (602, "c13"),
        (604, "c16"),
        (605, "c18"),
        (606, "c19"),
        (607, "c22"),
        (608, "c24"),
    ]
    assert read == kept


# Two writers' copies of the same captures: (client, version, battery, firmware) each.
_RACES = {
    "second-newer": (("c30", 3, None, "1.0"), ("c31", 4, None, "1.0")),
    "first-newer": (("c30", 4, None, "1.0"), ("c31", 3, None, "1.0")),
    "tie": (("c30", 4, None, "1.0"), ("c31", 4, None, "1.0")),
    # The feed's copy and a reload's, of one client at one version, the reload's filled from silver.
    "same-client-tie": (("c30", 4, None, "1.0"), ("c30", 4, 82.0, "2.0")),
}


@pytest.mark.parametrize("race", list(_RACES.values()), ids=list(_RACES))
def test_writers_sending_the_same_captures_at_once_leave_the_device_copy_as_measurements_keeps_them(
    admin: _User,
    reader: _User,
    store_admin: tuple[str, str, str],
    race: tuple[tuple[str, int, float | None, str], ...],
) -> None:
    captures = [
        {"experiment_id": "e1", "id": 2000 + i, "timestamp": "2026-10-19 17:00:00"} for i in range(5000)
    ]
    together = threading.Barrier(len(race))

    def send(client: str, version: int, battery: float | None, firmware: str) -> None:
        writer = StoreWriter(*store_admin, database=_DATABASE)
        copies = [
            {
                **capture,
                "client_id": client,
                "device_battery": battery,
                "device_firmware": firmware,
                "_commit_version": version,
            }
            for capture in captures
        ]
        together.wait()
        _send(writer, copies)

    with ThreadPoolExecutor(len(race)) as pool:
        for sent in [pool.submit(send, *copy) for copy in race]:
            sent.result()

    columns = "id, client_id, device_battery, device_firmware"
    kept = admin.rows(f"SELECT {columns} FROM {_DATABASE}.measurements FINAL WHERE id >= 2000 ORDER BY id")
    read = reader.rows(
        f"SELECT {columns} FROM {_DATABASE}.device_measurements(devices = ['c30', 'c31'], {_WINDOW}) "
        "WHERE id >= 2000 ORDER BY id"
    )

    assert len(read) == 5000
    assert read == kept


@pytest.mark.parametrize("second_version", [4, 5], ids=["tie", "newer"])
def test_an_older_settle_that_finishes_last_leaves_the_device_copy_as_measurements_keeps_it(
    admin: _User,
    reader: _User,
    store_admin: tuple[str, str, str],
    monkeypatch: pytest.MonkeyPatch,
    second_version: int,
) -> None:
    capture = {"experiment_id": "e1", "id": 3000, "timestamp": "2026-10-19 18:00:00"}
    first = [json.dumps({**capture, "client_id": "c30", "device_battery": 10.0, "_commit_version": 4})]
    second = [
        json.dumps({**capture, "client_id": "c31", "device_battery": 20.0, "_commit_version": second_version})
    ]
    # c30's settle reads the store, then holds its rows two seconds before writing them.
    held = Settle(
        MEASUREMENTS.settle.statement.replace("{{stamp:UInt64}}", "{{stamp:UInt64}} + sleep(2)"),
        MEASUREMENTS.settle.structure,
    )
    assert held.statement != MEASUREMENTS.settle.statement

    monkeypatch.setattr(writer_module, "SETTLES", {})
    StoreWriter(*store_admin, database=_DATABASE).insert("measurements", first)
    monkeypatch.undo()
    with ThreadPoolExecutor(1) as pool:
        older = pool.submit(StoreWriter(*store_admin, database=_DATABASE)._settle, held, first)
        threading.Event().wait(0.5)
        # c31's copy lands and settles while c30's settle still holds what it read before it.
        StoreWriter(*store_admin, database=_DATABASE).insert("measurements", second)
        older.result()

    columns = "id, client_id, device_battery"
    kept = admin.rows(f"SELECT {columns} FROM {_DATABASE}.measurements FINAL WHERE id = 3000")
    read = reader.rows(
        f"SELECT {columns} FROM {_DATABASE}.device_measurements(devices = ['c30', 'c31'], {_WINDOW}) "
        "WHERE id = 3000"
    )

    assert kept == [{"id": 3000, "client_id": "c31", "device_battery": 20.0}]
    assert read == kept


def test_last_activity_of_several_devices_settles_each_only_by_its_own_newest_copies(
    reader: _User, writer: StoreWriter
) -> None:
    capture = {"experiment_id": "e1", "id": 500, "timestamp": "2026-10-19 09:00:00"}
    # c5's capture, which c6 then sent again and won, and c6's own older capture.
    _send(writer, [{**capture, "client_id": "c5", "_commit_version": 3}])
    _send(
        writer,
        [
            {**capture, "client_id": "c6", "_commit_version": 4},
            {
                "experiment_id": "e1",
                "id": 501,
                "timestamp": "2026-10-19 09:00:01",
                "client_id": "c6",
                "_commit_version": 3,
            },
        ],
    )
    # c6's 1,000 newest captures, every one of which c7 then sent again.
    for client, version in (("c6", 3), ("c7", 4)):
        _send(
            writer,
            [
                {
                    "experiment_id": "e2",
                    "id": 1000 + second,
                    "timestamp": f"2026-10-19 10:{second // 60:02d}:{second % 60:02d}",
                    "client_id": client,
                    "_commit_version": version,
                }
                for second in range(1000)
            ],
        )

    rows = reader.rows(
        f"SELECT client_id, last_data_at FROM {_DATABASE}.device_last_activity(devices = ['c5', 'c6'], "
        "experiments = ['e1', 'e2']) ORDER BY client_id"
    )

    assert _last_data(reader, "c6") == "2026-10-19 09:00:01.000000"
    assert rows == [{"client_id": "c6", "last_data_at": "2026-10-19 09:00:01.000000"}]


def test_a_devices_newest_rows_cut_rows_that_tie_on_time_by_id(admin: _User, reader: _User) -> None:
    for part in range(3):
        admin.ok(
            f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, {_COMMIT}) "
            "SELECT 'e1', 100 + number, toDateTime64('2026-10-19 15:00:00', 6, 'UTC'), 'c1', 3, "
            f"'2026-10-19 15:00:01' FROM numbers(60) WHERE number % 3 = {part}"
        )

    rows = _newest(reader, "c1", "id", 5)

    assert [int(row["id"]) for row in rows] == [159, 158, 157, 156, 155]


@pytest.mark.parametrize("column", ["user_id", "questions_data", "annotations", "client_model"])
def test_a_devices_newest_rows_carry_only_what_a_device_page_shows(reader: _User, column: str) -> None:
    response = reader.run(
        f"SELECT {column} FROM {_DATABASE}.device_newest_measurements(device = 'c1', "
        "experiments = ['e1'], from = '2026-10-19 00:00:00', to = '2026-10-19 23:59:59', rows = 2)"
    )

    assert response.headers.get("X-ClickHouse-Exception-Code") == "47"


def test_last_activity_is_each_devices_newest_row_and_newest_event(reader: _User) -> None:
    rows = reader.rows(
        f"SELECT * FROM {_DATABASE}.device_last_activity(devices = ['c1', 'c3', 'c9', 'c0'], "
        "experiments = ['e1', 'e2']) ORDER BY client_id"
    )

    assert rows == [
        {
            "client_id": "c1",
            "last_data_at": "2026-10-19 11:00:00.000000",
            "last_event_type": "disconnected",
            "last_event_at": "2026-10-19 12:30:00.000000",
        },
        {
            "client_id": "c3",
            "last_data_at": "2026-10-19 12:00:00.000000",
            "last_event_type": None,
            "last_event_at": None,
        },
        {
            "client_id": "c9",
            "last_data_at": None,
            "last_event_type": "connected",
            "last_event_at": "2026-10-19 08:00:00.000000",
        },
    ]


def test_last_activity_dates_data_by_the_named_experiments_rows_alone(reader: _User) -> None:
    rows = reader.rows(
        f"SELECT client_id, last_data_at, last_event_at FROM {_DATABASE}.device_last_activity("
        "devices = ['c1', 'c3'], experiments = ['e2']) ORDER BY client_id"
    )

    assert rows == [
        {"client_id": "c1", "last_data_at": None, "last_event_at": "2026-10-19 12:30:00.000000"},
        {"client_id": "c3", "last_data_at": "2026-10-19 12:00:00.000000", "last_event_at": None},
    ]


def test_a_devices_row_or_event_sent_again_reads_once_at_its_newest_commit_before_any_merge(
    admin: _User, reader: _User
) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.measurements")
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.measurements_by_device")
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.device_events")
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, device_battery, {_COMMIT}) "
        "VALUES ('e1', 1, '2026-10-19 10:00:00', 'c1', 41.5, 4, '2026-10-19 10:00:09')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.device_events (client_id, event_type, event_timestamp, session_identifier, "
        f"disconnect_reason, {_COMMIT}) VALUES "
        "('c1', 'disconnected', '2026-10-19 12:30:00', 's1', 'CLIENT_INITIATED_DISCONNECT', 7, '2026-10-19 12:30:09')"
    )

    measurements = reader.rows(
        f"SELECT id, device_battery, _commit_version FROM {_DATABASE}.device_measurements(devices = ['c1'], "
        f"{_WINDOW}) ORDER BY id"
    )
    events = reader.rows(
        f"SELECT event_type, disconnect_reason, _commit_version FROM {_DATABASE}.device_lifecycle_events("
        "devices = ['c1']) ORDER BY event_timestamp"
    )

    assert [(int(row["id"]), row["device_battery"], int(row["_commit_version"])) for row in measurements] == [
        (1, 41.5, 4),
        (2, None, 3),
    ]
    assert [(row["event_type"], row["disconnect_reason"], int(row["_commit_version"])) for row in events] == [
        ("connected", None, 6),
        ("disconnected", "CLIENT_INITIATED_DISCONNECT", 7),
    ]


def test_a_row_without_a_client_reaches_no_device(admin: _User) -> None:
    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, {_COMMIT}) "
        "VALUES ('e1', 8, '2026-10-19 15:00:00', NULL, 3, '2026-10-19 15:00:01')"
    )

    assert admin.rows(f"SELECT id FROM {_DATABASE}.measurements_by_device WHERE id = 8") == []


def test_the_device_copy_starts_with_the_rows_measurements_held_before_it(
    store_admin: tuple[str, str, str], store_migration_files: dict[str, list[str]]
) -> None:
    store = _User(*store_admin)
    database = f"{_DATABASE}_before_devices"
    store.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    store.ok(f"CREATE DATABASE {database}")
    try:
        for name, statements in store_migration_files.items():
            if name < _DEVICE_MIGRATION:
                for statement in statements:
                    store.ok(statement, database=database)
        store.ok(
            f"INSERT INTO {database}.measurements (experiment_id, id, timestamp, client_id, device_battery, "
            f"{_COMMIT}) VALUES "
            "('e1', 1, '2026-10-19 10:00:00', 'c1', 80, 3, '2026-10-19 10:00:01'), "
            "('e1', 2, '2026-10-19 11:00:00', NULL, 70, 3, '2026-10-19 11:00:01')"
        )
        store.ok(
            f"INSERT INTO {database}.measurements (experiment_id, id, timestamp, client_id, device_battery, "
            f"{_COMMIT}) VALUES ('e1', 1, '2026-10-19 10:00:00', 'c1', 81, 4, '2026-10-19 10:00:09')"
        )
        store.ok(
            f"INSERT INTO {database}.measurements (experiment_id, id, timestamp, client_id, {_COMMIT}) "
            "SELECT 'months', number, toDateTime64('1900-01-01 00:00:00', 6, 'UTC') + toIntervalMonth(number), "
            "'c2', 3, '2026-10-19 10:00:01' FROM numbers(101) "
            "SETTINGS throw_on_max_partitions_per_insert_block = 0"
        )

        for statement in store_migration_files[_DEVICE_MIGRATION]:
            store.ok(statement, database=database)

        rows = store.rows(
            f"SELECT client_id, id, _commit_version FROM {database}.measurements_by_device FINAL "
            "WHERE client_id = 'c1'"
        )
        [months] = store.rows(
            f"SELECT count() AS months FROM {database}.measurements_by_device WHERE client_id = 'c2'"
        )
    finally:
        store.ok(f"DROP DATABASE {database} SYNC")

    assert [(row["client_id"], int(row["id"]), int(row["_commit_version"])) for row in rows] == [("c1", 1, 4)]
    assert int(months["months"]) == 101
