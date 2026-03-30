"""Prokerala Panchang aggregation service."""
import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional, Tuple

import requests

from config.settings import settings
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class ProkeralaPanchangService:
    """Handles auth, data fetch, and caching for Prokerala Panchang endpoints."""

    ENDPOINTS = {
        "panchang_advanced": "/v2/astrology/panchang/advanced",
        "choghadiya": "/v2/astrology/choghadiya",
        "chandra_bala": "/v2/astrology/chandra-bala",
        "tara_bala": "/v2/astrology/tara-bala",
        "auspicious_period": "/v2/astrology/auspicious-period",
        "inauspicious_period": "/v2/astrology/inauspicious-period",
        "hora": "/v2/astrology/hora",
        "solstice": "/v2/astrology/solstice",
        "ritu": "/v2/astrology/ritu",
        "disha_shool": "/v2/astrology/disha-shool",
        "auspicious_yoga": "/v2/astrology/auspicious-yoga",
        "gowri_nalla_neram": "/v2/astrology/gowri-nalla-neram",
    }
    ENDPOINT_LABELS = {
        "panchang_advanced": "Advanced Panchang",
        "choghadiya": "Choghadiya",
        "chandra_bala": "Chandra Bala",
        "tara_bala": "Tara Bala",
        "auspicious_period": "Auspicious Period",
        "inauspicious_period": "Inauspicious Period",
        "hora": "Hora",
        "solstice": "Solstice",
        "ritu": "Ritu",
        "disha_shool": "Disha Shool",
        "auspicious_yoga": "Auspicious Yoga",
        "gowri_nalla_neram": "Gowri Nalla Neram",
    }
    DEFAULT_ENDPOINTS = [
        "panchang_advanced",
    ]
    ENDPOINT_PRIORITY = [
        "panchang_advanced",
        "choghadiya",
        "auspicious_period",
        "inauspicious_period",
        "auspicious_yoga",
        "disha_shool",
        "ritu",
        "solstice",
        "hora",
        "chandra_bala",
        "tara_bala",
        "gowri_nalla_neram",
    ]

    def __init__(self):
        self._token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._token_lock = asyncio.Lock()
        self._request_lock = asyncio.Lock()
        self._last_provider_call_at: Optional[datetime] = None

    @staticmethod
    def _round_coords(lat: float, lng: float) -> Tuple[float, float]:
        return round(lat, 3), round(lng, 3)

    def _cache_key(self, lat: float, lng: float, date_str: str, endpoint_keys: List[str]) -> str:
        rounded_lat, rounded_lng = self._round_coords(lat, lng)
        endpoint_suffix = ",".join(endpoint_keys)
        return f"prokerala:panchang:{date_str}:{rounded_lat}:{rounded_lng}:{endpoint_suffix}"

    @staticmethod
    def _seconds_until_next_midnight_utc() -> int:
        now = datetime.utcnow()
        next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return max(60, int((next_midnight - now).total_seconds()))

    async def _get_access_token(self) -> str:
        if not settings.PROKERALA_CLIENT_ID or not settings.PROKERALA_CLIENT_SECRET:
            raise ValueError("Prokerala credentials missing: set PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET")

        now = datetime.utcnow()
        if self._token and self._token_expires_at and now < self._token_expires_at:
            return self._token

        async with self._token_lock:
            now = datetime.utcnow()
            if self._token and self._token_expires_at and now < self._token_expires_at:
                return self._token

            token_url = f"{settings.PROKERALA_BASE_URL}/token"
            payload = {
                "grant_type": "client_credentials",
                "client_id": settings.PROKERALA_CLIENT_ID,
                "client_secret": settings.PROKERALA_CLIENT_SECRET,
            }

            def _request_token():
                return requests.post(token_url, data=payload, timeout=20)

            response = await asyncio.to_thread(_request_token)
            if response.status_code >= 400:
                raise ValueError(f"Prokerala token request failed: {response.status_code} {response.text}")

            token_data = response.json()
            access_token = token_data.get("access_token")
            expires_in = int(token_data.get("expires_in", 3600))

            if not access_token:
                raise ValueError("Prokerala token response missing access_token")

            self._token = access_token
            self._token_expires_at = datetime.utcnow() + timedelta(seconds=max(60, expires_in - 60))
            return access_token

    async def _fetch_endpoint(
        self,
        endpoint: str,
        token: str,
        lat: float,
        lng: float,
        date_str: str,
        tz: str,
    ) -> Dict[str, Any]:
        url = f"{settings.PROKERALA_BASE_URL}{endpoint}"
        query_datetime = f"{date_str}T00:00:00+05:30"
        try:
            local_dt = datetime.fromisoformat(f"{date_str}T00:00:00")
            local_dt = local_dt.replace(tzinfo=ZoneInfo(tz))
            query_datetime = local_dt.isoformat()
        except Exception:
            logger.warning("Failed to compute timezone-aware datetime for %s, falling back to +05:30", tz)

        query = {
            "coordinates": f"{lat},{lng}",
            "datetime": query_datetime,
            "timezone": tz,
            "ayanamsa": 1,
        }
        headers = {"Authorization": f"Bearer {token}"}

        def _request_data():
            return requests.get(url, headers=headers, params=query, timeout=25)

        response = await asyncio.to_thread(_request_data)
        if response.status_code >= 400:
            raise ValueError(f"{response.status_code}: {response.text}")

        return response.json()

    async def _respect_provider_rate_limit(self):
        min_gap = max(0.2, float(settings.PROKERALA_MIN_REQUEST_GAP_SECONDS))
        async with self._request_lock:
            if self._last_provider_call_at is not None:
                elapsed = (datetime.utcnow() - self._last_provider_call_at).total_seconds()
                wait_seconds = max(0, min_gap - elapsed)
                if wait_seconds > 0:
                    await asyncio.sleep(wait_seconds)
            self._last_provider_call_at = datetime.utcnow()

    @staticmethod
    def _unwrap_source_data(source: Any) -> Any:
        if isinstance(source, dict) and isinstance(source.get("data"), dict):
            return source["data"]
        return source

    @classmethod
    def _get_nested_value(cls, source: Any, *path: str) -> Any:
        pointer = cls._unwrap_source_data(source)
        for key in path:
            if not isinstance(pointer, dict) or pointer.get(key) is None:
                return None
            pointer = pointer.get(key)
        return pointer

    @classmethod
    def _pick_first_value(cls, source: Any, paths: Tuple[Tuple[str, ...], ...]) -> Any:
        for path in paths:
            value = cls._get_nested_value(source, *path)
            if value not in (None, "", [], {}):
                return value
        return None

    @staticmethod
    def _format_time_value(value: Any) -> Optional[str]:
        if value in (None, ""):
            return None
        if isinstance(value, str):
            stripped = value.strip()
            for parser in (
                lambda v: datetime.fromisoformat(v.replace("Z", "+00:00")),
                lambda v: datetime.strptime(v, "%H:%M:%S"),
                lambda v: datetime.strptime(v, "%H:%M"),
            ):
                try:
                    return parser(stripped).strftime("%I:%M %p").lstrip("0")
                except Exception:
                    continue
            return stripped
        return str(value)

    @classmethod
    def _format_value(cls, value: Any) -> Optional[str]:
        if value in (None, ""):
            return None
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            return value.strip() or None
        if isinstance(value, list):
            formatted_items = [cls._format_value(item) for item in value[:3]]
            cleaned_items = [item for item in formatted_items if item]
            return ", ".join(cleaned_items) if cleaned_items else None
        if isinstance(value, dict):
            start = cls._pick_first_value(value, (("start",), ("start_time",), ("from",)))
            end = cls._pick_first_value(value, (("end",), ("end_time",), ("to",)))
            if start or end:
                start_text = cls._format_time_value(start) or "-"
                end_text = cls._format_time_value(end) or "-"
                return f"{start_text} - {end_text}"
            for key in ("name", "title", "result", "status", "direction", "description", "value"):
                candidate = value.get(key)
                if candidate not in (None, "", [], {}):
                    return cls._format_value(candidate)
            compact_pairs = []
            for key, item in value.items():
                if len(compact_pairs) >= 2:
                    break
                formatted = cls._format_value(item)
                if formatted:
                    compact_pairs.append(f"{key.replace('_', ' ').title()}: {formatted}")
            return ", ".join(compact_pairs) if compact_pairs else None
        return str(value)

    @classmethod
    def _extract_named_interval_parts(cls, value: Any) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        if not isinstance(value, dict):
            return None, None, None

        name = cls._format_value(value.get("name"))
        start_time = cls._format_time_value(cls._pick_first_value(value, (("start",), ("start_time",), ("from",))))
        end_time = cls._format_time_value(cls._pick_first_value(value, (("end",), ("end_time",), ("to",))))
        if name or start_time or end_time:
            return name, start_time, end_time

        for nested_key in ("current", "details", "value", "data", "item", "active", "present"):
            nested_value = value.get(nested_key)
            if isinstance(nested_value, dict):
                nested_parts = cls._extract_named_interval_parts(nested_value)
                if any(nested_parts):
                    return nested_parts

        for nested_value in value.values():
            if isinstance(nested_value, dict):
                nested_parts = cls._extract_named_interval_parts(nested_value)
                if any(nested_parts):
                    return nested_parts

        return None, None, None

    @classmethod
    def _format_named_interval(cls, source: Any, field: str) -> Optional[str]:
        item = cls._pick_first_value(source, ((field,),))
        if item in (None, "", [], {}):
            return None

        if not isinstance(item, dict):
            return cls._format_value(item)

        name, start_time, end_time = cls._extract_named_interval_parts(item)

        if name and start_time and end_time:
            return f"{name} ({start_time} - {end_time})"
        if name and end_time:
            return f"{name} until {end_time}"
        if name:
            return name
        if start_time and end_time:
            return f"{start_time} - {end_time}"
        return cls._format_value(item)

    @classmethod
    def _build_summary_rows(cls, sources: Dict[str, Any]) -> Dict[str, Any]:
        panchang = cls._unwrap_source_data(sources.get("panchang_advanced"))
        choghadiya = cls._unwrap_source_data(sources.get("choghadiya"))
        auspicious_period = cls._unwrap_source_data(sources.get("auspicious_period"))
        inauspicious_period = cls._unwrap_source_data(sources.get("inauspicious_period"))
        auspicious_yoga = cls._unwrap_source_data(sources.get("auspicious_yoga"))
        disha_shool = cls._unwrap_source_data(sources.get("disha_shool"))
        ritu = cls._unwrap_source_data(sources.get("ritu"))
        solstice = cls._unwrap_source_data(sources.get("solstice"))
        chandra_bala = cls._unwrap_source_data(sources.get("chandra_bala"))
        tara_bala = cls._unwrap_source_data(sources.get("tara_bala"))

        def row(label: str, value: Any) -> Optional[Dict[str, str]]:
            formatted = cls._format_value(value)
            if not formatted:
                return None
            return {"label": label, "value": formatted}

        def period_row(label: str, source: Any) -> Optional[Dict[str, str]]:
            rows = cls._flatten_for_display(source)
            if not rows:
                return None
            first = rows[0]
            formatted = f"{first.get('label', label)}: {first.get('value', '-')}"
            return row(label, formatted)

        overview_candidates = [
            row("Tithi", cls._format_named_interval(panchang, "tithi")),
            row("Paksha", cls._pick_first_value(panchang, (("paksha",), ("lunar_month", "paksha")))),
            row("Nakshatra", cls._format_named_interval(panchang, "nakshatra")),
            row("Yoga", cls._format_named_interval(panchang, "yoga")),
            row("Karana", cls._format_named_interval(panchang, "karana")),
        ]
        timing_candidates = [
            row("Sunrise", cls._format_time_value(cls._pick_first_value(panchang, (("sunrise",), ("sunrise_time",))))),
            row("Sunset", cls._format_time_value(cls._pick_first_value(panchang, (("sunset",), ("sunset_time",))))),
            row("Moonrise", cls._format_time_value(cls._pick_first_value(panchang, (("moonrise",), ("moonrise_time",))))),
            row("Moonset", cls._format_time_value(cls._pick_first_value(panchang, (("moonset",), ("moonset_time",))))),
            row("Rahu Kaal", cls._pick_first_value(choghadiya, (("rahu_kalam",), ("rahu_kaal",)))),
            row("Gulika Kaal", cls._pick_first_value(choghadiya, (("gulika_kalam",), ("gulika_kaal",)))),
            row("Yamaganda", cls._pick_first_value(choghadiya, (("yamaganda_kalam",), ("yamaganda",)))),
        ]
        insight_candidates = [
            row("Auspicious Yoga", cls._pick_first_value(auspicious_yoga, (("result",), ("name",), ("status",)))),
            period_row("Auspicious Period", auspicious_period),
            period_row("Inauspicious Period", inauspicious_period),
            row("Disha Shool", cls._pick_first_value(disha_shool, (("direction",), ("name",), ("result",)))),
            row("Ritu", cls._pick_first_value(ritu, (("name",), ("ritu",), ("season",)))),
            row("Solstice", cls._pick_first_value(solstice, (("name",), ("event",), ("type",)))),
            row("Chandra Bala", cls._pick_first_value(chandra_bala, (("result",), ("prediction",), ("status",)))),
            row("Tara Bala", cls._pick_first_value(tara_bala, (("result",), ("prediction",), ("status",)))),
        ]

        overview = [item for item in overview_candidates if item]
        timings = [item for item in timing_candidates if item]
        insights = [item for item in insight_candidates if item]

        headline_parts = [item["value"] for item in overview[:2]]
        return {
            "headline": " | ".join(headline_parts) if headline_parts else None,
            "overview": overview,
            "timings": timings,
            "insights": insights,
        }

    @classmethod
    def _normalize_endpoint_keys(cls, endpoint_keys: Optional[List[str]]) -> List[str]:
        candidates = endpoint_keys or cls.DEFAULT_ENDPOINTS
        normalized: List[str] = []
        for key in candidates:
            if key in cls.ENDPOINTS and key not in normalized:
                normalized.append(key)

        if "panchang_advanced" not in normalized and not endpoint_keys:
            normalized.insert(0, "panchang_advanced")

        if not normalized:
            normalized = list(cls.DEFAULT_ENDPOINTS)

        prioritized = [key for key in cls.ENDPOINT_PRIORITY if key in normalized]
        max_endpoints = max(1, int(settings.PROKERALA_MAX_ENDPOINTS_PER_CALL))
        return prioritized[:max_endpoints]

    @classmethod
    def _build_available_endpoints(cls) -> List[Dict[str, str]]:
        return [
            {"key": key, "label": cls.ENDPOINT_LABELS.get(key, key.replace("_", " ").title())}
            for key in cls.ENDPOINT_PRIORITY
            if key != "panchang_advanced"
        ]

    @classmethod
    def _flatten_for_display(cls, value: Any, prefix: str = "") -> List[Dict[str, str]]:
        rows: List[Dict[str, str]] = []
        if value in (None, "", [], {}):
            return rows

        if isinstance(value, dict):
            if "data" in value and isinstance(value.get("data"), dict):
                return cls._flatten_for_display(value["data"], prefix)

            start = cls._pick_first_value(value, (("start",), ("start_time",), ("from",)))
            end = cls._pick_first_value(value, (("end",), ("end_time",), ("to",)))
            if prefix and (start or end):
                rows.append({
                    "label": prefix,
                    "value": f"{cls._format_time_value(start) or '-'} - {cls._format_time_value(end) or '-'}",
                })
                return rows

            for key, item in value.items():
                label = key.replace("_", " ").title()
                full_label = f"{prefix} {label}".strip()
                if isinstance(item, (dict, list)):
                    rows.extend(cls._flatten_for_display(item, full_label))
                    continue
                formatted = cls._format_value(item)
                if formatted:
                    rows.append({"label": full_label, "value": formatted})
            return rows[:20]

        if isinstance(value, list):
            for index, item in enumerate(value[:10], start=1):
                item_prefix = f"{prefix} {index}".strip()
                rows.extend(cls._flatten_for_display(item, item_prefix))
            return rows[:20]

        formatted = cls._format_value(value)
        if formatted:
            rows.append({"label": prefix or "Value", "value": formatted})
        return rows

    @classmethod
    def _build_detail_sections(cls, sources: Dict[str, Any]) -> List[Dict[str, Any]]:
        sections: List[Dict[str, Any]] = []
        for key in cls.ENDPOINT_PRIORITY:
            if key not in sources:
                continue
            rows = cls._flatten_for_display(sources[key])
            sections.append({
                "key": key,
                "title": cls.ENDPOINT_LABELS.get(key, key.replace("_", " ").title()),
                "rows": rows,
            })
        return sections

    @staticmethod
    def _is_sandbox_date_error(error_text: str) -> bool:
        normalized = (error_text or "").lower()
        return "sandbox" in normalized and "jan" in normalized and "1" in normalized

    def _normalize_date_for_sandbox(self, date_str: str) -> str:
        if not settings.PROKERALA_SANDBOX_MODE:
            return date_str
        year = datetime.utcnow().year
        try:
            year = datetime.strptime(date_str, "%Y-%m-%d").year
        except Exception:
            pass
        return f"{year}-01-01"

    def _build_empty_payload(self, lat: float, lng: float, date_str: str, tz: str) -> Dict[str, Any]:
        return {
            "date": date_str,
            "coordinates": {"latitude": lat, "longitude": lng},
            "timezone": tz,
            "sources": {},
            "errors": {},
            "summary": {
                "headline": None,
                "overview": [],
                "timings": [],
                "insights": [],
            },
            "fetched_at": datetime.utcnow().isoformat() + "Z",
        }

    async def _fetch_single_endpoint_with_retry(
        self,
        endpoint_key: str,
        endpoint_path: str,
        token: str,
        lat: float,
        lng: float,
        date_str: str,
        tz: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], str]:
        await self._respect_provider_rate_limit()
        try:
            result = await self._fetch_endpoint(endpoint_path, token, lat, lng, date_str, tz)
            return result, None, date_str
        except Exception as exc:
            error_text = str(exc)
            if self._is_sandbox_date_error(error_text):
                retry_date = self._normalize_date_for_sandbox(date_str)
                await self._respect_provider_rate_limit()
                try:
                    result = await self._fetch_endpoint(endpoint_path, token, lat, lng, retry_date, tz)
                    return result, None, retry_date
                except Exception as retry_exc:
                    return None, str(retry_exc), retry_date
            return None, error_text, date_str

    async def _fetch_progressively(
        self,
        lat: float,
        lng: float,
        date_str: str,
        tz: str,
        force_refresh: bool,
        endpoint_keys: List[str],
    ) -> Dict[str, Any]:
        cache_key = self._cache_key(lat, lng, date_str, endpoint_keys)
        payload = self._build_empty_payload(lat, lng, date_str, tz)

        token = await self._get_access_token()
        all_keys = endpoint_keys
        endpoint_results = {}
        endpoint_errors = {}
        effective_date = date_str

        for endpoint_key in all_keys:
            endpoint_path = self.ENDPOINTS[endpoint_key]
            result, error_text, used_date = await self._fetch_single_endpoint_with_retry(
                endpoint_key=endpoint_key,
                endpoint_path=endpoint_path,
                token=token,
                lat=lat,
                lng=lng,
                date_str=effective_date,
                tz=tz,
            )

            effective_date = used_date
            if result is not None:
                endpoint_results[endpoint_key] = result
            else:
                endpoint_errors[endpoint_key] = error_text or "Unknown provider error"

        payload["date"] = effective_date
        payload["sources"] = endpoint_results
        payload["errors"] = endpoint_errors
        payload["fetched_at"] = datetime.utcnow().isoformat() + "Z"
        payload["summary"] = self._build_summary_rows(endpoint_results)
        payload["detail_sections"] = self._build_detail_sections(endpoint_results)
        payload["available_endpoints"] = self._build_available_endpoints()

        payload["meta"] = {
            "endpoints_total": len(all_keys),
            "endpoints_loaded": len(endpoint_results),
            "endpoints_pending": max(0, len(all_keys) - len(endpoint_results)),
            "is_complete": len(endpoint_results) == len(all_keys),
            "request_gap_seconds": max(0.2, float(settings.PROKERALA_MIN_REQUEST_GAP_SECONDS)),
            "max_endpoints_per_call": max(1, int(settings.PROKERALA_MAX_ENDPOINTS_PER_CALL)),
            "sandbox_mode": settings.PROKERALA_SANDBOX_MODE,
            "endpoints_requested": all_keys,
        }

        if payload["meta"]["is_complete"]:
            ttl = self._seconds_until_next_midnight_utc()
            await cache_manager.set(cache_key, payload, ttl=ttl)

        return payload

    async def get_aggregated_panchang(
        self,
        lat: float,
        lng: float,
        date_str: Optional[str] = None,
        force_refresh: bool = False,
        tz: Optional[str] = None,
        endpoint_keys: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        raw_target_date = date_str or datetime.utcnow().strftime("%Y-%m-%d")
        target_date = self._normalize_date_for_sandbox(raw_target_date)
        timezone = tz or settings.PROKERALA_DEFAULT_TZ
        normalized_endpoint_keys = self._normalize_endpoint_keys(endpoint_keys)
        cache_key = self._cache_key(lat, lng, target_date, normalized_endpoint_keys)
        cached = None

        if not force_refresh:
            cached = await cache_manager.get(cache_key)
            if isinstance(cached, dict) and cached.get('meta', {}).get('is_complete'):
                meta = cached.get('meta', {})
                summary = self._build_summary_rows(cached.get("sources", {}))
                detail_sections = cached.get("detail_sections")
                if not isinstance(detail_sections, list):
                    detail_sections = self._build_detail_sections(cached.get("sources", {}))
                return {
                    **cached,
                    "summary": summary,
                    "detail_sections": detail_sections,
                    "available_endpoints": self._build_available_endpoints(),
                    "cache": {
                        "hit": True,
                        "key": cache_key,
                    },
                    "meta": {
                        **meta,
                        "sandbox_mode": settings.PROKERALA_SANDBOX_MODE,
                    },
                }

        try:
            fresh_payload = await self._fetch_progressively(
                lat=lat,
                lng=lng,
                date_str=target_date,
                tz=timezone,
                force_refresh=force_refresh,
                endpoint_keys=normalized_endpoint_keys,
            )
        except Exception:
            if isinstance(cached, dict):
                meta = cached.get('meta', {})
                summary = self._build_summary_rows(cached.get("sources", {}))
                detail_sections = cached.get("detail_sections")
                if not isinstance(detail_sections, list):
                    detail_sections = self._build_detail_sections(cached.get("sources", {}))
                return {
                    **cached,
                    "summary": summary,
                    "detail_sections": detail_sections,
                    "available_endpoints": self._build_available_endpoints(),
                    "cache": {
                        "hit": True,
                        "key": cache_key,
                        "stale": True,
                    },
                    "meta": {
                        **meta,
                        "sandbox_mode": settings.PROKERALA_SANDBOX_MODE,
                    },
                }
            raise

        return {
            **fresh_payload,
            "cache": {
                "hit": False,
                "key": cache_key,
                "ttl_seconds": self._seconds_until_next_midnight_utc(),
            },
        }

    async def prewarm_user_locations(self, db) -> Dict[str, int]:
        users = await db.query_documents("users", limit=500)
        unique_coords = set()

        for user in users:
            home_location = user.get("home_location") or user.get("location") or {}
            lat = home_location.get("latitude")
            lng = home_location.get("longitude")
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                unique_coords.add(self._round_coords(float(lat), float(lng)))

        success_count = 0
        fail_count = 0

        for lat, lng in unique_coords:
            try:
                await self.get_aggregated_panchang(lat=lat, lng=lng, force_refresh=True)
                success_count += 1
            except Exception as exc:
                logger.warning("Prefetch failed for %s,%s: %s", lat, lng, exc)
                fail_count += 1

        return {
            "locations_total": len(unique_coords),
            "locations_success": success_count,
            "locations_failed": fail_count,
        }


prokerala_panchang_service = ProkeralaPanchangService()
