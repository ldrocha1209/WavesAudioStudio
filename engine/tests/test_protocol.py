import io
import json
import unittest

from waves_engine.protocol import MAX_MESSAGE_BYTES, ProtocolError, parse_request, write_message


class ProtocolTests(unittest.TestCase):
    def test_parses_valid_request(self):
        request = parse_request('{"protocol":1,"type":"ping","requestId":"r1"}')
        self.assertEqual(request.type, "ping")
        self.assertEqual(request.request_id, "r1")
        self.assertEqual(request.payload, {})

    def test_rejects_wrong_protocol(self):
        with self.assertRaisesRegex(ProtocolError, "unsupported_protocol"):
            parse_request('{"protocol":2,"type":"ping","requestId":"r1"}')

    def test_rejects_oversized_message(self):
        with self.assertRaisesRegex(ProtocolError, "message_too_large"):
            parse_request(" " * (MAX_MESSAGE_BYTES + 1))

    def test_writes_one_compact_line(self):
        output = io.StringIO()
        write_message(output, {"type": "pong", "requestId": "r1"})
        self.assertEqual(
            json.loads(output.getvalue()),
            {"protocol": 1, "type": "pong", "requestId": "r1"},
        )
        self.assertEqual(output.getvalue().count("\n"), 1)


if __name__ == "__main__":
    unittest.main()
