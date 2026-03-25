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
| `database_name`              | Name of the database                       | `string`  | n/a                     | ✅ Yes  |
| `master_username`            | Master username for DB                     | `string`  | n/a                     | ✅ Yes  |
| `vpc_security_group_ids`     | Security groups assigned to Aurora DB      | `list(string)` | n/a              | ✅ Yes  |
| `db_subnet_group_name`       | Name of the subnet group for Aurora        | `string`  | n/a                     | ✅ Yes  |
| `max_capacity`               | Maximum scaling capacity for Serverless v2 | `number`  | `1.0`                   | ❌ No   |
| `min_capacity`               | Minimum scaling capacity                   | `number`  | `0.5`                   | ❌ No   |
| `seconds_until_auto_pause`   | Time before cluster auto-pauses            | `number`  | `1800`                  | ❌ No   |
| `enable_enhanced_monitoring` | Enable RDS Enhanced Monitoring             | `bool`    | `false`                 | ❌ No   |
| `backup_retention_period`    | Number of days to retain backups           | `number`  | `7`                     | ❌ No   |
| `performance_insights_retention_period` | Performance Insights retention  | `number`  | `7`                     | ❌ No   |
| `skip_final_snapshot`        | Skip final snapshot on deletion            | `bool`    | `false`                 | ❌ No   |
| `snapshot_identifier`        | Snapshot identifier (ARN) to restore the Aurora cluster from. Used for disaster recovery scenarios when restoring from AWS Backup cross-region snapshots. When null, creates a fresh cluster. | `string` | `null` | ❌ No |
| `enable_kms_key_rotation`    | Enable automatic KMS key rotation          | `bool`    | `true`                  | ❌ No   |
| `kms_key_deletion_window`    | Days to retain KMS keys before deletion    | `number`  | `7`                     | ❌ No   |

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

## 🔄 Disaster Recovery

The module supports disaster recovery restore scenarios via the `snapshot_identifier` parameter:

- **Fresh Cluster**: When `snapshot_identifier` is `null` (default), the module creates a new Aurora cluster from scratch with the specified `database_name` and `master_username`.

- **Restore from Snapshot**: When `snapshot_identifier` is provided, the cluster is restored from that snapshot instead of creating a fresh cluster. This is particularly useful for DR environments that need to restore from AWS Backup cross-region snapshots.

- **Expected Format**: The `snapshot_identifier` expects an RDS cluster snapshot ARN (e.g., `arn:aws:rds:region:account:cluster-snapshot:snapshot-name`), not an AWS Backup recovery-point ARN.

- **Parameter Restrictions**: When restoring from a snapshot, `database_name` and `master_username` are ignored (set to `null` automatically), as these values are inherited from the source snapshot.
```
