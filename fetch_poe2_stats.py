#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PoE 2 Tablet Stats Collector
============================

第一版功能：
1. 请求 PoE 2 Trade API:
   https://www.pathofexile.com/api/trade2/data/stats
2. 保存完整原始数据: data/stats_raw.json
3. 整理全部 Stats: data/all_stats.json
4. 初步搜索 Tablet / Precursor 相关 Stats:
   data/tablet_stats.json

本版本只获取 Stats，不查询价格，不使用 POESESSID。

需要:
    Python 3.10+
    pip install requests

运行:
    python fetch_poe2_stats.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import requests


API_URL = "https://www.pathofexile.com/api/trade2/data/stats"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

RAW_FILE = DATA_DIR / "stats_raw.json"
ALL_STATS_FILE = DATA_DIR / "all_stats.json"
TABLET_STATS_FILE = DATA_DIR / "tablet_stats.json"

# 发布项目时建议改成你自己的项目名和联系方式。
USER_AGENT = (
    "PoE2TabletMarket/0.1.0 "
    "(contact: your-email@example.com)"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}

# 这里只用于“发现候选”，不是最终的碑牌分类规则。
TABLET_KEYWORDS = [
    "tablet",
    "precursor",
    "precursor tablet",
    "碑牌",
    "先驱",
]


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def fetch_stats() -> dict[str, Any]:
    print("=" * 70)
    print("正在请求 PoE 2 Trade Stats...")
    print("=" * 70)
    print(f"URL: {API_URL}")
    print()

    try:
        response = requests.get(
            API_URL,
            headers=HEADERS,
            timeout=30,
        )
    except requests.RequestException as exc:
        print("[错误] 请求 API 失败:")
        print(exc)
        sys.exit(1)

    print(f"HTTP 状态码: {response.status_code}")

    if response.status_code == 200:
        try:
            return response.json()
        except ValueError:
            print("[错误] API 返回内容不是有效 JSON。")
            print(response.text[:1000])
            sys.exit(1)

    if response.status_code == 429:
        retry_after = response.headers.get("Retry-After")
        print()
        print("[警告] API 返回 429：请求过于频繁。")
        if retry_after:
            print(f"服务器建议等待: {retry_after} 秒")
        print("本次程序不会继续重试，以避免造成更多无效请求。")
        sys.exit(2)

    print()
    print("[错误] API 请求失败。")
    try:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    except ValueError:
        print(response.text[:2000])
    sys.exit(1)


def extract_stats(raw_data: dict[str, Any]) -> list[dict[str, Any]]:
    result = raw_data.get("result")

    if not isinstance(result, list):
        print("[错误] API 返回数据中没有有效的 result。")
        print(json.dumps(raw_data, ensure_ascii=False, indent=2)[:3000])
        sys.exit(1)

    groups: list[dict[str, Any]] = []
    total_stats = 0

    for group in result:
        if not isinstance(group, dict):
            continue

        entries = group.get("entries", [])
        clean_entries = []

        if isinstance(entries, list):
            for entry in entries:
                if not isinstance(entry, dict):
                    continue

                clean_entries.append(
                    {
                        "id": entry.get("id"),
                        "text": entry.get("text"),
                        "type": entry.get("type"),
                    }
                )
                total_stats += 1

        groups.append(
            {
                "id": group.get("id"),
                "label": group.get("label"),
                "stats": clean_entries,
            }
        )

    print()
    print("Stats 解析完成")
    print(f"Stat Group 数量: {len(groups)}")
    print(f"Stat 总数量: {total_stats}")

    return groups


def flatten_stats(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []

    for group in groups:
        stats = group.get("stats", [])
        if not isinstance(stats, list):
            continue

        for stat in stats:
            if not isinstance(stat, dict):
                continue

            result.append(
                {
                    "group_id": group.get("id"),
                    "group_label": group.get("label"),
                    "id": stat.get("id"),
                    "text": stat.get("text"),
                    "type": stat.get("type"),
                }
            )

    return result


def find_tablet_stats(stats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    matches = []

    for stat in stats:
        searchable = " ".join(
            str(value)
            for value in (
                stat.get("id"),
                stat.get("text"),
                stat.get("group_id"),
                stat.get("group_label"),
            )
            if value is not None
        ).lower()

        matched_keywords = [
            keyword
            for keyword in TABLET_KEYWORDS
            if keyword.lower() in searchable
        ]

        if matched_keywords:
            item = dict(stat)
            item["matched_keywords"] = matched_keywords
            matches.append(item)

    return matches


def print_summary(
    groups: list[dict[str, Any]],
    all_stats: list[dict[str, Any]],
    tablet_stats: list[dict[str, Any]],
) -> None:
    print()
    print("=" * 70)
    print("PoE 2 Stats 获取完成")
    print("=" * 70)
    print(f"Stat Groups: {len(groups)}")
    print(f"All Stats  : {len(all_stats)}")
    print(f"Tablet Hit : {len(tablet_stats)}")

    print()
    print("输出文件:")
    print(f"  原始数据    : {RAW_FILE}")
    print(f"  全部 Stats  : {ALL_STATS_FILE}")
    print(f"  Tablet 候选 : {TABLET_STATS_FILE}")

    if not tablet_stats:
        print()
        print("没有通过当前关键词找到 Tablet Stats。")
        print("这不代表 PoE 2 没有碑牌词缀；下一版会结合 data/items 和")
        print("data/filters 做更准确的 Tablet 分类。")
        return

    print()
    print("-" * 70)
    print("可能的 Tablet / Precursor 相关 Stats（前 30 条）")
    print("-" * 70)

    for index, stat in enumerate(tablet_stats[:30], start=1):
        print()
        print(f"[{index}]")
        print(f"ID    : {stat.get('id')}")
        print(f"Group : {stat.get('group_label')}")
        print(f"Type  : {stat.get('type')}")
        print(f"Text  : {stat.get('text')}")
        print(f"Match : {', '.join(stat.get('matched_keywords', []))}")

    if len(tablet_stats) > 30:
        print()
        print(f"... 还有 {len(tablet_stats) - 30} 条，请查看 {TABLET_STATS_FILE}")


def main() -> None:
    print()
    print("=" * 70)
    print("PoE 2 Tablet Market - Stats Collector")
    print("=" * 70)
    print()
    print("本程序当前只获取 PoE 2 Trade Stats。")
    print("不会查询价格，不会使用 POESESSID。")
    print()

    ensure_data_dir()

    raw_data = fetch_stats()
    save_json(RAW_FILE, raw_data)
    print(f"[OK] 原始 Stats 已保存: {RAW_FILE}")

    groups = extract_stats(raw_data)

    all_stats = flatten_stats(groups)
    save_json(ALL_STATS_FILE, all_stats)
    print(f"[OK] 全部 Stats 已保存: {ALL_STATS_FILE}")

    tablet_stats = find_tablet_stats(all_stats)
    save_json(TABLET_STATS_FILE, tablet_stats)
    print(f"[OK] Tablet 候选 Stats 已保存: {TABLET_STATS_FILE}")

    print_summary(groups, all_stats, tablet_stats)

    print()
    print("=" * 70)
    print("完成")
    print("=" * 70)


if __name__ == "__main__":
    main()
