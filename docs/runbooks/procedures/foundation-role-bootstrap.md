# foundation-role-bootstrap

**Creates the foundation role and its boundary by hand in an AWS account that has none yet.** The
foundation root imports the role but cannot create it, because the role is what applies that root.
Dev has both. Prod needs them before `#2384` merges, or the prod foundation plan fails on the
import and every prod release stops at the foundation step.

An account admin runs this once per account. Afterwards the foundation root manages the role, its
trust and its inline policy. No root manages the boundary, so a change to it repeats the
`create-policy-version` step below and updates this page.

## What gets created

| Object                   | Name                                  |
| ------------------------ | ------------------------------------- |
| Managed policy, boundary | `CiFoundationBoundary`                |
| Role                     | `GithubActionsFoundationAccess`       |
| Inline policy on it      | `GithubActionsFoundationAccessPolicy` |

## The boundary

<!-- Paste dev's boundary here, with the account id replaced by <ACCOUNT_ID> and -dev by -<ENV>. -->

```json

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

Take it from `aws_iam_role_policy.foundation_role` in `modules/iam-oidc/main.tf`, with the
account id, region and environment filled in. The first apply rewrites it from the code, so it
only has to let that apply run.

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

3. Set `AWS_ROLE_ARN` in the `foundation-<ENV>` GitHub environment to
   `arn:aws:iam::<ACCOUNT_ID>:role/GithubActionsFoundationAccess`.
4. Re-run the foundation plan for that environment. It imports the role and shows no change to
   its trust.
