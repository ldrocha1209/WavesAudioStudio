from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, TextIO

from . import PROTOCOL_VERSION

MAX_MESSAGE_BYTES = 64 * 1024


class ProtocolError(ValueError):
    """Raised when an IPC message violates the Phase 0 protocol."""


@dataclass(frozen=True)
class Request:
    type: str
    request_id: str
    payload: dict[str, Any]


def parse_request(line: str) -> Request:
    if len(line.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ProtocolError("message_too_large")

    try:
        raw = json.loads(line)
    except json.JSONDecodeError as exc:
        raise ProtocolError("invalid_json") from exc

    if not isinstance(raw, dict):
        raise ProtocolError("message_must_be_object")
    if raw.get("protocol") != PROTOCOL_VERSION:
        raise ProtocolError("unsupported_protocol")

    message_type = raw.get("type")
    request_id = raw.get("requestId")
    payload = raw.get("payload", {})
    if not isinstance(message_type, str) or not message_type:
        raise ProtocolError("invalid_type")
    if not isinstance(request_id, str) or not request_id or len(request_id) > 128:
        raise ProtocolError("invalid_request_id")
    if not isinstance(payload, dict):
        raise ProtocolError("invalid_payload")

    return Request(message_type, request_id, payload)


def write_message(stream: TextIO, message: dict[str, Any]) -> None:
    encoded = json.dumps(
        {"protocol": PROTOCOL_VERSION, **message},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    if len(encoded.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ProtocolError("outgoing_message_too_large")
    stream.write(encoded + "\n")
    stream.flush()
