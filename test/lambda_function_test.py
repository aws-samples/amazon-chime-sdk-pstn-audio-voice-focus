# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this
# software and associated documentation files (the "Software"), to deal in the Software
# without restriction, including without limitation the rights to use, copy, modify,
# merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#

from jsonschema import validate
import os
import sys
import unittest


class Test_Lambda_Function(unittest.TestCase):
    basic_schema = {
        "required": [
            "SchemaVersion",
            "Actions"
        ],
        "properties": {
            "SchemaVersion": {
                "type": "string",
                "const": "1.0"
            }
        }
    }

    def setUp(self) -> None:
        super().setUp()

        # add ./src
        sys.path.append('./src')
        os.environ.pop('LogLevel', None)

        # set default env vars
        os.environ['WAVFILE_BUCKET'] = 'fake-bucket'

    def tearDown(self) -> None:
        if 'lambda_function' in sys.modules:
            del sys.modules['lambda_function']

        return super().tearDown()

    #
    # checkers - called by tests
    #

    def check_valid_schema(self, d, s):
        try:
            validate(instance=d, schema=s)
            self.assertTrue(True)
        except Exception as err:
            self.assertTrue(Fals, err)

    def check_schema_10(self, d):
        self.check_valid_schema(d, Test_Lambda_Function.basic_schema)

    def call_and_check(self, event, checks) -> None:
        try:
            from lambda_function import lambda_handler

            resp = lambda_handler(event, None)
            [check(resp) for check in checks]

        except Exception as err:
            self.assertTrue(False, err)

    #
    # tests
    #

    def test_unittest(self):
        self.assertTrue(True)

    def test_load_lambda_function(self):
        from lambda_function import lambda_handler

        self.assertIsNotNone(lambda_handler)

    def test_log_level_set_from_env_var(self):
        import lambda_function
        self.assertEqual(lambda_function.log_level, 'INFO')     # default level

        self.tearDown()                                 # reset import
        os.environ['LogLevel'] = 'DEBUG'
        import lambda_function
        self.assertEqual(lambda_function.log_level,
                         'DEBUG')     # default level

    def test_wav_file_bucket_env_var(self):
        # unset any env var for the bucket
        os.environ.pop('WAVFILE_BUCKET', None)
        self.assertIsNone(os.getenv('WAVFILE_BUCKET', None))

        import lambda_function
        self.assertIsNone(os.getenv('WAVFILE_BUCKET', None))

        # reset it all...
        self.tearDown()
        self.setUp()        # .setUp() sets an env var

        import lambda_function
        self.assertEqual(lambda_function.wav_bucket, 'fake-bucket')

    def test_empty_event(self):
        event = {}
        self.call_and_check(event, [self.check_schema_10])

    def test_new_inbound_call(self):
        event = {
            'InvocationEventType': "NEW_INBOUND_CALL",
            'CallDetails': {
                'Participants': [{
                    'CallId': "xxx-call-id-xxx",
                    'To': "+12125551212",
                    'From': "+12035551212"
                }]
            }
        }
        self.call_and_check(event, [self.check_schema_10])
