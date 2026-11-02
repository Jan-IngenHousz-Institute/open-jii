from openjii.question_type_preflight import classify_history


def test_version_recovery_never_guesses_from_a_numeric_looking_string():
    versions = [
        {
            "id": "v1",
            "cells": [
                {"type": "question", "name": "Height", "question": {"kind": "number", "text": "Height?"}},
                {"type": "question", "name": "Plot", "question": {"kind": "multi_choice", "text": "Plot?"}},
            ],
        }
    ]
    rows = [
        {
            "experiment_id": "e1",
            "workbook_version_id": "v1",
            "questions": [
                {"question_label": "Height", "question_text": "Height?", "question_answer": "12.5"},
                {"question_label": "Plot", "question_text": "Plot?", "question_answer": "007"},
            ],
        },
        {"experiment_id": "e1", "questions": [{"question_label": "Unknown", "question_answer": "12.5"}]},
    ]
    report = classify_history(rows, versions)
    assert report == classify_history(rows, versions)
    columns = {entry["key"]: entry for entry in report["columns"]}
    assert columns["height"]["eligible_numeric"] is True
    assert columns["height"]["recovered_from_version"] == 1
    assert columns["plot"]["eligible_numeric"] is False
    assert columns["unknown"]["unknown"] == 1
    assert columns["unknown"]["no_version"] == 1


def test_missing_deleted_or_ambiguous_snapshots_and_mixed_kinds_stay_inactive():
    entries = [
        {"question_label": "Height", "question_answer": "12", "question_kind": "number"},
        {"question_label": "Height", "question_answer": "tall", "question_kind": "open_ended"},
        {"question_label": "Invalid", "question_answer": "1d", "question_kind": "number"},
        {"question_label": "Deleted", "question_answer": "007"},
    ]
    rows = [
        {"experiment_id": "e1", "workbook_version_id": "deleted", "questions": [entry]} for entry in entries
    ]
    columns = {entry["key"]: entry for entry in classify_history(rows, [])["columns"]}
    assert not any(entry["eligible_numeric"] for entry in columns.values())
    assert columns["height"]["number"] == 1 and columns["height"]["text"] == 1
    assert columns["invalid"]["invalid_number"] == 1
    assert columns["deleted"]["unknown"] == 1
