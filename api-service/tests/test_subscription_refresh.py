"""Tests for subscription title normalization (pure logic only).

`clean()` decides whether a catalog record matches an entry in an
authoritative subscription source list. Matching is exact after
normalization, so every pattern here is about making two spellings of the
same product normalize identically — never about matching different products.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from subscription_refresh import MANAGED, clean


def test_managed_services_are_the_five_machine_checked_ones():
    # ubisoft_plus and nintendo_switch_online have no verifiable source and
    # must stay unmanaged, so their tags are preserved rather than recomputed.
    assert MANAGED == ["xbox_game_pass", "playstation_plus", "apple_arcade",
                       "netflix_games", "ea_play"]


def test_trademark_glyphs_become_spaces_not_nothing():
    assert clean("Borderlands®4") == "borderlands 4"
    assert clean("Borderlands 4") == "borderlands 4"


def test_arcade_plus_variant_matches_base_title():
    assert clean("Stardew Valley+") == clean("Stardew Valley")


def test_platform_and_edition_suffixes_are_stripped():
    assert clean("Ghost of Tsushima PS4 & PS5") == "ghost of tsushima"
    assert clean("Oxenfree: Netflix Edition") == clean("Oxenfree")
    assert clean("Hogwarts Legacy Standard Edition") == "hogwarts legacy"


def test_xbox_sku_suffixes_are_stripped():
    # EA Play lists "Madden NFL 25 Xbox One"; the record is "Madden NFL 25".
    assert clean("Madden NFL 25 Xbox One") == clean("Madden NFL 25")
    assert clean("Halo Infinite Xbox Series X|S") == clean("Halo Infinite")
    assert clean("Forza Horizon 5 - Xbox Series X|S") == clean("Forza Horizon 5")


def test_publisher_prefixes_are_stripped():
    assert clean("Tom Clancy's The Division 2") == clean("The Division 2")
    assert clean("Sid Meier's Civilization VII") == clean("Civilization VII")
    assert clean("Marvel's Spider-Man") == clean("Spider-Man")
    assert clean("Disney's Aladdin") == clean("Aladdin")


def test_publisher_prefix_handles_curly_apostrophe():
    assert clean("Tom Clancy’s Ghost Recon® Breakpoint") == \
        clean("Ghost Recon Breakpoint")


def test_edition_noise_the_audit_left_alone_still_blocks_a_match():
    # "Elite Edition" / "Digital Version" SKUs are a human call (whether the
    # SKU is the same product as the base record), so they must NOT match.
    assert clean("Tom Clancy's Rainbow Six® Siege - Elite Edition") != \
        clean("Rainbow Six Siege")
    assert clean("It Takes Two - Digital Version") != clean("It Takes Two")


def test_distinct_products_do_not_collapse():
    assert clean("Madden NFL 25") != clean("Madden NFL 26")
    assert clean("Civilization VII") != clean("Civilization VI")
    assert clean("Spider-Man") != clean("Spider-Man 2")


def test_empty_and_missing_titles_are_safe():
    assert clean("") == ""
    assert clean(None) == ""
