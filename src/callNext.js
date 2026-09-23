const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eb = new EventBridgeClient({});
const TICKETS_TABLE = process.env.TICKETS_TABLE;
const EVENT_BUS = process.env.EVENT_BUS;

exports.handler = async (event) => {
  const { serviceId } = event.pathParameters;
  const items = (await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    KeyConditionExpression: 'serviceId = :s',
    ExpressionAttributeValues: { ':s': serviceId }
  }))).Items || [];

  const next = items.filter(t => t.status === 'WAITING').sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!next) return { statusCode: 400, body: JSON.stringify({ error: 'Queue is empty' }) };

  try {

    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { serviceId, ticketId: next.ticketId },
      UpdateExpression: 'SET #s = :serving',
      ConditionExpression: '#s = :waiting',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':serving': 'SERVING', ':waiting': 'WAITING' }
    }));
  } catch (err) {
    return { statusCode: 409, body: JSON.stringify({ error: 'Ticket already claimed, try again' }) };
  }

  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: 'queueless',
      DetailType: 'TICKET_CALLED',
      Detail: JSON.stringify({ serviceId, ticketId: next.ticketId, token: next.token }),
      EventBusName: EVENT_BUS
    }]
  }));

  return { statusCode: 200, body: JSON.stringify({ ...next, status: 'SERVING' }) };
};
