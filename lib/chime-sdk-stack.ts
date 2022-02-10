import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Duration, NestedStackProps, NestedStack } from 'aws-cdk-lib';
import path = require('path');
import { Construct } from 'constructs';
import { Code, Function } from 'aws-cdk-lib/aws-lambda';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as chime from 'cdk-amazon-chime-resources';

interface ChimeProps extends NestedStackProps {
  smaLambdaEndpointArn: string;
}

export class ChimeSdkStack extends NestedStack {
  public readonly phoneNumber: string;
  public readonly smaID: string;
 

  constructor(scope: Construct, id: string, props?: ChimeProps) {
    super(scope, id, props);

    const phoneNumber = new chime.ChimePhoneNumber(this, 'phoneNumber', {
      phoneState: 'IL',
      phoneNumberType: chime.PhoneNumberType.LOCAL,
      phoneProductType: chime.PhoneProductType.SMA,
    });
    this.phoneNumber = phoneNumber.phoneNumber;

    const sipMediaApp = new chime.ChimeSipMediaApp(this, 'sipMediaApp', {
      region: this.region,
      endpoint: props?.smaLambdaEndpointArn as string,
    });
    this.smaID = sipMediaApp.sipMediaAppId;

    const sipRule = new chime.ChimeSipRule(this, 'sipRule', {
      triggerType: chime.TriggerType.TO_PHONE_NUMBER,
      triggerValue: phoneNumber.phoneNumber,
      targetApplications: [
        {
          region: this.region,
          priority: 1,
          sipMediaApplicationId: sipMediaApp.sipMediaAppId,
        },
      ],
    });
  };
}
