const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TICKETS_TABLE = process.env.TICKETS_TABLE;

exports.handler = async (event) => {
  const { serviceId } = event.pathParameters;
  const items = (await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    KeyConditionExpression: 'serviceId = :s',
    ExpressionAttributeValues: { ':s': serviceId }
  }))).Items || [];

  const serving = items.filter(t => t.status === 'SERVING');
  const waiting = items.filter(t => t.status === 'WAITING').sort((a, b) => a.joinedAt - b.joinedAt);

  return { statusCode: 200, body: JSON.stringify({ serving, waiting }) };
};
