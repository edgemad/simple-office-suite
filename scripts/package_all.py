#!/usr/bin/env python3
import argparse
import hashlib
import sys
from pathlib import Path

ARTIFACT_SUFFIXES = {
    ".appimage",
    ".deb",
    ".dmg",
    ".exe",
    ".msi",
    ".msix",
    ".pkg",
    ".rpm",
    ".snap",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_artifact(path: Path) -> bool:
    name = path.name.lower()
    if name.endswith(".app") and path.is_dir():
        return True
    return path.is_file() and path.suffix.lower() in ARTIFACT_SUFFIXES


def main() -> int:
    repository = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Verify artifacts emitted by a Tauri build")
    parser.add_argument(
        "--bundle-dir",
        type=Path,
        default=repository / "src-tauri" / "target" / "release" / "bundle",
    )
    parser.add_argument(
        "--expect",
        default="",
        help="comma-separated artifact suffixes that must all be present",
    )
    args = parser.parse_args()

    bundle_dir = args.bundle_dir.resolve()
    if not bundle_dir.is_dir():
        print(f"Tauri bundle directory does not exist: {bundle_dir}", file=sys.stderr)
        return 2

    all_artifacts = sorted(
        (path for path in bundle_dir.rglob("*") if is_artifact(path)),
        key=lambda path: str(path).lower(),
    )
    if not all_artifacts:
        print(f"No Tauri artifacts found in {bundle_dir}", file=sys.stderr)
        return 1

    expected = [suffix.strip().lower() for suffix in args.expect.split(",") if suffix.strip()]
    if expected:
        missing = [
            suffix
            for suffix in expected
            if not any(path.name.lower().endswith(suffix) for path in all_artifacts)
        ]
        if missing:
            missing_list = ", ".join(missing)
            print(f"Missing expected Tauri artifacts: {missing_list}", file=sys.stderr)
            return 1
        artifacts = [
            path
            for path in all_artifacts
            if any(path.name.lower().endswith(suffix) for suffix in expected)
        ]
    else:
        artifacts = all_artifacts

    print(f"Verified Tauri bundle output in {bundle_dir}")
    for artifact in artifacts:
        relative = artifact.relative_to(bundle_dir)
        if artifact.is_dir():
            print(f"directory  {relative}")
        else:
            print(f"{sha256(artifact)}  {relative}")
    print(f"Verified {len(artifacts)} artifact(s); no files were generated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
