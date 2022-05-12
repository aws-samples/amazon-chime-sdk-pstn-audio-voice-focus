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

import json
import logging
import os


# Set LogLevel using environment variable, fallback to INFO if not present
logger = logging.getLogger()
log_level = os.getenv('LogLevel', 'INFO')
if log_level not in ['INFO', 'DEBUG']:
    log_level = 'INFO'
logger.setLevel(log_level)
global log_prefix 
log_prefix = " - "

# Load environment variables
wav_bucket = os.getenv('WAVFILE_BUCKET', None)


# handler mapping table -- calls the method 'value' for the event 'key'
handlers = {
    'NEW_INBOUND_CALL': lambda call_id, event, participants: new_call_handler(call_id),
    'RINGING': lambda call_id, event, participants: response(),
    'ACTION_SUCCESSFUL': lambda call_id, event, participants: action_success_handler(call_id, event),
    'DIGITS_RECEIVED': lambda call_id, event, participants: control_voicefocus(call_id, event),
    'HANGUP': lambda call_id, event, participants: hangup(participants),
    # 'ACTION_FAILED': lambda call_id, event, participants: (
    #     # logger.error('RECV {} {} {} {}'.format(
    #     #         log_prefix, event['ActionData']['ErrorType'], event['ActionData']['ErrorMessage'], json.dumps(event)))
    #     # return play_error_message(call_id))
    # 'INVALID_LAMBDA_RESPONSE': lambda call_id, event, participants: (
    #     logger.error('RECV {} : {} : {} : {}'.format(
    #             log_prefix, event['ErrorType'], event['ErrorMessage'], json.dumps(event)))
    #     return play_error_message(call_id))
}


# This is the entry point for all incoming events from Chime SipMediaApplications
def lambda_handler(event, context):
    global log_prefix
    resp = response()

    call_id = None
    try:
        event_type = event.get('InvocationEventType', "NO-EVENT")
        participants = event['CallDetails']['Participants']
        call_id = participants[0]['CallId']
        to_number = participants[0]['To']
        from_number = participants[0]['From']

        log_prefix = 'Call-ID:{} {} From:[{}] To:[{}]: '.format(
            call_id, event_type, from_number, to_number)
        logger.info('RECV {} {} {}'.format(
            log_prefix, event_type, 'event received'))

        resp = handlers[event_type](call_id, event, participants)
    except Exception as err:
        logger.error('RECV {} Unhandled event: {} {}'.format(
                log_prefix, event_type, json.dumps(event)))
        if (call_id is not None):
            resp = play_error_message(call_id)

    return resp


# If we receive an ACTION_SUCCESSFUL event we can take further actions,
# or default to responding with a NoOp (empty set of actions)
def action_success_handler(call_id, event):
    action = event['ActionData']['Type']
    if action == 'PlayAudioAndGetDigits':
        return bridge(call_id, event)
    elif action == 'CallAndBridge':
        return enable_voicefocus(event)
    elif action == 'VoiceFocus':
        return enable_dtmf_control(event)
    return response()


# A wrapper for all responses back to the service
def response(*actions):
    return {
        'SchemaVersion': '1.0',
        'Actions': [*actions]
    }


# For new incoming calls, play greeting and collect digits of destination number.
# Regex for digits entered allows US calling, except for premium rate numbers
def new_call_handler(call_id):
    logger.info('SEND {} {}'.format(
        log_prefix, 'Sending PlayAndGetDigits action to get Destination Number'))
    return response(pause_action(call_id), play_and_get_digits_action(call_id, '^(?!1900)1[0-9][0-9][0-9](\d{7})$', 'welcome_vf_demo.wav', 'invalid_entry.wav'))


# We use this function to connect the caller to the new destination number
def bridge(call_id, event):
    logger.info('SEND {} {} {}'.format(
        log_prefix, 'Sending CallAndBridge action to Call-ID', call_id))
    destination_number = '+' + event['ActionData']['ReceivedDigits']
    caller_id = event['CallDetails']['Participants'][0]['To']
    return response(call_and_bridge_action(caller_id, destination_number))


# We turn on VoiceFocus for both calls once the bridge action has been successful
def enable_voicefocus(event):
    logger.info('SEND {} {}'.format(
        log_prefix, 'Sending VoiceFocus command for both participants'))
    actions = []
    for call in event['CallDetails']['Participants']:
        actions.append(voicefocus_action(call['CallId'], 'True'))
    return response(actions[0], actions[1])


# Once Voice Focus has been enabled, we provide the participants the ability to turn it on/off using DTMF tones
def enable_dtmf_control(event):
    logger.info('SEND {} {}'.format(
        log_prefix, 'Enabling VoiceFocus DTMF toggle support for both participants'))
    actions = []
    for call in event['CallDetails']['Participants']:
        actions.append(receive_digits_action(call['CallId'],))
    return response(actions[0], actions[1])


