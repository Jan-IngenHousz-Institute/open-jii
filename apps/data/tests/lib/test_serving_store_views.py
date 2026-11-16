"""The serving store's reads for the backend: views that name one experiment, which are all its reader
may read, and the contributor and client ids kept beside the rows.

The tests run against a real store, as described in test_serving_store_tables.py, and skip without
one.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Iterator
from pathlib import Path
from xml.etree import ElementTree

import pytest
import requests

pytestmark = pytest.mark.clickhouse

_DATABASE = "views_test"
_READER = "views_test_reader"
_READER_PROFILE = "views_test_reader_profile"

_USERS_XML = Path(__file__).parents[4] / "infrastructure/modules/serving-store/templates/users.xml.tftpl"

# The reader's grants in infrastructure/modules/serving-store/main.tf.
_READER_VIEWS = (
    "experiment_measurements",
    "experiment_macro_results",
    "experiment_uploads",
    "experiment_contributor_ids",
    "experiment_client_ids",
    "experiment_payload_schemas",
    "experiment_annotations",
    "experiment_metadata_rows",
)

_COMMIT = "_commit_version, _commit_timestamp"


def _reader_profile() -> str:
    """The reader's profile as the store's users.xml sets it, its fixed settings fixed, as a
    statement a test server can run."""
    template = _USERS_XML.read_text()
    profiles = ElementTree.fromstring(
        template[template.index("<profiles>") : template.index("</profiles>") + 11]
    )
    default, reader = profiles.find("default"), profiles.find("reader")
    assert default is not None and reader is not None
    fixed = {setting.tag for setting in reader.findall("constraints/*")}
    values = {
        setting.tag: setting.text
        for setting in [*default, *reader]
        if setting.tag not in ("profile", "constraints")
    }
    settings = [f"{name} = {value}{' CONST' if name in fixed else ''}" for name, value in values.items()]
    settings += [f"{name} CONST" for name in sorted(fixed - values.keys())]
    return f"CREATE SETTINGS PROFILE {_READER_PROFILE} SETTINGS {', '.join(settings)}"


class _User:
    """One user's view of a real store."""

    def __init__(self, url: str, user: str, password: str):
        self.url = url
        self.headers = {"X-ClickHouse-User": user, "X-ClickHouse-Key": password}

    def run(self, sql: str, database: str | None = None, **parameters: str) -> requests.Response:
        params = {"database": database} if database else {}
        params.update({f"param_{name}": value for name, value in parameters.items()})
        return requests.post(self.url, params=params, data=sql.encode(), headers=self.headers, timeout=60)

    def ok(self, sql: str, database: str | None = None, **parameters: str) -> str:
        response = self.run(sql, database, **parameters)
        assert response.ok, response.text
        return response.text

    def rows(self, sql: str, **parameters: str) -> list[dict]:
        text = self.ok(f"{sql} FORMAT JSONEachRow", **parameters)
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture
def admin(store_migrations: list[str]) -> Iterator[_User]:
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    admin = _User(url, os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"])
    admin.ok(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    admin.ok(f"DROP USER IF EXISTS {_READER}")
    admin.ok(f"DROP SETTINGS PROFILE IF EXISTS {_READER_PROFILE}")
    admin.ok(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        admin.ok(statement, database=_DATABASE)
    admin.ok(_reader_profile())
    admin.ok(f"CREATE USER {_READER} IDENTIFIED BY 'views-test' SETTINGS PROFILE '{_READER_PROFILE}'")
    for view in _READER_VIEWS:
        admin.ok(f"GRANT SELECT ON {_DATABASE}.{view} TO {_READER}")

    admin.ok(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, user_id, client_id, {_COMMIT}) VALUES "
        "('e1', 1, '2026-10-19 10:00:00', 'u1', 'c1', 3, '2026-10-19 10:00:01'), "
        "('e1', 2, '2026-10-19 11:00:00', 'u2', 'c1', 3, '2026-10-19 11:00:01'), "
        "('e2', 3, '2026-10-19 12:00:00', 'u3', 'c3', 3, '2026-10-19 12:00:01')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.macro_results (experiment_id, id, raw_id, timestamp, user_id, client_id, {_COMMIT}) "
        "VALUES ('e1', 11, 1, '2026-10-19 10:00:00', 'u4', 'c4', 4, '2026-10-19 10:00:05')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.uploads (experiment_id, id, uploaded_at, created_by, {_COMMIT}) "
        "VALUES ('e1', 21, '2026-10-19 09:00:00', 'u5', 5, '2026-10-19 09:00:01')"
    )

    yield admin

    admin.ok(f"DROP USER {_READER}")
    admin.ok(f"DROP SETTINGS PROFILE {_READER_PROFILE}")
    admin.ok(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def reader(admin: _User) -> _User:
    return _User(admin.url, _READER, "views-test")


def test_the_reader_reads_one_experiments_rows_through_each_view(reader: _User) -> None:
    measurements = reader.rows(
        f"SELECT id FROM {_DATABASE}.experiment_measurements(experiment = {{experiment:String}}) ORDER BY id",
        experiment="e1",
    )
    macro_results = reader.rows(f"SELECT id FROM {_DATABASE}.experiment_macro_results(experiment = 'e1')")
    uploads = reader.rows(f"SELECT id FROM {_DATABASE}.experiment_uploads(experiment = 'e1')")

    assert [int(row["id"]) for row in measurements] == [1, 2]
    assert [int(row["id"]) for row in macro_results] == [11]
    assert [int(row["id"]) for row in uploads] == [21]


@pytest.mark.parametrize(
    "statement",
    [
        f"SELECT count() FROM {_DATABASE}.measurements",
        f"SELECT count() FROM {_DATABASE}.contributor_ids",
        f"SELECT count() FROM {_DATABASE}.payload_schemas",
    ],
)
def test_the_reader_cannot_read_a_table_without_naming_an_experiment(reader: _User, statement: str) -> None:
    response = reader.run(statement)

    assert response.headers.get("X-ClickHouse-Exception-Code") == "497"


def test_a_view_refuses_a_read_that_names_no_experiment(reader: _User) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.experiment_measurements")

    assert not response.ok
    assert "experiment" in response.text


@pytest.mark.parametrize(
    "setting",
    [
        "max_memory_usage = 0",
        "max_execution_time = 0",
        "max_memory_usage_for_user = 0",
        "timeout_overflow_mode = 'break'",
        "apply_deleted_mask = 0",
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


def test_an_annotation_reads_at_its_newest_claims_copy_and_a_deleted_one_not_at_all(
    admin: _User, reader: _User
) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.annotations")
    columns = "experiment_id, id, table_name, row_id, type, flag_type, is_deleted, claimed_at"
    admin.ok(
        f"INSERT INTO {_DATABASE}.annotations ({columns}) VALUES "
        "('e1', 'a1', 'raw_data', '1', 'flag', 'needs_review', 0, '2026-10-19 10:02:00'), "
        "('e1', 'a2', 'raw_data', '2', 'comment', NULL, 0, '2026-10-19 10:01:00'), "
        "('e2', 'a3', 'raw_data', '3', 'flag', 'outlier', 0, '2026-10-19 10:01:00')"
    )
    # An older claim's copy that lands late, and a deletion's newer one.
    admin.ok(
        f"INSERT INTO {_DATABASE}.annotations ({columns}) VALUES "
        "('e1', 'a1', 'raw_data', '1', 'flag', 'outlier', 0, '2026-10-19 10:01:00'), "
        "('e1', 'a2', '', '', '', NULL, 1, '2026-10-19 10:03:00')"
    )

    rows = reader.rows(f"SELECT id, flag_type FROM {_DATABASE}.experiment_annotations(experiment = 'e1')")

    assert rows == [{"id": "a1", "flag_type": "needs_review"}]


def test_a_sheet_row_an_edit_removed_no_longer_reads(admin: _User, reader: _User) -> None:
    admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.metadata_rows")
    columns = (
        "experiment_id, sheet_id, sheet_created_at, match_on, identifier, fields, is_deleted, claimed_at"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.metadata_rows ({columns}) "
        "VALUES ('e1', 's1', '2026-10-19 08:00:00', 'q1', 'plot-1', '{\"soil\":\"clay\"}', 0, '2026-10-19 08:01:00'), "
        "('e1', 's1', '2026-10-19 08:00:00', 'q1', 'plot-2', '{\"soil\":\"sand\"}', 0, '2026-10-19 08:01:00')"
    )
    admin.ok(
        f"INSERT INTO {_DATABASE}.metadata_rows ({columns}) "
        "VALUES ('e1', 's1', '1970-01-01 00:00:00', '', 'plot-2', '', 1, '2026-10-19 08:02:00')"
    )

    rows = reader.rows(
        f"SELECT identifier, fields FROM {_DATABASE}.experiment_metadata_rows(experiment = 'e1')"
    )

    assert rows == [{"identifier": "plot-1", "fields": '{"soil":"clay"}'}]


@pytest.mark.parametrize("table", ["annotations", "metadata_rows"])
def test_the_reader_reads_the_copies_only_through_their_views(reader: _User, table: str) -> None:
    response = reader.run(f"SELECT count() FROM {_DATABASE}.{table}")

    assert response.headers.get("X-ClickHouse-Exception-Code") == "497"


# The copier's and the feed writer's grants in infrastructure/modules/serving-store/main.tf.
_COPIER_GRANTS = (
    "GRANT INSERT ON {db}.annotations",
    "GRANT SELECT, INSERT ON {db}.metadata_rows",
)
_WRITER_GRANTS = (
    "GRANT SELECT, INSERT ON {db}.*",
    "REVOKE INSERT ON {db}.annotations",
    "REVOKE INSERT ON {db}.metadata_rows",
)


@pytest.fixture
def user_with_grants(admin: _User) -> Iterator[Callable[[str, tuple[str, ...]], _User]]:
    created: list[str] = []

    def create(name: str, grants: tuple[str, ...]) -> _User:
        admin.ok(f"DROP USER IF EXISTS {name}")
        admin.ok(f"CREATE USER {name} IDENTIFIED BY 'grants-test'")
        for grant in grants:
            statement = grant.format(db=_DATABASE)
            target = "FROM" if statement.startswith("REVOKE") else "TO"
            admin.ok(f"{statement} {target} {name}")
        created.append(name)
        return _User(admin.url, name, "grants-test")

    yield create

    for name in created:
        admin.ok(f"DROP USER {name}")


def test_the_copier_writes_its_two_tables_and_reads_only_the_sheet_rows(
    user_with_grants: Callable[[str, tuple[str, ...]], _User],
) -> None:
    copier = user_with_grants("views_test_copier", _COPIER_GRANTS)

    copier.ok(
        f"INSERT INTO {_DATABASE}.annotations (experiment_id, id, claimed_at) "
        "VALUES ('e1', 'a9', '2026-10-19 10:00:00')"
    )
    copier.ok(
        f"INSERT INTO {_DATABASE}.metadata_rows (experiment_id, sheet_id, identifier, claimed_at) "
        "VALUES ('e1', 's9', 'plot-9', '2026-10-19 10:00:00')"
    )
    held = copier.rows(f"SELECT identifier FROM {_DATABASE}.metadata_rows FINAL WHERE sheet_id = 's9'")

    assert held == [{"identifier": "plot-9"}]
    for refused in (
        f"SELECT count() FROM {_DATABASE}.annotations",
        f"SELECT count() FROM {_DATABASE}.measurements",
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp) VALUES ('e1', 99, now())",
    ):
        assert copier.run(refused).headers.get("X-ClickHouse-Exception-Code") == "497", refused


@pytest.mark.parametrize("table", ["annotations", "metadata_rows"])
def test_the_feed_writer_cannot_write_the_copies(
    user_with_grants: Callable[[str, tuple[str, ...]], _User], table: str
) -> None:
    writer = user_with_grants("views_test_writer", _WRITER_GRANTS)

    response = writer.run(f"INSERT INTO {_DATABASE}.{table} (experiment_id) VALUES ('e1')")

    assert response.headers.get("X-ClickHouse-Exception-Code") == "497"
