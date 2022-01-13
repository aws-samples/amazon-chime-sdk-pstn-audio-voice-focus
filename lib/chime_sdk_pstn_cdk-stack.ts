/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment')
import iam = require('@aws-cdk/aws-iam')
import lambda = require('@aws-cdk/aws-lambda');
import custom = require('@aws-cdk/custom-resources')

import { FromCloudFormationPropertyObject } from '@aws-cdk/core/lib/cfn-parse';
import { ChimeClient } from '@aws-sdk/client-chime';
import { stringify } from 'querystring';
import * as path from 'path';

// default custom provider is in a parallel folder
// keeping it separate so that it can evolve independently
const chimeSdkPstnProviderDir = `${path.resolve(__dirname)}/../../amazon-chime-sdk-pstn-provider/dist`;
const ChimeSdkPstnProviderHandler = "index.handler"

// default folder for libraries to be included as a lambda layer for the provider
const providerLayerFolder = `${path.resolve(__dirname)}/../../amazon-chime-sdk-pstn-provider/layer`;

// default telephony lambda is in the src folder
const chimeSdkPstnLambdaDir = `${path.resolve(__dirname)}/../src/`;
const ChimeSdkPstnLambdaHandler = "lambda_function.lambda_handler";


export class ChimeSdkPstnVoiceFocusStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a bucket for the recorded wave files and set the right policies
    const wavFiles = new s3.Bucket(this, 'wavFiles', {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    const wavFileBucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:PutObjectAcl'
      ],
      resources: [
        wavFiles.bucketArn,
        `${wavFiles.bucketArn}/*`
      ],
      sid: 'SIPMediaApplicationRead',
    });
    wavFileBucketPolicy.addServicePrincipal('voiceconnector.chime.amazonaws.com');
    wavFiles.addToResourcePolicy(wavFileBucketPolicy);

    new s3deploy.BucketDeployment(this, "WavDeploy", {
      sources: [s3deploy.Source.asset("./wav_files")],
      destinationBucket: wavFiles,
      contentType: "audio/wav",
    });

    const smaLambdaRole = new iam.Role(this, 'smaLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    smaLambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));


    // create the lambda function that does the call handling
    const chimeSdkPstn = new lambda.Function(this, 'ChimeSdkPstnLambda', {
      code: lambda.Code.fromAsset(chimeSdkPstnLambdaDir),
      handler: ChimeSdkPstnLambdaHandler,
      runtime: lambda.Runtime.PYTHON_3_9,
      environment: {
        WAVFILE_BUCKET: wavFiles.bucketName,
      },
      role: smaLambdaRole,
      timeout: cdk.Duration.seconds(60),
    });
    const chimeCreateRole = new iam.Role(this, 'createChimeLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            resources: ['*'],
            actions: ['chime:*',
              'lambda:GetPolicy',
              'lambda:AddPermission',
              'cloudformation:DescribeStacks',
              'cloudformation:DescribeStackEvents',
              'cloudformation:DescribeStackResource',
              'cloudformation:DescribeStackResources',]
          })]
        })
      },
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")]
    });


    // create the lambda layer to hold routine libraries for the Custom Provider
    const providerLayer = new lambda.LayerVersion(this, 'providerLambdaLayer', {
      code: lambda.Code.fromAsset(path.join(providerLayerFolder,)),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      description: 'Provider Lambda Layer',
    });

    // create the lambda for CDK custom resource to deploy SMA, etc.
    const chimeProviderLamba = new lambda.Function(this, 'chimeSdkPstnProviderLamba-', {
      code: lambda.Code.fromAsset(chimeSdkPstnProviderDir, { exclude: ["README.md", "*.ts"] }),
      handler: ChimeSdkPstnProviderHandler,
      runtime: lambda.Runtime.NODEJS_14_X,
      role: chimeCreateRole,
      layers: [providerLayer],
      timeout: cdk.Duration.seconds(180),
    });

    const chimeProvider = new custom.Provider(this, 'chimeProvider', {
      onEventHandler: chimeProviderLamba,
    });

    const chimeProviderProperties = {
      lambdaArn: chimeSdkPstn.functionArn,
      region: this.region,
      smaName: this.stackName,
      sipRuleName: this.stackName,
      sipTriggerType: 'ToPhoneNumber',
      phoneNumberRequired: true,
      phoneAreaCode: '505',
      phoneState: '',
      phoneCountry: '',
      phoneNumberType: 'SipMediaApplicationDialIn',
      phoneNumberTollFreePrefix: '',
    }
    console.log(chimeProviderProperties);
    console.log(chimeProvider.serviceToken);

    const inboundSMA = new cdk.CustomResource(this, 'inboundSMA', {
      serviceToken: chimeProvider.serviceToken,
      properties: chimeProviderProperties,
    });


    // these are the attributes returned from the custom resource!
    const inboundPhoneNumber = inboundSMA.getAttString('phoneNumber');
    const smaID = inboundSMA.getAttString("smaID");
    const sipRuleID = inboundSMA.getAttString("sipRuleID");
    const phoneID = inboundSMA.getAttString("phoneID");

    // Write the Telephony Handling Data to the output
    new cdk.CfnOutput(this, 'inboundPhoneNumber', {
      value: inboundPhoneNumber,
      exportName: this.stackName + '-inboundPhoneNumber',
    });
    new cdk.CfnOutput(this, 'chimeProviderLog', {
      value: chimeProviderLamba.logGroup.logGroupName,
      exportName: this.stackName + '-chimeProviderLog'
    });
    new cdk.CfnOutput(this, 'lambdaLog', {
      value: chimeSdkPstn.logGroup.logGroupName,
      exportName: this.stackName + '-lambdaLog',
    });
    new cdk.CfnOutput(this, 'region', {
      value: this.region,
      exportName: this.stackName + '-region',
    });
    new cdk.CfnOutput(this, 'lambdaARN', {
      value: chimeSdkPstn.functionArn,
      exportName: this.stackName + '-lambdaARN'
    });
    new cdk.CfnOutput(this, "smaID", {
      value: smaID,
      exportName: this.stackName + '-smaID',
    });
    new cdk.CfnOutput(this, "phoneID", {
      value: phoneID,
      exportName: this.stackName + '-phoneID'
    });
    new cdk.CfnOutput(this, "sipRuleID", {
      value: sipRuleID,
      exportName: this.stackName + '-sipRuleID',
    });
    new cdk.CfnOutput(this, "sipRuleName", {
      value: chimeProviderProperties.sipRuleName,
      exportName: this.stackName + '-sipRuleName',
    });
  }

}
exports.ChimeSdkPstnVoiceFocusStack = ChimeSdkPstnVoiceFocusStack;