# We disable or enable Voice Focus depending on whether the participant pressed 0 or 1
def control_voicefocus(call_id, event):
    if event['ActionData']['ReceivedDigits'] == '0':
        enabled = False
    elif event['ActionData']['ReceivedDigits'] == '1':
        enabled = True
    # Allow a participant to disable the other participants Voice Focus
    elif event['ActionData']['ReceivedDigits'] == '8':
        call_id_0 = event['CallDetails']['Participants'][0]['CallId']
        if call_id == call_id_0:
            call_id = event['CallDetails']['Participants'][1]['CallId']
        else:
            call_id = call_id_0
        enabled = False
    # Allow a participant to enable the other participants Voice Focus
    elif event['ActionData']['ReceivedDigits'] == '9':
        call_id_0 = event['CallDetails']['Participants'][0]['CallId']
        if call_id == call_id_0:
            call_id = event['CallDetails']['Participants'][1]['CallId']
        else:
            call_id = call_id_0
        enabled = True
    logger.info('SEND {} {}'.format(
        log_prefix, 'Setting VoiceFocus enabled to {} for {}'.format(enabled, call_id)))
    return response(voicefocus_action(call_id, enabled))

# When we receive a hangup event, we make sure to tear down any participants still connected


def hangup(participants):
    for call in participants:
        if call['Status'] == 'Connected':
            return response(hangup_action(call['CallId']))
    logger.info('NONE {} All calls have been hungup'.format(log_prefix))
    return response()


# When something goes wrong, plays an error to the caller and then hangs up
def play_error_message(call_id):
    return response(play_audio_action(call_id, 'unable_to_connect_your_call.wav'), hangup_action(call_id))


# Actions that can be used in response to events

# To read more on customizing the PlayAudioAndGetDigits action, see https://docs.aws.amazon.com/chime/latest/dg/play-audio-get-digits.html
def play_and_get_digits_action(call_id, regex, audio_file, failure_audio_file):
    return {
        'Type': 'PlayAudioAndGetDigits',
        'Parameters': {
                'CallId': call_id,
                'InputDigitsRegex': regex,
                'AudioSource': {
                    'Type': 'S3',
                    'BucketName': wav_bucket,
                    'Key': audio_file
                },
            'FailureAudioSource': {
                    'Type': 'S3',
                    'BucketName': wav_bucket,
                    'Key': failure_audio_file
                    },
            'MinNumberOfDigits': 11,
            'MaxNumberOfDigits': 11,
            'TerminatorDigits': ['#'],
            'InBetweenDigitsDurationInMilliseconds': 5000,
            'Repeat': 2,
            'RepeatDurationInMilliseconds': 10000
        }
    }


# To read more on customizing the CallAndBridge action, see https://docs.aws.amazon.com/chime/latest/dg/call-and-bridge.html
def call_and_bridge_action(caller_id, destination):
    return {
        'Type': 'CallAndBridge',
        'Parameters': {
            'CallTimeoutSeconds': 30,
            'CallerIdNumber': caller_id,
            'Endpoints':
            [
                {
                    'Uri': destination,
                    'BridgeEndpointType': 'PSTN'
                }
            ]
        }
    }


# To read more on customizing the VoiceFocus action, see https://docs.aws.amazon.com/chime/latest/dg/voicefocus.html
def voicefocus_action(call_id, enabled):
    return {
        'Type': 'VoiceFocus',
        "Parameters": {
                'Enable': enabled,
                'CallId': call_id,
        }
    }


# To read more on customizing the ReceiveDigits action, see https://docs.aws.amazon.com/chime/latest/dg/listen-to-digits.html
def receive_digits_action(call_id):
    return {
        'Type': 'ReceiveDigits',
        'Parameters': {
                'CallId': call_id,
                'InputDigitsRegex': '[0-1]$',
                'InBetweenDigitsDurationInMilliseconds': 1000,
                'FlushDigitsDurationInMilliseconds': 10000
        }
    }


# To read more on customizing the PlayAudio action, see https://docs.aws.amazon.com/chime/latest/dg/play-audio.html
def play_audio_action(call_id, audio_file):
    return {
        'Type': 'PlayAudio',
        'Parameters': {
                'CallId': call_id,
                'AudioSource': {
                    'Type': 'S3',
                    'BucketName': wav_bucket,
                    'Key': audio_file
                }
        }
    }


# To read more on customizing the Pause action, see https://docs.aws.amazon.com/chime/latest/dg/pause.html
def pause_action(call_id):
    return {
        'Type': 'Pause',
        'Parameters': {
                'CallId': call_id,
                'DurationInMilliseconds': '3000'
        }
    }


# To read more on customizing the Hangup action, see https://docs.aws.amazon.com/chime/latest/dg/hangup.html
def hangup_action(call_id):
    logger.info('SEND {} {} {}'.format(
        log_prefix, 'Sending HANGUP action to Call-ID', call_id))
    return {
        'Type': 'Hangup',
        'Parameters': {
                'CallId': call_id,
                'SipResponseCode': '0'
        }
    }
