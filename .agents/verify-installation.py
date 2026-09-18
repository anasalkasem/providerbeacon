#!/usr/bin/env python3
"""Verify the vendored Agent Skills snapshot offline; never execute vendor code."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath

UPSTREAM = "addyosmani/agent-skills"
VERSION = "0.6.10"
COMMIT = "c004a74784a08295d52749b04cda634125b9a581"
SKILL_COUNT = 25
ROOT = Path(__file__).resolve().parent.parent


def verify() -> None:
    manifest = json.loads((ROOT / ".agents/agent-skills.lock.json").read_text())
    assert manifest["schema_version"] == 1, "Unsupported lock format"
    source = manifest["source"]
    assert (source["repository"], source["version"], source["commit"]) == (
        UPSTREAM, VERSION, COMMIT
    ), "Unexpected upstream snapshot"
    records = manifest["files"]
    assert records and isinstance(records, list), "Missing file inventory"
    expected: set[str] = set()
    for record in records:
        name = record["path"]
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and ".." not in relative.parts, name
        assert name not in expected, f"Duplicate path: {name}"
        assert name.startswith((".agents/skills/", ".agents/references/")) or name == (
            ".agents/LICENSE.addy-agent-skills"
        ), f"Unexpected destination: {name}"
        path = ROOT / relative
        assert all(not parent.is_symlink() for parent in [path, *path.parents]), name
        assert path.is_file(), f"Missing file: {name}"
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == record["sha256"], f"Modified: {name}"
        header = f"blob {len(data)}\0".encode()
        assert hashlib.sha1(header + data).hexdigest() == record["git_blob_sha"], name
        expected.add(name)
    actual = {".agents/LICENSE.addy-agent-skills"}
    for folder in ("skills", "references"):
        for path in (ROOT / ".agents" / folder).rglob("*"):
            assert not path.is_symlink(), f"Symlink not allowed: {path}"
            if path.is_file():
                actual.add(path.relative_to(ROOT).as_posix())
    assert actual == expected, f"Inventory mismatch: {sorted(actual ^ expected)}"
    skills = sorted((ROOT / ".agents/skills").glob("*/SKILL.md"))
    assert len(skills) == SKILL_COUNT == manifest["skill_count"], "Wrong skill count"
    names: set[str] = set()
    for skill in skills:
        text = skill.read_text(encoding="utf-8")
        assert text.startswith("---\n"), f"Missing frontmatter: {skill}"
        frontmatter = text.split("---", 2)[1]
        name = re.search(r"^name:\s*([a-z0-9-]+)\s*$", frontmatter, re.MULTILINE)
        description = re.search(r"^description:\s*\S", frontmatter, re.MULTILINE)
        assert name and description, f"Missing routing metadata: {skill}"
        assert name.group(1) == skill.parent.name, f"Name/path mismatch: {skill}"
        assert name.group(1) not in names, f"Duplicate skill: {skill}"
        names.add(name.group(1))
    print(f"Verified Agent Skills {VERSION}: {len(skills)} skills, {len(records)} files.")
    print(f"Pinned upstream commit: {COMMIT}")
    print("All file hashes and skill routing headers match; no vendor code executed.")


if __name__ == "__main__":
    try:
        verify()
    except (AssertionError, OSError, KeyError, TypeError, ValueError, IndexError) as error:
        print(f"Agent Skills verification failed: {error}", file=sys.stderr)
        sys.exit(1)
