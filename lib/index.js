'use strict';

const AWS = require('aws-sdk');

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

function processQueue (event, context, callback) {
  const params = {
    QueueUrl: process.env.EVERGREEN_SQS_QUEUE
  };
  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      return callback(err);
    }
    if (!data.Messages) {
      console.log('No messages found');
      return callback();
    }
    data.Messages.forEach((message) => {
      console.log('Processing:');
      console.log(message.Body);
      lambda.invoke({
        FunctionName: process.env.EVERGREEN_LAMBDA_FUNCTION,
        Payload: message.Body
      }, (err) => {
        if (!err) {
          sqs.deleteMessage(Object.assign({
            ReceiptHandle: message.ReceiptHandle
          }, params), (e) => {
            callback(e);
          });
        }
      });
    });
  });
}

module.exports = processQueue;
