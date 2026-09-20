<div align="center">

# 🎫 QueueLess

### An intelligent, serverless virtual queue platform built on AWS

Join queues remotely. Get a live wait-time prediction. Let staff manage the line from a dashboard — all without a single server to patch or scale.

[![AWS](https://img.shields.io/badge/AWS-Serverless-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![SAM](https://img.shields.io/badge/AWS-SAM-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/serverless/sam/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](#license)
[![Status](https://img.shields.io/badge/status-live-brightgreen?style=flat-square)](#-live-demo)

[Live Demo](#-live-demo) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [API Reference](#-api-reference)

</div>

---

## 📖 Overview

Traditional queues waste people's time — you take a number, then stand around
with no idea whether you have 5 minutes or 2 hours left. **QueueLess** turns
any physical queue into a remote one: customers join from their phone, get a
token instantly, and see a live estimate of their wait. Staff serve the queue
from a simple dashboard, and every ticket event flows through a real
event-driven backend — not a spreadsheet or a whiteboard.

Built for **AWS First Commit (Ship It track)** — every core service in the
challenge's "Ship It" column is used for a real reason, not just to check a box.

## ✨ Features

- 🎟️ **Instant remote check-in** — pick a service, join, get a token (`A1`, `A2`, ...)
- 📊 **Live wait-time prediction** — `peopleAhead × avgServiceTime ÷ activeCounters`, recalculated on every poll
- 👩‍💼 **Staff dashboard** — see who's waiting, call the next customer, mark service complete
- 🔐 **Secure staff auth** — Amazon Cognito-backed login, JWT-protected staff routes
- ⚡ **Race-condition safe** — atomic DynamoDB counters and conditional writes prevent duplicate tokens or double-serving
- 📡 **Event-driven core** — every ticket lifecycle event flows through EventBridge → SNS
- 🌐 **Zero servers to manage** — 100% Lambda + API Gateway + DynamoDB

## 🏗️ Architecture

```
                         ┌──────────────────┐
                         │   S3 Static Site  │  ← Customer + Staff UI
                         └─────────┬─────────┘
                                   │
                         ┌─────────▼─────────┐
                         │   API Gateway      │  (HTTP API)
                         │   + Cognito JWT     │  ← protects staff routes
                         │     Authorizer      │
                         └─────────┬─────────┘
                                   │
        ┌──────────────┬──────────┼──────────┬──────────────┐
        ▼              ▼          ▼          ▼              ▼
   ┌─────────┐   ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
   │ JoinFn  │   │ StatusFn │ │StaffFn │ │CallNextFn│ │CompleteFn │
   └────┬────┘   └────┬─────┘ └───┬────┘ └────┬─────┘ └─────┬─────┘
        │             │           │           │             │
        └─────────────┴─────┬─────┴───────────┴─────────────┘
                             ▼
                    ┌─────────────────┐
                    │    DynamoDB      │
                    │ Services · Tickets│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   EventBridge    │  TICKET_CREATED / TICKET_CALLED
                    └────────┬─────────┘
                             ▼
                    ┌─────────────────┐
                    │       SNS        │  → email / SMS notifications
                    └─────────────────┘

                    CloudWatch logs + metrics every Lambda invocation
```

## 🛠️ Tech Stack

| Layer | Service | Why |
|---|---|---|
| Compute | **AWS Lambda** (Node.js 20.x) | One focused function per API route — no idle servers |
| API | **API Gateway** (HTTP API) | Cheaper, faster cold starts than REST API for this scale |
| Data | **DynamoDB** (on-demand) | Single-digit-ms reads, atomic counters for token generation |
| Auth | **Amazon Cognito** | Managed user pool + JWT authorizer, no custom password handling |
| Events | **EventBridge + SNS** | Decouples ticket lifecycle from notification delivery |
| Hosting | **S3 static website** | Frontend served directly from a bucket, no CDN needed for MVP |
| Observability | **CloudWatch** | Automatic logs/metrics for every Lambda, zero setup |
| IaC | **AWS SAM** | One `template.yaml` defines and deploys the entire stack |

## 🔒 Concurrency & Safety

Two real race conditions are handled explicitly, not left to chance:

1. **Duplicate tokens** — `JoinFn` uses a DynamoDB `UpdateItem ADD` on an
   atomic counter, so two people joining in the same millisecond still get
   sequential, unique tokens.
2. **Double-serving** — `CallNextFn` uses a `ConditionExpression` that only
   succeeds if the ticket is still `WAITING`, so two staff members clicking
   "Call Next" at the same instant can't both claim the same ticket.

## 🚀 Live Demo

| | |
|---|---|
| 🌐 **App** | `http://queueless-frontendbucket-3mz5sksdsxhq.s3-website-us-east-1.amazonaws.com` |
| 👤 **Customer** | Pick a service, join, watch your token and wait time live |
| 🔑 **Staff login** | `staff1` / `StaffPass123!` |

## 📦 Project Structure

```
queueless-aws/
├── template.yaml          # SAM/CloudFormation — the entire AWS stack
├── package.json            # Lambda dependencies (AWS SDK v3)
├── src/
│   ├── join.js              # POST /queue/{serviceId}/join
│   ├── status.js            # GET  /queue/{serviceId}/status/{ticketId}
│   ├── staff.js              # GET  /queue/{serviceId}/staff        (Cognito)
│   ├── callNext.js           # POST /queue/{serviceId}/call-next    (Cognito)
│   ├── complete.js           # POST /queue/{serviceId}/complete     (Cognito)
│   └── services.js           # GET  /services
├── frontend/
│   ├── index.html             # Customer + Staff UI
│   ├── app.js                  # API calls, Cognito login, polling
│   ├── style.css
│   └── config.js               # API URL / Cognito IDs (fill after deploy)
└── README.md
```

## 📡 API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/services` | — | List available queues |
| `POST` | `/queue/{serviceId}/join` | — | Join a queue, get a token |
| `GET` | `/queue/{serviceId}/status/{ticketId}` | — | Poll live position + wait estimate |
| `GET` | `/queue/{serviceId}/staff` | 🔒 Cognito | Staff dashboard view |
| `POST` | `/queue/{serviceId}/call-next` | 🔒 Cognito | Call the next waiting customer |
| `POST` | `/queue/{serviceId}/complete` | 🔒 Cognito | Mark a ticket completed |

## ⚡ Getting Started

### Prerequisites
```
AWS CLI · AWS SAM CLI · Node.js 20+ · an AWS account (free tier is enough)
```

### Deploy
```bash
sam build
sam deploy --guided
```

### Create a staff user
```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> --username staff1 \
  --temporary-password TempPass123! --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> --username staff1 \
  --password StaffPass123! --permanent
```

### Deploy the frontend
Fill `frontend/config.js` with your Outputs, then:
```bash
aws s3 sync frontend/ s3://<FrontendBucketName>
```

Full step-by-step walkthrough with every value explained is in
[`SETUP.md`](./SETUP.md) *(optional — merge into this section if you prefer one file)*.

## 🗺️ Roadmap

- [ ] RBAC via Cognito groups (`STAFF` vs `ADMIN`)
- [ ] Prediction v2 — historical service-time modeling by hour/day
- [ ] Prediction v3 — SageMaker regression model
- [ ] CloudFront + custom domain for HTTPS
- [ ] QR-code queue joining
- [ ] Business analytics dashboard

## 🧑‍💻 Author

**Pradumn Saindane** — [GitHub](https://github.com/Pradumnsaindane)

Built for **[AWS First Commit](https://wemakedevs.org/aws/first-commit)** by WeMakeDevs × AWS.

## 📄 License

MIT — free to use, modify, and build on.

---

<div align="center">
<sub>If this helped you, a ⭐ on the repo is appreciated.</sub>
</div>
