#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PoE 2 Trade Data Collector
==========================

一次获取 PoE 2 Trade API 的基础数据：

    /api/trade2/data/stats
    /api/trade2/data/items
    /api/trade2/data/filters
    /api/trade2/data/leagues

保存到：

    data/poe2_stats.json
    data/poe2_items.json
    data/poe2_filters.json
    data/poe2_leagues.json

同时生成：

    data/poe2_data_manifest.json

特点：
- 使用统一 User-Agent
- 单次运行按顺序请求，避免并发刷 API
- 429 时尊重 Retry-After
- 支持简单重试
- 任意一个接口失败不会覆盖已有成功缓存
- --force 可强制重新获取
- --only 可只更新某一个数据集

安装：
    pip install requests

运行：
    python fetch_poe2_data.py

只更新 stats：
    python fetch_poe2_data.py --only stats

强制重新获取全部：
    python fetch_poe2_data.py --force

注意：
本程序只获取公开 Trade 数据，不使用 POESESSID，也不查询物品价格。
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


BASE_URL = "https://www.pathofexile.com/api/trade2/data"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MANIFEST_FILE = DATA_DIR / "poe2_data_manifest.json"

# 如果以后公开项目，请改成你自己的项目名和联系方式。
USER_AGENT = "PoE2TabletMarket/0.2.0 (contact: your-email@example.com)"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}

DATASETS: dict[str, dict[str, str]] = {
    "stats": {
        "url": f"{BASE_URL}/stats",
        "file": "poe2_stats.json",
    },
    "items": {
        "url": f"{BASE_URL}/items",
        "file": "poe2_items.json",
    },
    "filters": {
        "url": f"{BASE_URL}/filters",
        "file": "poe2_filters.json",
    },
    "leagues": {
        "url": f"{BASE_URL}/leagues",
        "file": "poe2_leagues.json",
    },
}

# 正常情况下不要改小。后续如果 GGG 返回明确的 Retry-After，
# 程序会优先使用服务器提供的值。
DEFAULT_RETRIES = 3
DEFAULT_BACKOFF = 2.0


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")

    with tmp.open("w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2,
        )

    tmp.replace(path)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_manifest() -> dict[str, Any]:
    if not MANIFEST_FILE.exists():
        return {
            "version": 1,
            "updated_at": None,
            "datasets": {},
        }

    try:
        data = load_json(MANIFEST_FILE)
        if isinstance(data, dict):
            return data
    except (OSError, ValueError):
        pass

    return {
        "version": 1,
        "updated_at": None,
        "datasets": {},
    }


def save_manifest(manifest: dict[str, Any]) -> None:
    manifest["updated_at"] = now_utc()
    save_json(MANIFEST_FILE, manifest)


def response_retry_seconds(response: requests.Response) -> float | None:
    value = response.headers.get("Retry-After")

    if not value:
        return None

    try:
        seconds = float(value)
        return max(0.0, seconds)
    except ValueError:
        return None


def fetch_dataset(
    name: str,
    url: str,
    retries: int = DEFAULT_RETRIES,
) -> tuple[Any, requests.Response]:
    print()
    print("-" * 70)
    print(f"[{name}] GET {url}")
    print("-" * 70)

    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                url,
                headers=HEADERS,
                timeout=45,
            )
        except requests.RequestException as exc:
            last_error = exc

            if attempt >= retries:
                break

            delay = DEFAULT_BACKOFF * (2 ** (attempt - 1))
            delay += random.uniform(0, 0.5)

            print(
                f"[{name}] 网络错误，第 {attempt}/{retries} 次，"
                f"{delay:.1f}s 后重试"
            )
            time.sleep(delay)
            continue

        print(f"[{name}] HTTP {response.status_code}")

        if response.status_code == 200:
            try:
                return response.json(), response
            except ValueError as exc:
                raise RuntimeError(
                    f"{name}: API 返回的内容不是有效 JSON"
                ) from exc

        if response.status_code == 429:
            retry_after = response_retry_seconds(response)

            if retry_after is None:
                retry_after = DEFAULT_BACKOFF * (2 ** (attempt - 1))

            if attempt >= retries:
                raise RuntimeError(
                    f"{name}: API 返回 429，已达到最大重试次数"
                )

            # 留一点安全余量，避免刚好卡在限制边界。
            delay = retry_after + 1.0

            print(
                f"[{name}] API 限流 429，等待 {delay:.1f}s 后重试"
            )
            time.sleep(delay)
            continue

        if 500 <= response.status_code < 600:
            if attempt >= retries:
                raise RuntimeError(
                    f"{name}: API 返回服务器错误 "
                    f"{response.status_code}"
                )

            delay = DEFAULT_BACKOFF * (2 ** (attempt - 1))
            delay += random.uniform(0, 0.5)

            print(
                f"[{name}] 服务器错误，第 {attempt}/{retries} 次，"
                f"{delay:.1f}s 后重试"
            )
            time.sleep(delay)
            continue

        try:
            detail = response.json()
            detail_text = json.dumps(
                detail,
                ensure_ascii=False,
                indent=2,
            )
        except ValueError:
            detail_text = response.text[:2000]

        raise RuntimeError(
            f"{name}: HTTP {response.status_code}\n{detail_text}"
        )

    if last_error:
        raise RuntimeError(
            f"{name}: 请求失败: {last_error}"
        ) from last_error

    raise RuntimeError(f"{name}: 未知请求错误")


