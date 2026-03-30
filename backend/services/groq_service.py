"""AI summary service using Groq."""
from typing import Any, Dict, List
from groq import Groq

from config.settings import settings


def _panchang_payload_to_prompt(payload: dict) -> str:
    if not payload:
        return "No Panchang data available."

    sources = payload.get('sources', {}) or {}
    summary = payload.get('summary', {}) or {}
    detail_sections = payload.get('detail_sections', []) or []
    panchang_data = sources.get('panchang_advanced', {})
    auspicious_period = sources.get('auspicious_period', {})
    inauspicious_period = sources.get('inauspicious_period', {})
    if isinstance(panchang_data, dict) and 'data' in panchang_data:
        panchang_data = panchang_data['data']
    if isinstance(auspicious_period, dict) and 'data' in auspicious_period:
        auspicious_period = auspicious_period['data']
    if isinstance(inauspicious_period, dict) and 'data' in inauspicious_period:
        inauspicious_period = inauspicious_period['data']

    lines = []
    lines.append(f"Date: {payload.get('date', '-')}")
    lines.append(f"Timezone: {payload.get('timezone', '-')}")
    if payload.get('coordinates'):
        lines.append(f"Coordinates: {payload.get('coordinates')}")

    headline = summary.get('headline')
    if headline:
        lines.append(f"Headline: {headline}")

    for section_name in ('overview', 'timings', 'insights'):
        section_rows = summary.get(section_name)
        if isinstance(section_rows, list) and section_rows:
            lines.append(section_name.upper())
            lines.extend(_rows_to_lines(section_rows))

    if not panchang_data:
        lines.append('No panchang_advanced section available.')
    else:
        def choose_first(field):
            val = panchang_data.get(field)
            if isinstance(val, list) and val:
                return val[0]
            return val

        for key in ['tithi', 'nakshatra', 'yoga', 'karana', 'paksha', 'vaara', 'sunrise', 'sunset', 'moonrise', 'moonset']:
            v = choose_first(key)
            if isinstance(v, dict):
                name = v.get('name')
                start = v.get('start')
                end = v.get('end')
                if name:
                    lines.append(f"{key.title()}: {name} ({start or '-'} - {end or '-'})")
                else:
                    lines.append(f"{key.title()}: {v}")
            else:
                lines.append(f"{key.title()}: {v}")

    if isinstance(detail_sections, list):
        for section in detail_sections[:8]:
            title = section.get('title') or section.get('key') or 'Section'
            rows = section.get('rows') or []
            if rows:
                lines.append(f"{title.upper()}")
                lines.extend(_rows_to_lines(rows))

    def _append_raw_period_section(title: str, source: Any):
        if not source:
            return

        def visit(node: Any, prefix: str = ""):
            if node in (None, "", [], {}):
                return
            if isinstance(node, list):
                for item in node[:8]:
                    visit(item, prefix)
                return
            if not isinstance(node, dict):
                if prefix:
                    lines.append(f"{prefix}: {node}")
                return

            name = node.get("name") or node.get("title") or node.get("label")
            start = node.get("start") or node.get("start_time") or node.get("from")
            end = node.get("end") or node.get("end_time") or node.get("to")
            if name and (start or end):
                lines.append(f"{name}: {start or '-'} - {end or '-'}")

            for key, value in list(node.items())[:16]:
                next_prefix = str(name or prefix or key).replace("_", " ").title()
                if isinstance(value, (dict, list)):
                    visit(value, next_prefix)
                elif value not in (None, "", [], {}):
                    lines.append(f"{next_prefix} {str(key).replace('_', ' ').title()}: {value}")

        lines.append(title)
        visit(source)

    _append_raw_period_section("AUSPICIOUS PERIOD RAW", auspicious_period)
    _append_raw_period_section("INAUSPICIOUS PERIOD RAW", inauspicious_period)

    return '\n'.join(lines)


def _rows_to_lines(rows: List[Dict[str, str]]) -> List[str]:
    output: List[str] = []
    for row in rows[:12]:
        label = row.get('label')
        value = row.get('value')
        if label and value:
            output.append(f"{label}: {value}")
    return output


