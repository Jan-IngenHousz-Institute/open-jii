"""Tests for the RIDES re-interleave repair (pure logic only)."""

from __future__ import annotations

import pytest
from data_repair.repairs._2026_04_rides_inplace import (
    _looks_de_interleaved,
    _reinterleave,
)


class TestReinterleave:
    @pytest.mark.parametrize(
        ("de_interleaved", "expected"),
        [
            # Even N=4: halves [1,2] + [3,4] -> [1,3,2,4]
            ([1, 2, 3, 4], [1, 3, 2, 4]),
            # Odd N=5: h=ceil(5/2)=3, halves [1,2,3] + [4,5] -> [1,4,2,5,3]
            ([1, 2, 3, 4, 5], [1, 4, 2, 5, 3]),
            ([1, 2], [1, 2]),
            ([], []),
            ([7], [7]),
        ],
    )
    def test_round_trip_against_macro_split(self, de_interleaved: list, expected: list) -> None:
        assert _reinterleave(de_interleaved) == expected

    def test_inverse_of_macro_split(self) -> None:
        """Re-interleaving the macro's even/odd output must restore the original."""
        original = list(range(10))
        # Simulate the macro splitting [a0,b0,a1,b1,...] -> [a0,a1,...,b0,b1,...]
        evens = original[::2]
        odds = original[1::2]
        de_interleaved = evens + odds
        assert _reinterleave(de_interleaved) == original


class TestLooksDeInterleaved:
    def test_short_arrays_are_not_classified(self) -> None:
        assert _looks_de_interleaved([1, 2, 3]) is False

    def test_zigzag_pattern_classified_as_normal(self) -> None:
        # A classic interleaved [low, high, low, high, ...] crosses the median often.
        zigzag = [1, 100, 2, 99, 3, 98, 4, 97, 5, 96]
        assert _looks_de_interleaved(zigzag) is False

    def test_block_pattern_classified_as_de_interleaved(self) -> None:
        # All-lows-then-all-highs has only one crossing.
        block = [1, 2, 3, 4, 5, 96, 97, 98, 99, 100]
        assert _looks_de_interleaved(block) is True
