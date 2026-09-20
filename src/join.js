const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eb = new EventBridgeClient({});

const SERVICES_TABLE = process.env.SERVICES_TABLE;
const TICKETS_TABLE = process.env.TICKETS_TABLE;
const EVENT_BUS = process.env.EVENT_BUS;

const DEFAULTS = {
  'general-consultation': { name: 'General Consultation', avgServiceTime: 8, activeCounters: 3 },
  billing: { name: 'Billing', avgServiceTime: 5, activeCounters: 1 }
};

exports.handler = async (event) => {
  const { serviceId } = event.pathParameters;
  const body = event.body ? JSON.parse(event.body) : {};

  // Seed the service on first use so no manual setup step is required
  let svc = (await ddb.send(new GetCommand({ TableName: SERVICES_TABLE, Key: { serviceId } }))).Item;
  if (!svc) {
    svc = { serviceId, ticketCounter: 0, ...(DEFAULTS[serviceId] || { name: serviceId, avgServiceTime: 8, activeCounters: 1 }) };
    await ddb.send(new PutCommand({ TableName: SERVICES_TABLE, Item: svc }));
  }

  // Atomic increment via DynamoDB UpdateItem ADD -> no duplicate tokens
  // even if many people join at the same instant (the race condition
  // called out in the original build plan).
  const updated = await ddb.send(new UpdateCommand({
    TableName: SERVICES_TABLE,
    Key: { serviceId },
    UpdateExpression: 'ADD ticketCounter :one',
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW'
  }));
  const n = updated.Attributes.ticketCounter;
  const ticketId = 'T' + n;
  const token = 'A' + n;
  const joinedAt = Date.now();

  await ddb.send(new PutCommand({
    TableName: TICKETS_TABLE,
    Item: { serviceId, ticketId, token, name: body.name || 'Guest', status: 'WAITING', joinedAt }
  }));

  const items = (await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    KeyConditionExpression: 'serviceId = :s',
    ExpressionAttributeValues: { ':s': serviceId }
  }))).Items || [];

  const peopleAhead = items.filter(t => t.status === 'WAITING' && t.joinedAt < joinedAt).length;
  const estimatedWaitMinutes = Math.round((peopleAhead * svc.avgServiceTime) / Math.max(svc.activeCounters, 1));

  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: 'queueless',
      DetailType: 'TICKET_CREATED',
      Detail: JSON.stringify({ serviceId, ticketId, token }),
      EventBusName: EVENT_BUS
    }]
  }));

  return { statusCode: 200, body: JSON.stringify({ ticketId, token, peopleAhead, estimatedWaitMinutes }) };
};
