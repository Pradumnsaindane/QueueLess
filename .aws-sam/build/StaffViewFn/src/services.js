const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SERVICES_TABLE = process.env.SERVICES_TABLE;

const DEFAULTS = [
  { serviceId: 'general-consultation', name: 'General Consultation' },
  { serviceId: 'billing', name: 'Billing' }
];

exports.handler = async () => {
  const items = (await ddb.send(new ScanCommand({ TableName: SERVICES_TABLE }))).Items || [];
  const list = items.length ? items : DEFAULTS;
  return {
    statusCode: 200,
    body: JSON.stringify(list.map(s => ({ serviceId: s.serviceId, name: s.name })))
  };
};
