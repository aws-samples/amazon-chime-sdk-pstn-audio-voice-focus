# Amazon Chime SDK PSTN Audio Voice Focus Demo

The Amazon Chime SDK Public Switched Telephone Network (PSTN) Audio service makes it easy for developers to build customized telephony applications using the agility and operational simplicity of serverless AWS Lambda functions. You can use the PSTN Audio service to build conversational self-service applications to reduce call resolution times and automate informational responses.

This demo will teach you how to build a simple call flow between two participants with Amazon Voice Focus applied to both call legs. Amazon Voice Focus is a deep learning based noise suppression that reduces the sound levels of noises that can intrude on a phone call, such as:

- Environment noises: wind, fans, running water.
- Background noises: lawnmowers, barking dogs.
- Foreground noises: typing, papers shuffling.

## Overview

This sample app is an example of a Chime SDK PSTN Audio telephony application.  It has "Infrastructure as Code" written in TypeScript and the Application code in Python.  It deploys an AWS allocated [Phone Number](https://docs.aws.amazon.com/chime/latest/ag/phone-numbers.html), creates and configures a [SIP Media Application](https://docs.aws.amazon.com/chime/latest/ag/use-sip-apps.html) and a [SIP Rule](https://docs.aws.amazon.com/chime/latest/ag/manage-sip-applications.html).

It then creates a simple two party call application that answers calls to the provisioned phone number and plays a greeting asking for a destination number to be entered using a wave file stored in an S3 bucket. It will then bridge the caller to the destination number with Amazon Voice Focus enabled for both call participants. Each call participant can disable and re-enable Voice Focus throughout the call using DTMF (pressing 0 disables, pressing 1 enables). This can be useful to compare the difference of when Voice Focus is supressing unwanted noise and when it is not.

![Overview](/images/VoiceFocusDemo.png)

This app is a bare-bones example, but it illustrates how to build Chime SDK applications using a number of PSTN Audio actions: [VoiceFocus](https://docs.aws.amazon.com/chime/latest/dg/voicefocus.html), [CallAndBridge](https://docs.aws.amazon.com/chime/latest/dg/call-and-bridge.html), [PlayAudioAndGetDigits](https://docs.aws.amazon.com/chime/latest/dg/play-audio-get-digits.html), [PlayAudio](https://docs.aws.amazon.com/chime/latest/dg/play-audio.html), [ReceiveDigits](https://docs.aws.amazon.com/chime/latest/dg/listen-to-digits.html) and [Hangup]().  


## Call Sequence Diagram

![Overview](/images/sequence_diagram.png)


## Installing Dependencies

To build and deploy this demo, you need to install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [jq](https://stedolan.github.io/jq/download/) and the [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm).  You can then use nvm to install the other dependendencies, like this:

```bash
nvm install 16 # installs Nodejs 16
nvm use 16 # selects it
npm install -g npm nodejs typescript aws-sdk aws-cdk yarn # installs the necessary modules
```

We choose to use [yarn](https://classic.yarnpkg.com/lang/en/) for package management and automation but you can just as easily stick with [npm](https://www.npmjs.com/)

An example of the commands to install on Amazon Linux (or other yum-based linux) is [here](SETUP-DEPS.md).  However, please always reference those tools installation instructions if needed.  

## Configuring your AWS Account

You need to configure your [AWS Account parameters](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) to enable deploying the application.  The easiest way
to ensure that you have it configured properly is to run:

```bash
aws sts get-caller-identity
```

You should get information about your valid AWS account.

**Note:** Deploying this demo application will cause your AWS Account to be billed for services, including the Amazon Chime SDK, used by the application.

## Deploying

Once you have installed the dependencies, clone the repo and run the deploy script:

```bash
git clone https://github.com/aws-samples/amazon-chime-sdk-pstn-audio-voice-focus.git
cd amazon-chime-sdk-pstn-audio-voice-focus
./deploy.sh
```

Note that the deploy script just calls 'yarn install' and 'yarn deploy.'  You can do those steps manually if you desire.

## Output

You will get something like this:

```bash
ChimeSdkPstnVoiceFocusStack.chimeProviderLog = /aws/lambda/ChimeSdkPstnVoiceFocusStack-chimeSdkPstnProviderLambaEA22-SPQgqmeowDXXKU
ChimeSdkPstnVoiceFocusStack.inboundPhoneNumber = ***** PHONE NUMBER HERE *****
ChimeSdkPstnVoiceFocusStack.lambdaARN = arn:aws:lambda:us-east-1:<accountnumber>:function:ChimeSdkPstnVoiceFocusStack-ChimeSdkPstnLambda94XWQ76E-qxK8rrKqOrLV
ChimeSdkPstnVoiceFocusStack.lambdaLog = /aws/lambda/ChimeSdkPstnVoiceFocusStack-ChimeSdkPstnLambda94B9D26E-qxK8ssKqOrLV
ChimeSdkPstnVoiceFocusStack.phoneID = <PHONE ID>
ChimeSdkPstnVoiceFocusStack.region = us-east-1
ChimeSdkPstnVoiceFocusStack.sipRuleID = cb75d4b4-bc12-47a0-9f91-e0e79111dbce
ChimeSdkPstnVoiceFocusStack.sipRuleName = ChimeSdkPstnVoiceFocusStack
ChimeSdkPstnVoiceFocusStack.smaID = f162968d-e771-476b-8a4d-dcd976e24565

Stack ARN:
arn:aws:cloudformation:us-east-1:<account number>:stack/ChimeSdkPstnVoiceFocusStack/919XXe80-4712-45tt-1294-02afe776b4ef
```

All you need is the phone number on the line ```ChimeSdkPstnVoiceFocusStack.inboundPhoneNumber```.  Call that number and the app will respond by voice.



## Customizing For Your Own Use

This CDK script will create a stack named ChimeSdkPstnVoiceFocusStack.  Since the outputs of a stack must be unique across the region that the stack is deployed to you can change the stack name to enable deploying it more than once.  To make it easier for you to do this, copy and paste this snip to the command line and replace NEWNAME with your new application stack name:

```bash
export REPLACEMENT='NEWNAME'
sed -i "s/ChimeSdkPstnVoiceFocusStack/$REPLACEMENT/g" ./lib/chime_sdk_pstn_cdk-stack.ts ./bin/chime_sdk_pstn_cdk.ts Makefile
```
This will replace the name in all locations in the needed files with the new stack name.  

## Details and In-Depth Instructions

This section of the README is for information only, and is not needed to just deploy and run the sample application.  

### Folders

There are two parts to this repo: the CDK automation scripting (in the 'lib' folder), the actual sample application itself (in the 'src' folder).

### Cloud Development Kit (CDK)

The CDK script is located in the ```lib``` folder.  More information on the CDK is available [here](https://aws.amazon.com/cdk/);

### Node Modules

The deploy script will handle downloading all necessary node modules for you. If you want to trigger that manually you can:

```bash
yarn install
```
### Depoloying to Your AWS Account

You can manually deploy the sample application using the SDK with the following command:

```bash
cdk deploy
```
### Cleanup

You can clean up everything and remove all resources that this demo allocation with the following command:

```
cdk destroy
```

## Disclaimers

Deploying the Amazon Chime SDK demo application contained in this repository will cause your AWS Account to be billed for services, including the Amazon Chime SDK, used by the application.

The voice prompt audio files and database records created in this demo are not encrypted, as would be recommended in a production-grade application.  

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0

