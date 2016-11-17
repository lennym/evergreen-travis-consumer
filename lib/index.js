'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

function processQueue (event, context, callback) {
  const params = {
    QueueUrl: process.env.EVERGREEN_SQS_QUEUE,
    MaxNumberOfMessages: 5
  };
  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      return callback(err);
    }
    if (!data.Messages) {
      console.log('No messages found');
      return callback();
    }

    Promise.map(data.Messages, (message) => {
      return new Promise((resolve, reject) => {
        console.log('Processing:', message.Body);
        lambda.invoke({
          FunctionName: process.env.EVERGREEN_LAMBDA_FUNCTION,
          Payload: message.Body
        }, (err, response) => {
          if (!err && !response.FunctionError) {
            console.log(`Successfully processed: ${message.Body}`);
            sqs.deleteMessage({
              QueueUrl: process.env.EVERGREEN_SQS_QUEUE,
              ReceiptHandle: message.ReceiptHandle
            }, (e) => {
              e ? reject(e) : resolve();
            });
          } else {
            err = err || new Error(`Worker errored for ${message.Body}`);
            console.log(`Worker threw error ${err.message} for ${response.errorMessage}`);
            reject(err);
          }
        });
      });
    }, { concurrency: 5 });
  });
}

module.exports = processQueue;
