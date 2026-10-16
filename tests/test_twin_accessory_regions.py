"""Host accessory API remains a thin compatible engine delegation."""
import unittest

from domain import ValidationError
from twins import clean_accessories
from vendor.album_engine.contracts import clean_accessories as engine_clean_accessories


class AccessoryCompatibilityTests(unittest.TestCase):
    def test_public_function_delegates_and_translates_domain_error(self):
        self.assertIs(clean_accessories.__wrapped__, engine_clean_accessories)
        self.assertEqual(clean_accessories([], {}), [])
        with self.assertRaises(ValidationError):
            clean_accessories([{'id': 'obi', 'kind': 'obi', 'sourceId': 'missing'}], {})


if __name__ == '__main__':
    unittest.main()
