#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChimeSdkPstnVoiceFocusStack } from '../lib/pstn-audio-voice-focus';

const app = new cdk.App();
new ChimeSdkPstnVoiceFocusStack(app, 'ChimeSdkPstnVoiceFocusStack', {});
