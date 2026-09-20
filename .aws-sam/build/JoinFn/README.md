# QueueLess — AWS "Ship It" build

Real AWS services, matching the hackathon track exactly:

| Need | Service used |
|---|---|
| Serverless compute | **Lambda** |
| API | **API Gateway** (HTTP API) |
| Data | **DynamoDB** |
| Auth | **Cognito** |
| Plumbing | **EventBridge**, **SNS**, **CloudWatch** |
| Frontend hosting | **S3** static website |

No paid account needed — this fits the AWS Free Tier (~$200 free credits).

## 0. One-time installs (5–10 min)

1. **AWS account**: https://aws.amazon.com/free — sign up if you haven't.
2. **AWS CLI**: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
   Then run:
   ```
   aws configure
   ```
   Paste your Access Key ID, Secret Access Key, a region (e.g. `us-east-1`), and output format `json`.
   (Create keys in AWS Console → IAM → Users → your user → Security credentials.)
3. **SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
4. **Node.js 20+**: https://nodejs.org

Confirm everything works:
```
aws --version
sam --version
node -v
```

## 1. Open the project in VS Code
Unzip `queueless-aws.zip`, open the folder, open a terminal (Terminal → New Terminal).

## 2. Build and deploy the backend
```
sam build
sam deploy --guided
```
Answer the prompts:
- Stack Name: `queueless`
- AWS Region: your choice (e.g. `us-east-1`)
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to samconfig.toml: `Y`
- Everything else: press Enter for defaults

This creates every resource in the table above. At the end, copy the three
values under **Outputs**: `ApiUrl`, `UserPoolClientId`, and note your region.

## 3. Create a staff login
Staff-only actions (call next, view dashboard) require a Cognito user:
```
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId from Outputs> \
  --username staff1 \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId from Outputs> \
  --username staff1 \
  --password StaffPass123! \
  --permanent
```
Log in on the Staff tab with `staff1` / `StaffPass123!`.

## 4. Configure and deploy the frontend
Open `frontend/config.js` and paste your values:
```js
window.QUEUELESS_CONFIG = {
  API_URL: 'https://xxxxx.execute-api.us-east-1.amazonaws.com',
  COGNITO_REGION: 'us-east-1',
  COGNITO_CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx'
};
```
Then upload it to S3 (bucket name is in `FrontendBucketName` from Outputs):
```
aws s3 sync frontend/ s3://<FrontendBucketName> --acl public-read
```
Open the `FrontendUrl` from Outputs in your browser — that's your live app.

## 5. See notifications (optional)
Ticket events (`TICKET_CREATED`, `TICKET_CALLED`) flow through EventBridge →
SNS. Subscribe your email to see them:
```
aws sns subscribe --topic-arn <check SNS console for ARN> \
  --protocol email --notification-endpoint you@example.com
```

## How the pieces map to the code
- `template.yaml` — every AWS resource (SAM/CloudFormation)
- `src/*.js` — one Lambda per API route, using AWS SDK v3
- `frontend/` — plain HTML/JS, calls API Gateway directly + Cognito for staff login
- Race-condition safety: `join.js` uses an atomic DynamoDB counter;
  `callNext.js` uses a conditional write so two staff can't claim one ticket

## Redeploying after changes
```
sam build && sam deploy
```
(no need for `--guided` again — it reuses `samconfig.toml`)

## Next steps (build in this order)
1. **RBAC**: restrict Cognito groups (`STAFF` vs `ADMIN`) instead of any logged-in user
2. **Prediction v2**: log historical service times per hour/day instead of a fixed average
3. **SageMaker**: swap the rule-based prediction for a trained regression model
4. **CloudFront**: put the S3 site behind CloudFront + a custom domain (Route 53)
