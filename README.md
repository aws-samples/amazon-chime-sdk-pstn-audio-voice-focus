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
## Installing Dependencies

On a clean linux instance, you need to install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [jq](https://stedolan.github.io/jq/download/) and the [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm).  You can then use nvm to install the other dependendencies, like this:

```bash
nvm install 16 # installs Nodejs 16
nvm use 16 # selects it
npm install -g npm nodejs typescript aws-sdk aws-cdk # installs the necessary modules
```

An example of the commands to install on Amazon Linux (or other yum-based linux) is [here](SETUP-DEPS.md).  However, please
always reference those tools installation instructions if needed.
## Configuring your AWS Account

You need to configure your [AWS Account parameters](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) to enable deploying the application.  The easiest way
to ensure that you have it configured properly is to run:

```bash
aws sts get-caller-identity
```

You should get information about your valid AWS account.

**Note:** Deploying this demo application will cause your AWS Account to be billed for services, including the Amazon Chime SDK,
used by the application.

## Deploying

Once you have installed the dependencies, you will need to have a parallel repo that contains the [amazon-chime-sdk-pstn-provider](https://github.com/aws-samples/amazon-chime-sdk-pstn-provider) Custom Resource Provider. This is required to create the Chime resources that this application will rely on. You do not need to run any commands in that repo. Then it's just a case of cloning this repo and running the deploy script: 

```bash
git clone https://github.com/aws-samples/amazon-chime-sdk-pstn-provider
git clone https://github.com/aws-samples/amazon-chime-sdk-pstn-voicefocus-demo
cd amazon-chime-sdk-pstn-voicefocus-demo
./deploy.sh
```

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
arn:aws:cloudformation:us-east-1:<account number>:stack/ChimeSdkPstnVoiceFocusStack/919XXe80-4712-45tt-9694-02afe776b4ef
```

All you need is the phone number on the line ```ChimeSdkPstnVoiceFocusStack.inboundPhoneNumber```.  Call that number and the app will respond.

## Customizing For Your Own Use

This CDK script will create a stack named ChimeSdkPstnVoiceFocusStack.  Since the outputs of a stack must be unique across the region that the stack is deployed to you can change the stack name to enable deploying it more than once.  To make it easier for you to do this, copy and paste this snip to the command line and replace NEWNAME with your new application stack name:

```bash
export REPLACEMENT='NEWNAME'
sed -i "s/ChimeSdkPstnVoiceFocusStack/$REPLACEMENT/g" ./lib/chime_sdk_pstn_cdk-stack.ts ./bin/chime_sdk_pstn_cdk.ts Makefile
```
This will replace the name in all locations in the needed files with the new stack name.
## Details and In-Depth Instructions

This section of the README is for information only, and is not needed to just deploy and run the sample application.
### AWS CDK

There are three parts to this repo: the CDK automation scripting (in the 'lib' folder), the actual sample application itself (in the 'src' folder), and a CloudFormation Custom Resource Provider (in a parallel folder).
Please refer to [those docs](https://github.com/aws-samples/amazon-chime-sdk-pstn-provider) for more information.
### Custom Provider

This repo requires a parallel repo that contains the [amazon-chime-sdk-pstn-provider](https://github.com/aws-samples/amazon-chime-sdk-pstn-provider) Custom Resource Provider.  If you have placed it in a different folder location, you can make the change in ```lib/chime_sdk_pstn_cdk-stack.ts``` to make it work:

```typescript
// default custom provider is in a parallel folder
// keeping it separate so that it can evolve independently
const chimeSdkPstnProviderDir = `${path.resolve(
  __dirname
)}/../../amazon-chime-sdk-pstn-provider`;
const ChimeSdkPstnProviderHandler = "index.handler";
```

Today the custom provider currently only supports the creation of one Phone Number, one SMA, and one SIP Rule.  Please see the [detailed documentation](https://github.com/aws-samples/amazon-chime-sdk-pstn-provider) in that repo for more information.
### Example Application

The sample app is in the ```src``` directory and is vanilla Python.

### Cloud Development Kit (CDK)

The CDK script is located in the ```lib``` folder.  More information on the CDK is available [here](https://aws.amazon.com/cdk/);

### Makefile

This repo makes use of ```make``` and the Makefile is a neat way to handle dependencies and chain outputs to inputs. You are encouraged to read the commands in the [Makefile](https://github.com/aws-samples/amazon-chime-sdk-pstn-voicefocus-demo/blob/main/Makefile) to understand what commands are available and how they work.  We make heavy use of the command line JSON tool [jq](https://stedolan.github.io/jq/) to enable simple automation for many commands.
### Node Modules

The Makefile will handle downloading all necessary node modules for you. If you want to trigger that manually you can:

```bash
make modules-install
```
### Depoloying to Your AWS Account

You can manually deploy the sample application using the SDK with the following command:

```bash
make deploy
```
### Cleanup

You can clean up everything and remove all resources that this demo allocation with the following command:

```
make destroy
```
### Other Helper Make Commands

#### Testing the Lambda Function

To test if the application deployed properly and is responding, you can invoke the lambda function directly (bypassing the SIP Media Application)
with the following command:

```bash
make invoke
```
This will use the file "test/in.json" as a sample input to the function. This is useful to ensure that your code is actually invoking properly with no javascript errors.
You should get an output that looks like this:

```bash
make invoke
arn:aws:lambda:us-east-1:<account number>:function:ChimeSdkPstnVoiceFocusStack-ChimeSdkPstnLambda94B9E76E-x5sxFOqrRzgm
jq . ./test/in.json
{
  "SchemaVersion": "1.0",
  "Sequence": 1,
  "InvocationEventType": "NEW_INBOUND_CALL",
  "CallDetails": {
    "TransactionId": "transaction-id",
    "AwsAccountId": "aws-account-id",
    "AwsRegion": "us-east-1",
    "SipRuleId": "sip-rule-id",
    "SipApplicationId": "sip-application-id",
    "Participants": [
      {
        "CallId": "call-id-1",
        "ParticipantTag": "LEG-A",
        "To": "+11234567890",
        "From": "+19876543210",
        "Direction": "Inbound",
        "StartTimeInMilliseconds": "159700958834234",
        "Status": "Connected"
      }
    ]
  }
}
aws lambda invoke --function-name "arn:aws:lambda:us-east-1:<account number>:function:ChimeSdkPstnVoiceFocusStack-ChimeSdkPstnLambda94B9E76E-x5sxFOqrRzgm" --cli-binary-format raw-in-base64-out --payload file://./test/in.json ./out/out.json --no-paginate 2>&1 > /dev/null
jq . ./out/out.json
{
  "SchemaVersion": "1.0",
  "Actions": [
    {
      "Type": "PlayAudio",
      "Parameters": {
        "AudioSource": {
          "Type": "S3",
          "BucketName": "chimesdkpstncdkstack-wavfiles98e3397d-mlvloqhnp0l8",
          "Key": "call-id-1-welcome.wav"
        }
      }
    }
  ]
}
```
This is an excellent example of using the jq tool on the output of some commands to provide the data for inputs for other commands.

#### Seeing the Application Logs in your Terminal

If you want to see the logs from the sample application in your console, you can use this command:

```
make logs
```

These update fairly slowly so be patient and wait 30 seconds if you think it's not working.  


## Disclaimers

Deploying the Amazon Chime SDK demo application contained in this repository will cause your AWS Account to be billed for services, including the Amazon Chime SDK, used by the application.

The voice prompt audio files and database records created in this demo are not encrypted, as would be recommended in a production-grade application.
## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0