def dataset_summary(name: str, data: Any) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "type": type(data).__name__,
    }

    if isinstance(data, dict):
        summary["keys"] = list(data.keys())

        result = data.get("result")

        if isinstance(result, list):
            summary["result_count"] = len(result)

            if result:
                first = result[0]
                if isinstance(first, dict):
                    summary["first_result_keys"] = list(first.keys())

    elif isinstance(data, list):
        summary["count"] = len(data)

    return summary


def fetch_one(
    name: str,
    force: bool,
    manifest: dict[str, Any],
) -> bool:
    config = DATASETS[name]

    output_path = DATA_DIR / config["file"]

    if output_path.exists() and not force:
        try:
            existing = load_json(output_path)
            info = dataset_summary(name, existing)

            print()
            print(f"[{name}] 已存在缓存，跳过请求。")
            print(f"文件: {output_path}")
            print(f"摘要: {json.dumps(info, ensure_ascii=False)}")
            print("如需重新获取，请使用 --force。")

            manifest.setdefault("datasets", {})[name] = {
                "file": str(output_path.relative_to(BASE_DIR)),
                "url": config["url"],
                "status": "cached",
                "checked_at": now_utc(),
                "summary": info,
            }

            return True

        except (OSError, ValueError):
            print(f"[{name}] 现有缓存无法读取，将重新获取。")

    try:
        data, response = fetch_dataset(name, config["url"])
    except Exception as exc:
        print()
        print(f"[{name}] FAILED")
        print(str(exc))

        manifest.setdefault("datasets", {})[name] = {
            "file": str(output_path.relative_to(BASE_DIR)),
            "url": config["url"],
            "status": "failed",
            "checked_at": now_utc(),
            "error": str(exc),
        }

        return False

    save_json(output_path, data)

    summary = dataset_summary(name, data)

    manifest.setdefault("datasets", {})[name] = {
        "file": str(output_path.relative_to(BASE_DIR)),
        "url": config["url"],
        "status": "ok",
        "checked_at": now_utc(),
        "http_status": response.status_code,
        "etag": response.headers.get("ETag"),
        "last_modified": response.headers.get("Last-Modified"),
        "summary": summary,
    }

    print(f"[{name}] OK")
    print(f"保存: {output_path}")
    print(f"摘要: {json.dumps(summary, ensure_ascii=False)}")

    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PoE 2 Trade 基础数据采集器"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="忽略本地缓存，重新请求所有指定数据",
    )

    parser.add_argument(
        "--only",
        choices=["stats", "items", "filters", "leagues"],
        help="只更新一个数据集",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    ensure_data_dir()

    print()
    print("=" * 70)
    print("PoE 2 Trade Data Collector")
    print("=" * 70)
    print()
    print(f"API: {BASE_URL}")
    print(f"Data: {DATA_DIR}")
    print(f"User-Agent: {USER_AGENT}")
    print()

    if args.only:
        targets = [args.only]
    else:
        targets = list(DATASETS.keys())

    manifest = load_manifest()

    success_count = 0
    failed_count = 0

    for index, name in enumerate(targets):
        if index > 0:
            # 即使 API 没有触发 429，也不要连续无间隔请求。
            time.sleep(0.5)

        ok = fetch_one(
            name=name,
            force=args.force,
            manifest=manifest,
        )

        if ok:
            success_count += 1
        else:
            failed_count += 1

    save_manifest(manifest)

    print()
    print("=" * 70)
    print("采集完成")
    print("=" * 70)
    print(f"成功: {success_count}")
    print(f"失败: {failed_count}")
    print()
    print("数据目录:")
    print(f"  {DATA_DIR}")
    print()
    print("Manifest:")
    print(f"  {MANIFEST_FILE}")

    if failed_count:
        print()
        print("部分数据获取失败。已有成功缓存不会被删除。")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
