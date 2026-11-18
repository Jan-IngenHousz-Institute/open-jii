# foundation-role-bootstrap

**Creates the foundation role and its boundary by hand in an AWS account that has none yet.** The
foundation root imports the role but cannot create it, because the role is what applies that root.
Dev has both. Prod needs them before `#2384` merges, or the prod foundation plan fails on the
import and every prod release stops at the foundation step.

An administrator of the AWS account runs this once per account. In prod that is a production AWS
account administrator, before the merge, and the pull request records who ran it and the plan that
shows the import. Afterwards the foundation root manages the role, its trust and its inline policy.
No root manages the boundary, so an admin changes it with
`aws iam create-policy-version --set-as-default` and updates this page in the same change.

## What gets created

| Object                   | Name                                  |
| ------------------------ | ------------------------------------- |
| Managed policy, boundary | `CiFoundationBoundary`                |
| Role                     | `GithubActionsFoundationAccess`       |
| Inline policy on it      | `GithubActionsFoundationAccessPolicy` |

## The boundary

> **Incomplete. Do not run this procedure yet.** The boundary below is still missing. Someone has
> to read dev's `CiFoundationBoundary` with `aws iam get-policy` and `aws iam get-policy-version`,
> replace the account id with `<ACCOUNT_ID>` and `-dev` with `-<ENV>`, and get it reviewed in a pull
> request. Until then the prod bootstrap cannot run, and `#2384` cannot merge.

```json
<BOUNDARY JSON NOT YET COPIED FROM DEV>
```

## The trust

The same trust `modules/iam-oidc` declares, so the first apply leaves it unchanged. Replace
`<ACCOUNT_ID>` and `<ENV>`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:Jan-IngenHousz-Institute/open-jii:environment:foundation-<ENV>"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:ref": ["refs/heads/main", "refs/heads/release/*"]
        }
      }
    }
  ]
}
```

In dev the ref list is `["refs/heads/main"]`.

## The inline policy

`aws_iam_role_policy.foundation_role` in `modules/iam-oidc/main.tf`, rendered. Replace
`<ACCOUNT_ID>`, `<REGION>` (`eu-central-1` in dev and prod) and `<ENV>`. The first apply rewrites it
from the code, so it only has to let that apply run; if the code has changed since this page, use
the code.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageCiRoles",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:UpdateRole",
        "iam:UpdateAssumeRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:ListInstanceProfilesForRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:GetPolicy",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:TagPolicy",
        "iam:UntagPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion",
        "iam:SetDefaultPolicyVersion"
      ],
      "Resource": [
        "arn:aws:iam::<ACCOUNT_ID>:role/GithubActions*",
        "arn:aws:iam::<ACCOUNT_ID>:policy/GithubActions*"
      ]
    },
    {
      "Sid": "ManageGithubTrust",
      "Effect": "Allow",
      "Action": [
        "iam:GetOpenIDConnectProvider",
        "iam:CreateOpenIDConnectProvider",
        "iam:DeleteOpenIDConnectProvider",
        "iam:UpdateOpenIDConnectProviderThumbprint",
        "iam:AddClientIDToOpenIDConnectProvider",
        "iam:RemoveClientIDFromOpenIDConnectProvider",
        "iam:TagOpenIDConnectProvider",
        "iam:UntagOpenIDConnectProvider"
      ],
      "Resource": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    {
      "Sid": "ManageStateBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:GetBucketAcl",
        "s3:PutBucketAcl",
        "s3:GetBucketCORS",
        "s3:GetBucketWebsite",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetAccelerateConfiguration",
        "s3:GetBucketRequestPayment",
        "s3:GetBucketLogging",
        "s3:GetLifecycleConfiguration",
        "s3:PutLifecycleConfiguration",
        "s3:GetReplicationConfiguration",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration",
        "s3:GetBucketObjectLockConfiguration",
        "s3:GetBucketTagging",
        "s3:PutBucketTagging",
        "s3:GetBucketOwnershipControls",
        "s3:PutBucketOwnershipControls",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": "arn:aws:s3:::open-jii-terraform-state-<ENV>"
    },
    {
      "Sid": "FoundationStateAndPlans",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::open-jii-terraform-state-<ENV>/foundation/*",
        "arn:aws:s3:::open-jii-terraform-state-<ENV>/plans/foundation-*"
      ]
    },
    {
      "Sid": "ManageStateLock",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:UpdateContinuousBackups",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:ListTagsOfResource",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/terraform-state-lock"
    }
  ]
}
```

## Steps

1. Save the three documents as `boundary.json`, `trust.json` and `policy.json`.
2. Create them, with an admin profile for the account:

   ```sh
   aws iam create-policy --policy-name CiFoundationBoundary --policy-document file://boundary.json
   aws iam create-role --role-name GithubActionsFoundationAccess \
     --assume-role-policy-document file://trust.json \
     --permissions-boundary "arn:aws:iam::<ACCOUNT_ID>:policy/CiFoundationBoundary"
   aws iam put-role-policy --role-name GithubActionsFoundationAccess \
     --policy-name GithubActionsFoundationAccessPolicy --policy-document file://policy.json
   ```

3. Set up the `foundation-<ENV>` GitHub environment, and check each setting saved before going on:
   - deployment branches limited to the refs in the trust: `main` in dev, `main` and `release/*`
     in prod;
   - in prod, required reviewers with prevent self-review on, and admin bypass off. Dev has no
     reviewers, because a dev foundation change was reviewed in its pull request.
4. Set the secrets `AWS_ROLE_ARN`, to `arn:aws:iam::<ACCOUNT_ID>:role/GithubActionsFoundationAccess`,
   and `AWS_REGION` in that environment.
5. Re-run the foundation plan for that environment. It imports the role and shows no change to
   its trust.
