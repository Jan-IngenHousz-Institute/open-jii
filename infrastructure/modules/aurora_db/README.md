# 🔵 Aurora DB Module

This module deploys an **AWS Aurora Serverless database cluster**, providing a **scalable** and **cost-efficient** relational database solution. It includes **automatic scaling**, encryption, and high availability across **multiple availability zones**.

## 📖 Overview

The Aurora DB module provisions an **Aurora PostgreSQL cluster** with serverless capabilities, allowing dynamic scaling based on workload demand. It ensures **secure VPC integration**, automatic backups, and flexible compute capacity.

```mermaid
graph TD;
    A[Application] -->|Connects to| B[Aurora Security Group]
    B -->|Allows Traffic| C[Aurora DB Cluster]
    C -->|Stores Data| D[RDS Aurora Storage]
    C -->|Auto Scales| E[Serverless Scaling]
    C -->|Has Subnets| F[Private Subnets]
    F --> G[VPC]


🛠 Resources Used
| Resource                     | Description  
| Documentation                                                                                                            
|------------------------------------------------------------------------------------------------------------------------|
| `aws_rds_cluster`            | Creates an Aurora DB cluster                
| [AWS RDS Cluster] (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/rds_cluster)                
| `aws_rds_cluster_instance`   | Defines instances in the Aurora cluster     
| [AWS RDS Cluster Instance] (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/rds_cluster_instance) 
| `aws_db_subnet_group`        | Manages the subnet group for the Aurora DB       
| [AWS DB Subnet Group] (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/db_subnet_group)    
| `aws_security_group`         | Controls inbound/outbound access to Aurora DB 
| [AWS Security Group] (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/security_group)  


🔑 Inputs
| Name                         | Description                                  | Type     | Default                | Required |
|------------------------------|----------------------------------------------|----------|------------------------|----------|
| `cluster_identifier`         | Unique identifier for Aurora cluster       | `string`  | n/a                     | ✅ Yes  |
| `engine_mode`                | Aurora Engine Mode                         | `string`  | `"provisioned"`         | ❌ No   |
| `engine`                     | Aurora DB Engine                           | `string`  | `"aurora-postgresql"`   | ❌ No   |
| `engine_version`             | PostgreSQL version for Aurora              | `string`  | `"13.6"`                | ❌ No   |
| `database_name`              | Name of the database                       | `string`  | n/a                     | ✅ Yes  |
| `master_username`            | Master username for DB                     | `string`  | n/a                     | ✅ Yes  |
| `storage_encrypted`          | Enables database storage encryption        | `bool`    | `true`                  | ❌ No   |
| `vpc_security_group_ids`     | Security groups assigned to Aurora DB      | `list`    | n/a                     | ✅ Yes  |
| `db_subnet_group_name`       | Name of the subnet group for Aurora        | `string`  | n/a                     | ✅ Yes  |
| `preferred_backup_window`    | Automated backup time slot                 | `string`  | `"00:00-02:00"`         | ❌ No   |
| `preferred_maintenance_window` | Maintenance window                       | `string`  | `"sun:03:00-sun:07:00"` | ❌ No   |
| `max_capacity`               | Maximum scaling capacity for Serverless v2 | `number`  | `2.0`                   | ❌ No   |
| `min_capacity`               | Minimum scaling capacity                   | `number`  | `0.0`                   | ❌ No   |
| `seconds_until_auto_pause`   | Time before cluster auto-pauses            | `number`  | `3600`                  | ❌ No   |
| `instance_class`             | Instance type for Aurora                   | `string`  | `"db.serverless"`       | ❌ No   |

📤 Outputs
| Name                  | Description                                     |
|-----------------------|-------------------------------------------------|
| `cluster_endpoint`    | Primary endpoint for Aurora DB                  |
| `reader_endpoint`     | Reader endpoint for Aurora DB                   |
| `cluster_arn`         | ARN of the Aurora cluster                       |
| `instance_id`         | Instance ID of the Aurora DB cluster            |


🌍 Notes
Aurora Serverless v2 automatically adjusts capacity based on workload demand, optimizing costs while ensuring performance.

The security group restricts database access to the VPC range to ensure private network communication.

Private subnets are used to prevent unauthorized external access.

Automatic backups ensure data integrity, following AWS best practices.