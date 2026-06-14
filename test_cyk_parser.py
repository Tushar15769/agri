"""
Tests for CYK Parsing Framework (cyk_parser.py)
================================================
Covers:
  - Basic acceptance / rejection
  - Parse table population
  - Backpointer reconstruction (most_likely_parse)
  - Span-specific queries (parses_for_span)
  - Ambiguous grammar (multiple parses)
  - Probabilistic ranking
  - Metrics: cells_filled, table_occupancy, parsing_complexity, grammar_coverage
  - Edge cases: single token, unknown token, empty input
  - Module-level parse() convenience function
  - Probabilistic helper utilities
"""

import math
import pytest

from cyk_parser import (
    CNFGrammar,
    CNFRule,
    CYKParser,
    ParseNode,
    log_prob_from_prob,
    parse,
    prob_from_log_prob,
)


# ---------------------------------------------------------------------------
# Fixture grammars
# ---------------------------------------------------------------------------

def simple_grammar() -> CNFGrammar:
    """
    Classic toy arithmetic grammar in CNF:
        S  -> NP VP
        NP -> Det N
        VP -> V NP
        Det -> 'the'
        N   -> 'dog' | 'cat'
        V   -> 'chases'
    """
    rules = [
        CNFRule("S",   ("NP", "VP")),
        CNFRule("NP",  ("Det", "N")),
        CNFRule("VP",  ("V", "NP")),
        CNFRule("Det", ("the",)),
        CNFRule("N",   ("dog",)),
        CNFRule("N",   ("cat",)),
        CNFRule("V",   ("chases",)),
    ]
    return CNFGrammar(start_symbol="S", rules=rules)


def ambiguous_grammar() -> CNFGrammar:
    """
    Grammar where 'a + b + c' can be parsed two ways:
        S  -> S S
        S  -> 'a' | 'b' | 'c' | '+'
    Note: allows highly ambiguous parses.
    """
    rules = [
        CNFRule("S", ("S", "S")),
        CNFRule("S", ("a",)),
        CNFRule("S", ("b",)),
        CNFRule("S", ("c",)),
        CNFRule("S", ("+",)),
    ]
    return CNFGrammar(start_symbol="S", rules=rules)


def prob_grammar() -> CNFGrammar:
    """
    Simple probabilistic grammar:
        S  -> A B  (log_prob = log(0.7))
        S  -> A C  (log_prob = log(0.3))
        A  -> 'x'
        B  -> 'y'
        C  -> 'y'
    """
    lp_07 = math.log(0.7)
    lp_03 = math.log(0.3)
    rules = [
        CNFRule("S", ("A", "B"), log_prob=lp_07),
        CNFRule("S", ("A", "C"), log_prob=lp_03),
        CNFRule("A", ("x",)),
        CNFRule("B", ("y",)),
        CNFRule("C", ("y",)),
    ]
    return CNFGrammar(start_symbol="S", rules=rules)


# ---------------------------------------------------------------------------
# Acceptance / rejection
# ---------------------------------------------------------------------------

class TestParseAcceptance:
    def test_accepted_sentence(self):
        grammar = simple_grammar()
        accepted, _ = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        assert accepted is True

    def test_rejected_sentence_wrong_order(self):
        grammar = simple_grammar()
        accepted, _ = parse(grammar, ["dog", "the", "chases", "the", "cat"])
        assert accepted is False

    def test_rejected_unknown_word(self):
        grammar = simple_grammar()
        accepted, _ = parse(grammar, ["the", "bird", "chases", "the", "cat"])
        assert accepted is False

    def test_single_token_accepted(self):
        grammar = ambiguous_grammar()
        accepted, _ = parse(grammar, ["a"])
        assert accepted is True

    def test_single_token_rejected(self):
        grammar = simple_grammar()
        accepted, _ = parse(grammar, ["dog"])
        assert accepted is False

    def test_empty_input_rejected(self):
        grammar = simple_grammar()
        accepted, _ = parse(grammar, [])
        assert accepted is False

    def test_two_token_ambiguous(self):
        grammar = ambiguous_grammar()
        accepted, _ = parse(grammar, ["a", "b"])
        assert accepted is True


# ---------------------------------------------------------------------------
# Parse table
# ---------------------------------------------------------------------------

class TestParseTable:
    def test_table_shape(self):
        grammar = simple_grammar()
        tokens = ["the", "dog", "chases", "the", "cat"]
        _, parser = parse(grammar, tokens)
        table = parser.parse_table()
        n = len(tokens)
        assert len(table) == n
        assert all(len(row) == n for row in table)

    def test_terminal_entries_on_diagonal(self):
        grammar = simple_grammar()
        tokens = ["the", "dog"]
        _, parser = parse(grammar, tokens)
        table = parser.parse_table()
        # table[0][0] should contain 'Det' (the -> Det)
        assert "Det" in table[0][0]
        # table[1][1] should contain 'N' (dog -> N)
        assert "N" in table[1][1]

    def test_table_entry_structure(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog"])
        table = parser.parse_table()
        entry = table[0][0]["Det"]
        assert "log_prob" in entry
        assert "backpointer" in entry
        # terminal entry has no backpointer
        assert entry["backpointer"] is None

    def test_table_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            parser.parse_table()


# ---------------------------------------------------------------------------
# Parse tree reconstruction
# ---------------------------------------------------------------------------

class TestMostLikelyParse:
    def test_most_likely_parse_returns_node(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        tree = parser.most_likely_parse()
        assert tree is not None
        assert isinstance(tree, ParseNode)

    def test_root_symbol(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        tree = parser.most_likely_parse()
        assert tree is not None
        assert tree.symbol == "S"

    def test_span_covers_full_input(self):
        grammar = simple_grammar()
        tokens = ["the", "dog", "chases", "the", "cat"]
        _, parser = parse(grammar, tokens)
        tree = parser.most_likely_parse()
        assert tree is not None
        assert tree.span == (0, len(tokens) - 1)

    def test_most_likely_parse_none_on_rejection(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["dog", "the"])
        tree = parser.most_likely_parse()
        assert tree is None

    def test_probabilistic_ranking(self):
        grammar = prob_grammar()
        _, parser = parse(grammar, ["x", "y"])
        tree = parser.most_likely_parse()
        assert tree is not None
        assert tree.symbol == "S"
        # The best parse should prefer the higher-probability rule (S -> A B, 0.7)
        # The child of S should be B not C for the right subtree
        right_child = tree.children[1]
        assert right_child.symbol == "B"

    def test_tree_leaves_match_tokens(self):
        grammar = simple_grammar()
        tokens = ["the", "dog"]
        _, parser = parse(grammar, tokens)
        tree = parser.most_likely_parse()
        # Collect all leaf symbols
        leaves: list = []

        def collect_leaves(node: ParseNode) -> None:
            if node.is_terminal():
                leaves.append(node.symbol)
            else:
                for child in node.children:
                    collect_leaves(child)

        assert tree is not None
        collect_leaves(tree)
        assert leaves == tokens

    def test_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            parser.most_likely_parse()


# ---------------------------------------------------------------------------
# Span queries
# ---------------------------------------------------------------------------

class TestParsesForSpan:
    def test_returns_list(self):
        grammar = simple_grammar()
        tokens = ["the", "dog", "chases", "the", "cat"]
        _, parser = parse(grammar, tokens)
        result = parser.parses_for_span(0, 1)
        assert isinstance(result, list)

    def test_span_nonterminals_present(self):
        grammar = simple_grammar()
        tokens = ["the", "dog"]
        _, parser = parse(grammar, tokens)
        spans = parser.parses_for_span(0, 1)
        symbols = {node.symbol for node in spans}
        assert "NP" in symbols

    def test_single_token_span(self):
        grammar = simple_grammar()
        tokens = ["the", "dog"]
        _, parser = parse(grammar, tokens)
        spans = parser.parses_for_span(0, 0)
        symbols = {node.symbol for node in spans}
        assert "Det" in symbols

    def test_out_of_bounds_raises(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog"])
        with pytest.raises(IndexError):
            parser.parses_for_span(0, 5)

    def test_empty_span_for_unrecognized(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog"])
        # Span (1, 0) is invalid: start > end
        with pytest.raises(IndexError):
            parser.parses_for_span(1, 0)

    def test_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            parser.parses_for_span(0, 0)


# ---------------------------------------------------------------------------
# Ambiguous grammar
# ---------------------------------------------------------------------------

class TestAmbiguousGrammar:
    def test_ambiguous_input_accepted(self):
        grammar = ambiguous_grammar()
        accepted, _ = parse(grammar, ["a", "+", "b"])
        assert accepted is True

    def test_all_parses_generator(self):
        grammar = ambiguous_grammar()
        _, parser = parse(grammar, ["a", "b"])
        trees = list(parser.all_parses())
        assert len(trees) >= 1
        for tree in trees:
            assert tree.symbol == "S"

    def test_all_parses_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            list(parser.all_parses())


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

class TestMetrics:
    def test_cells_filled_positive(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        assert parser.cells_filled() > 0

    def test_table_occupancy_in_range(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        occ = parser.table_occupancy()
        assert 0.0 <= occ <= 1.0

    def test_parsing_complexity_keys(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        metrics = parser.parsing_complexity()
        expected_keys = {
            "input_length",
            "grammar_rules",
            "nonterminals",
            "cells_filled",
            "table_occupancy",
            "accepted",
        }
        assert expected_keys == set(metrics.keys())

    def test_parsing_complexity_values(self):
        grammar = simple_grammar()
        tokens = ["the", "dog", "chases", "the", "cat"]
        _, parser = parse(grammar, tokens)
        metrics = parser.parsing_complexity()
        assert metrics["input_length"] == len(tokens)
        assert metrics["grammar_rules"] == len(grammar.rules)
        assert metrics["accepted"] is True

    def test_grammar_coverage_keys(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        cov = parser.grammar_coverage()
        assert "rules_total" in cov
        assert "rules_applied" in cov
        assert "coverage_fraction" in cov

    def test_grammar_coverage_fraction_in_range(self):
        grammar = simple_grammar()
        _, parser = parse(grammar, ["the", "dog", "chases", "the", "cat"])
        cov = parser.grammar_coverage()
        assert 0.0 <= cov["coverage_fraction"] <= 1.0

    def test_cells_filled_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            parser.cells_filled()

    def test_table_occupancy_raises_before_parse(self):
        parser = CYKParser()
        with pytest.raises(RuntimeError):
            parser.table_occupancy()


# ---------------------------------------------------------------------------
# CNFGrammar validation
# ---------------------------------------------------------------------------

class TestCNFGrammar:
    def test_invalid_rule_raises(self):
        with pytest.raises(ValueError):
            CNFGrammar(
                start_symbol="S",
                rules=[CNFRule("S", ("A", "B", "C"))],  # ternary: invalid CNF
            )

    def test_nonterminals_extracted(self):
        grammar = simple_grammar()
        expected = {"S", "NP", "VP", "Det", "N", "V"}
        assert grammar.nonterminals == expected

    def test_binary_lookup(self):
        grammar = simple_grammar()
        rules = grammar.rules_for_binary("NP", "VP")
        assert any(r.lhs == "S" for r in rules)

    def test_terminal_lookup(self):
        grammar = simple_grammar()
        rules = grammar.rules_for_terminal("dog")
        assert any(r.lhs == "N" for r in rules)

    def test_missing_binary_returns_empty(self):
        grammar = simple_grammar()
        assert grammar.rules_for_binary("X", "Y") == []

    def test_missing_terminal_returns_empty(self):
        grammar = simple_grammar()
        assert grammar.rules_for_terminal("elephant") == []


# ---------------------------------------------------------------------------
# Probabilistic helpers
# ---------------------------------------------------------------------------

class TestProbHelpers:
    def test_log_prob_from_prob_one(self):
        assert log_prob_from_prob(1.0) == pytest.approx(0.0)

    def test_log_prob_from_prob_half(self):
        assert log_prob_from_prob(0.5) == pytest.approx(math.log(0.5))

    def test_log_prob_from_prob_zero(self):
        assert log_prob_from_prob(0.0) == -math.inf

    def test_prob_from_log_prob_zero(self):
        assert prob_from_log_prob(0.0) == pytest.approx(1.0)

    def test_prob_from_log_prob_roundtrip(self):
        for p in [0.1, 0.5, 0.9]:
            assert prob_from_log_prob(log_prob_from_prob(p)) == pytest.approx(p)


# ---------------------------------------------------------------------------
# ParseNode
# ---------------------------------------------------------------------------

class TestParseNode:
    def test_is_terminal_true(self):
        node = ParseNode(symbol="dog", span=(1, 1))
        assert node.is_terminal() is True

    def test_is_terminal_false(self):
        child = ParseNode(symbol="dog", span=(1, 1))
        node = ParseNode(symbol="N", children=[child], span=(1, 1))
        assert node.is_terminal() is False

    def test_default_children_empty(self):
        node = ParseNode(symbol="S")
        assert node.children == []

    def test_span_stored(self):
        node = ParseNode(symbol="NP", span=(2, 4))
        assert node.span == (2, 4)
