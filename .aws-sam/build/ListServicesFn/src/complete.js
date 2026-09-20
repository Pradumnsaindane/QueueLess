const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TICKETS_TABLE = process.env.TICKETS_TABLE;

exports.handler = async (event) => {
  const { serviceId } = event.pathParameters;
  const { ticketId } = JSON.parse(event.body || '{}');
  if (!ticketId) return { statusCode: 400, body: JSON.stringify({ error: 'ticketId required' }) };

  await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { serviceId, ticketId },
    UpdateExpression: 'SET #s = :c',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':c': 'COMPLETED' }
  }));

  return { statusCode: 200, body: JSON.stringify({ ticketId, status: 'COMPLETED' }) };
};
