import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as chime from 'cdk-amazon-chime-resources';

interface ChimeProps {
  smaLambdaEndpointArn: string;
}

export class ChimeSdkStack extends Construct {
  public readonly phoneNumber: string;
  public readonly smaID: string;

  constructor(scope: Construct, id: string, props: ChimeProps) {
    super(scope, id);

    const phoneNumber = new chime.ChimePhoneNumber(this, 'phoneNumber', {
      phoneState: 'IL',
      phoneNumberType: chime.PhoneNumberType.LOCAL,
      phoneProductType: chime.PhoneProductType.SMA,
    });
    this.phoneNumber = phoneNumber.phoneNumber;

    const sipMediaApp = new chime.ChimeSipMediaApp(this, 'sipMediaApp', {
      region: Stack.of(this).region,
      endpoint: props.smaLambdaEndpointArn as string,
    });
    this.smaID = sipMediaApp.sipMediaAppId;

    new chime.ChimeSipRule(this, 'sipRule', {
      triggerType: chime.TriggerType.TO_PHONE_NUMBER,
      triggerValue: phoneNumber.phoneNumber,
      targetApplications: [
        {
          region: Stack.of(this).region,
          priority: 1,
          sipMediaApplicationId: sipMediaApp.sipMediaAppId,
        },
      ],
    });
  }
}
