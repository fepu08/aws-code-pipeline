import * as cdk from 'aws-cdk-lib';
import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
  CodeBuildAction,
  GitHubSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  CompositePrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface PipelineStackProps extends cdk.StackProps {
  envName: string;
  infrastructureRepoName: string;
  infrastructureBranchName: string;
  repositoryOwner: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    console.log('props', props);
    const {
      envName,
      infrastructureRepoName,
      infrastructureBranchName,
      repositoryOwner,
    } = props;

    const githubToken = cdk.SecretValue.secretsManager('github-token');

    const infrastructureDeployRole = new Role(
      this,
      'InfrastructureDeployRole',
      {
        assumedBy: new CompositePrincipal(
          new ServicePrincipal('codebuild.amazonaws.com'),
          new ServicePrincipal('codepipeline.amazonaws.com')
        ),
        inlinePolicies: {
          CdkDeployPermissions: new PolicyDocument({
            statements: [
              new PolicyStatement({
                actions: ['sts:AssumeRole'],
                resources: ['arn:aws:iam::*:role/cdk-*'],
              }),
            ],
          }),
        },
      }
    );

    const artifactBucket = new Bucket(this, 'ArtifactBucket', {
      bucketName: `fepu08-${envName}-aws-codepipeline-artifact-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const infrastructureSourceOutput = new Artifact(
      'InfraStructureSourceOutput'
    );

    const infrastructureBuildProject = new PipelineProject(
      this,
      'InfrastructureProject',
      {
        role: infrastructureDeployRole,
        environment: {
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
        },
        environmentVariables: {
          DEPLOY_ENVIRONMENT: {
            value: envName,
          },
        },
        buildSpec: BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: '20.x',
              },
              commands: [
                'npm install -g aws-cdk',
                'cd infrastructure',
                'npm install',
              ],
            },
            build: {
              commands: [`cdk deploy --context nev=${envName}`],
            },
          },
        }),
      }
    );

    const pipeline = new Pipeline(this, 'CIPipeline', {
      pipelineName: `${envName}-CI-Pipeline`,
      role: infrastructureDeployRole,
      artifactBucket,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new GitHubSourceAction({
          owner: repositoryOwner,
          repo: infrastructureRepoName,
          branch: infrastructureBranchName,
          actionName: 'GitHub_Source',
          output: infrastructureSourceOutput,
          oauthToken: githubToken,
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        /**
         CDK’s CodePipeline integration has limited out-of-the-box deployment actions (mostly ECS/EC2/CloudFormation). To deploy arbitrary CDK infrastructure, we use a CodeBuild project that runs cdk deploy 
         */
        new CodeBuildAction({
          actionName: 'DeployCdkInfrastructure',
          project: infrastructureBuildProject,
          input: infrastructureSourceOutput,
          role: infrastructureDeployRole,
        }),
      ],
    });
  }
}
