import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ChimeSdkStack } from './chime-sdk-stack';
import { Infrastructure } from './infrastructure-stack';

export class ChimeSdkPstnVoiceFocusStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const infrastructure = new Infrastructure(this, 'Infrastructure', {});

    const chimeSdkStack = new ChimeSdkStack(this, 'ChimeSdk', {
      smaLambdaEndpointArn: infrastructure.endpointArn,
    });

    new CfnOutput(this, 'toPhoneNumber', { value: chimeSdkStack.phoneNumber });
    new CfnOutput(this, 'handlerLambdaLogGroupName', { value: infrastructure.handlerLambdaLogGroupName });
    new CfnOutput(this, 'handlerLambdaArn', { value: infrastructure.endpointArn });

  }
}
