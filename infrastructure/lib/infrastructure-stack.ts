import * as cdk from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface InfrastructureStackProps extends cdk.StackProps {
  DEPLOY_ENVIRONMENT: string;
}

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { DEPLOY_ENVIRONMENT } = props;

    console.log(
      `${DEPLOY_ENVIRONMENT} environment detected. Deploying to S3 bucket.`
    );

    const infrastructureBucket = new Bucket(this, 'InfrastructureBucket', {
      bucketName: `fepu08-${DEPLOY_ENVIRONMENT}-infrastructure-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
