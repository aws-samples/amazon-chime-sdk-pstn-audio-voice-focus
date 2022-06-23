import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import path = require('path');
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class Infrastructure extends Construct {
  public readonly endpointArn: string;
  public readonly handlerLambdaLogGroupName: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // create a bucket for the recorded wave files and set the right policies
    const wavFiles = new s3.Bucket(this, 'wavFiles', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const wavFileBucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:PutObjectAcl'],
      resources: [wavFiles.bucketArn, `${wavFiles.bucketArn}/*`],
      sid: 'SIPMediaApplicationRead',
    });
    wavFileBucketPolicy.addServicePrincipal(
      'voiceconnector.chime.amazonaws.com',
    );
    wavFiles.addToResourcePolicy(wavFileBucketPolicy);

    new s3deploy.BucketDeployment(this, 'WavDeploy', {
      sources: [s3deploy.Source.asset('./wav_files')],
      destinationBucket: wavFiles,
      contentType: 'audio/wav',
    });

    const smaHandlerRole = new iam.Role(this, 'smaHandlerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ['*'],
              actions: ['chime:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const smaHandler = new lambda.Function(this, 'smaHandler', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../src')),
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      environment: {
        WAVFILE_BUCKET: wavFiles.bucketName,
        DIAL_NUMBER: '',
      },
      role: smaHandlerRole,
      timeout: Duration.seconds(60),
    });

    this.handlerLambdaLogGroupName = smaHandler.logGroup.logGroupName;
    this.endpointArn = smaHandler.functionArn;
  }
}
