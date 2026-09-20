const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TICKETS_TABLE = process.env.TICKETS_TABLE;
const SERVICES_TABLE = process.env.SERVICES_TABLE;

exports.handler = async (event) => {
  const { serviceId, ticketId } = event.pathParameters;

  const ticket = (await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { serviceId, ticketId } }))).Item;
  if (!ticket) return { statusCode: 404, body: JSON.stringify({ error: 'Ticket not found' }) };

  const svc = (await ddb.send(new GetCommand({ TableName: SERVICES_TABLE, Key: { serviceId } }))).Item;
  const items = (await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    KeyConditionExpression: 'serviceId = :s',
    ExpressionAttributeValues: { ':s': serviceId }
  }))).Items || [];

  const peopleAhead = items.filter(t => t.status === 'WAITING' && t.joinedAt < ticket.joinedAt).length;
  const estimatedWaitMinutes = ticket.status === 'WAITING'
    ? Math.round((peopleAhead * svc.avgServiceTime) / Math.max(svc.activeCounters, 1))
    : 0;

  return {
    statusCode: 200,
    body: JSON.stringify({ token: ticket.token, status: ticket.status, peopleAhead, estimatedWaitMinutes })
  };
};
