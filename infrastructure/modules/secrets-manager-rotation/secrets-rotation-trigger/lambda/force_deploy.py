import json
import boto3
import os

ecs = boto3.client('ecs')

def handler(event, context):
    cluster_name = os.environ['ECS_CLUSTER_NAME']
    service_name = os.environ['ECS_SERVICE_NAME']
    
    print(f"Received event: {json.dumps(event)}")
    print(f"Triggering force deployment for service: {service_name} in cluster: {cluster_name}")
    
    try:
        response = ecs.update_service(
            cluster=cluster_name,
            service=service_name,
            forceNewDeployment=True
        )
        
        print(f"Successfully triggered deployment: {response}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully triggered new deployment for {service_name}',
                'service_arn': response['service']['serviceArn']
            })
        }
    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }