const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SERVICES_TABLE = process.env.SERVICES_TABLE;

const DEFAULTS = [
  { serviceId: 'general-consultation', name: 'General Consultation' },
  { serviceId: 'billing', name: 'Billing' },
  { serviceId: 'Meetings', name: 'Meetings' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'customer-service', name: 'Customer Service' },
  { serviceId: 'product-inquiries', name: 'Product Inquiries' },
  { serviceId: 'account-management', name: 'Account Management' },
  { serviceId: 'returns-and-exchanges', name: 'Returns and Exchanges' },
  { serviceId: 'shipping-and-delivery', name: 'Shipping and Delivery' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'sales-inquiries', name: 'Sales Inquiries' },
  { serviceId: 'complaints-and-feedback', name: 'Complaints and Feedback' },
  { serviceId: 'appointment-scheduling', name: 'Appointment Scheduling' },
  { serviceId: 'membership-services', name: 'Membership Services' },
  { serviceId: 'event-registration', name: 'Event Registration' } ,
  { serviceId: 'loyalty-programs', name: 'Loyalty Programs' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'product-support', name: 'Product Support' },
  { serviceId: 'billing-and-payments', name: 'Billing and Payments' },
  { serviceId: 'customer-feedback', name: 'Customer Feedback' },
  { serviceId: 'account-setup', name: 'Account Setup' },
  { serviceId: 'returns-and-refunds', name: 'Returns and Refunds' },
  { serviceId: 'technical-assistance', name: 'Technical Assistance' },
  { serviceId: 'service-inquiries', name: 'Service Inquiries' },
  { serviceId: 'general-support', name: 'General Support' },
  { serviceId: 'product-returns', name: 'Product Returns' },
  { serviceId: 'customer-service', name: 'Customer Service' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'billing-issues', name: 'Billing Issues' },
  { serviceId: 'product-information', name: 'Product Information' },
  { serviceId: 'account-management', name: 'Account Management' },
  { serviceId: 'returns-and-exchanges', name: 'Returns and Exchanges' },
  { serviceId: 'shipping-and-delivery', name: 'Shipping and Delivery' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'sales-inquiries', name: 'Sales Inquiries' },
  { serviceId: 'complaints-and-feedback', name: 'Complaints and Feedback' },
  { serviceId: 'appointment-scheduling', name: 'Appointment Scheduling' },
  { serviceId: 'membership-services', name: 'Membership Services' },
  { serviceId: 'event-registration', name: 'Event Registration' },
  { serviceId: 'loyalty-programs', name: 'Loyalty Programs' },
  { serviceId: 'technical-support', name: 'Technical Support' },
  { serviceId: 'product-support', name: 'Product Support' },
  { serviceId: 'billing-and-payments', name: 'Billing and Payments' },
  { serviceId: 'customer-feedback', name: 'Customer Feedback' },
  { serviceId: 'account-setup', name: 'Account Setup' },
  { serviceId: 'returns-and-refunds', name: 'Returns and Refunds' },
  { serviceId: 'technical-assistance', name: 'Technical Assistance' },
  { serviceId: 'service-inquiries', name: 'Service Inquiries' },
  { serviceId: 'general-support', name: 'General Support' },
  { serviceId: 'product-returns', name: 'Product Returns' }
];

exports.handler = async () => {
  const items = (await ddb.send(new ScanCommand({ TableName: SERVICES_TABLE }))).Items || [];
  const list = items.length ? items : DEFAULTS;
  return {
    statusCode: 200,
    body: JSON.stringify(list.map(s => ({ serviceId: s.serviceId, name: s.name })))
  };
};