def _astrology_payload_to_prompt(payload: dict) -> str:
    if not payload:
        return "No astrology data available."

    summary = payload.get('summary', {}) or {}
    detail_sections = payload.get('detail_sections', []) or []
    lines = [
        f"Datetime: {payload.get('datetime', '-')}",
        f"Timezone: {payload.get('timezone', '-')}",
        f"Ayanamsa: {payload.get('ayanamsa', '-')}",
        f"Coordinates: {payload.get('coordinates', {})}",
    ]

    headline = summary.get('headline')
    if headline:
        lines.append(f"Headline: {headline}")

    for section_name in ('overview', 'highlights', 'insights'):
        section_rows = summary.get(section_name)
        if isinstance(section_rows, list) and section_rows:
            lines.append(section_name.upper())
            lines.extend(_rows_to_lines(section_rows))

    if isinstance(detail_sections, list):
        for section in detail_sections[:6]:
            title = section.get('title') or section.get('key') or 'Section'
            rows = section.get('rows') or []
            if rows:
                lines.append(f"{title.upper()}")
                lines.extend(_rows_to_lines(rows))

    return '\n'.join(lines)


class GroqService:
    def __init__(self):
        if not settings.GROQ_API_KEY:
            raise ValueError('GROQ_API_KEY is not configured in settings')
        self.client = Groq(api_key=settings.GROQ_API_KEY)

    def _create_chat_completion(self, system_content: str, user_content: str, max_completion_tokens: int = 300) -> str:
        completion = self.client.chat.completions.create(
            messages=[
                {'role': 'system', 'content': system_content},
                {'role': 'user', 'content': user_content},
            ],
            model='llama-3.3-70b-versatile',
            temperature=0.38,
            max_completion_tokens=max_completion_tokens,
            top_p=1,
            stream=False,
        )

        if isinstance(completion, dict):
            choices = completion.get('choices')
            if choices and len(choices) > 0:
                chunk = choices[0]
                msg = chunk.get('message')
                if isinstance(msg, dict):
                    text = msg.get('content')
                else:
                    text = chunk.get('text')
                if text:
                    return text

        if hasattr(completion, 'choices'):
            choices = completion.choices
            if choices and len(choices) > 0:
                first = choices[0]
                if hasattr(first, 'message') and first.message is not None:
                    msg = first.message
                    if isinstance(msg, dict):
                        text = msg.get('content')
                    else:
                        text = getattr(msg, 'content', None)
                    if text:
                        return text
                if hasattr(first, 'text'):
                    text = getattr(first, 'text', None)
                    if text:
                        return text

        return ''

    def summarize_panchang(self, payload: dict) -> str:
        prompt_text = _panchang_payload_to_prompt(payload)
        text = self._create_chat_completion(
            system_content='You are a helpful assistant summarizing Panchang data.',
            user_content=f'Summarize the following Panchang data in simple Hindi/English a few lines:\n{prompt_text}',
            max_completion_tokens=300,
        )
        return text or 'Unable to parse Groq summary response.'

    def summarize_astrology(self, payload: dict) -> str:
        prompt_text = _astrology_payload_to_prompt(payload)
        text = self._create_chat_completion(
            system_content='You are a helpful Vedic astrology assistant. Summarize the supplied astrology data clearly, gently, and without making extreme deterministic claims.',
            user_content=(
                'Summarize this astrology page in simple Hindi/English. '
                'Mention the main birth details, kundli highlights, and any notable themes in 5-8 short lines.\n'
                f'{prompt_text}'
            ),
            max_completion_tokens=380,
        )
        return text or 'Unable to parse Groq astrology summary response.'

    def answer_astrology_question(self, payload: dict, question: str) -> str:
        prompt_text = _astrology_payload_to_prompt(payload)
        text = self._create_chat_completion(
            system_content=(
                'You are a grounded Vedic astrology assistant. '
                'Answer only from the supplied astrology data. If the data is missing, say so plainly. '
                'Keep answers helpful, non-alarmist, and concise.'
            ),
            user_content=(
                f'Astrology page data:\n{prompt_text}\n\n'
                f'User question: {question}\n\n'
                'Answer in simple Hindi/English. Reference only what is supported by the data on this page.'
            ),
            max_completion_tokens=420,
        )
        return text or 'Unable to parse Groq astrology answer response.'

    def answer_panchang_question(self, payload: dict, question: str) -> str:
        prompt_text = _panchang_payload_to_prompt(payload)
        text = self._create_chat_completion(
            system_content=(
                'You are a grounded Panchang assistant. '
                'Answer only from the supplied Panchang data. If the data is missing, say so plainly. '
                'Read the auspicious_period and inauspicious_period sections carefully when answering about good or avoid times. '
                'Keep answers practical, calm, and easy to understand.'
            ),
            user_content=(
                f'Panchang page data:\n{prompt_text}\n\n'
                f'User question: {question}\n\n'
                'Answer in simple Hindi/English. Reference only what is supported by the Panchang data on this page. '
                'When possible, mention the exact period name and exact time window.'
            ),
            max_completion_tokens=420,
        )
        return text or 'Unable to parse Groq Panchang answer response.'



def get_groq_service() -> GroqService:
    return GroqService()
