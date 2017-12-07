/*
Copyright 2017 The BioBricks Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

var Busboy = require('busboy')
var FormData = require('form-data')
var concat = require('concat-stream')
var https = require('https')
var methodNotAllowed = require('./method-not-allowed')
var parse = require('json-parse-errback')
var publish = require('../publish')
var pump = require('pump')
var saveFeedback = require('../util/save-feedback')
var stringToStream = require('string-to-stream')
var through2 = require('through2')

var publishForm = require('./publish-form')

function get (request, response, configuration, errors) {
  response.setHeader('Content-Type', 'text/html; charset=UTF-8')
  response.end(
    publishForm(configuration, errors)
  )
}

// TODO:  Refactor.
function post (request, response, configuration) {
  var parser
  /* istanbul ignore next */
  try {
    // TODO:  Give busboy file count and size limits.
    parser = new Busboy({ headers: request.headers })
  } catch (error) {
    response.statusCode = 400
    response.end()
    return
  }
  var fields = {}
  var feedback
  var through = through2.obj()
  pump(
    through,
    publish(configuration, request.log, function (digest) {
      var location = configuration.base + 'publications/' + digest
      response.statusCode = 201
      response.setHeader('Content-Type', 'text/html; charset=UTF-8')
      response.setHeader('Location', location)
      response.end(redirectTo(location))
    }),
    function (error) {
      if (error) {
        request.log.error(error)
        response.statusCode = error.statusCode || 500
        response.end()
      }
    }
  )
  request.pipe(
    parser
      .on('field', function (field, value) {
        if (value.length === 0) return
        if (field.endsWith('[]')) {
          field = field.substring(0, field.length - 2)
          if (fields[field] && Array.isArray(fields[field])) {
            fields[field].push(value)
          } else {
            fields[field] = [value]
          }
        } else if (configuration.feedback && field === 'feedback') {
          feedback = value
        } else {
          fields[field] = value
        }
      })
      .on('file', function (field, file, filename, encoding, mimetype) {
        through.write({
          type: 'attachment',
          stream: file,
          filename: filename,
          encoding: encoding,
          mimetype: mimetype
        })
      })
      .once('finish', function () {
        var captchaResponse = fields['g-recaptcha-response']
        delete fields['g-recaptcha-response']
        verifyCatpcha(
          captchaResponse, configuration.recaptcha.secret,
          function (error, success) {
            /* istanbul ignore if */
            if (error) {
              response.statusCode = 500
              response.end()
              through.end()
            /* istanbul ignore next */
            } else if (success === false) {
              response.statusCode = 400
              response.end('invalid captcha')
              through.end()
            } else {
              normalize(fields)
              saveFeedback(configuration.directory, [
                'Name: ' + JSON.stringify(fields.name || 'none'),
                'Affiliation: ' + JSON.stringify(fields.affiliation || 'none'),
                'Title: ' + fields.title,
                'Feedback: ' + feedback,
                '---'
              ].join('\n') + '\n', function (error) {
                if (error) request.log.error(error)
              })
              // Turn sequences[] data into attachments.
              if (fields.sequences && Array.isArray(fields.sequences)) {
                fields.sequences.forEach(function (sequence, index) {
                  through.write({
                    type: 'attachment',
                    stream: stringToStream(sequence),
                    filename: 'sequence' + index + '.fasta',
                    encoding: 'UTF-8',
                    mimetype: 'chemical/fasta'
                  })
                })
              }
              delete fields.sequences
              // Write the publication.
              through.write(fields)
              through.end()
            }
          }
        )
      })
  )
}

/* istanbul ignore next */
function verifyCatpcha (response, secret, callback) {
  if (process.env.NODE_ENV === 'test') {
    process.nextTick(function () {
      callback(null, true)
    })
  } else if (typeof response === 'string') {
    var form = new FormData()
    form.append('response', response)
    form.append('secret', secret)
    form.pipe(
      https.request({
        method: 'POST',
        host: 'www.google.com',
        path: '/recaptcha/api/siteverify',
        headers: form.getHeaders()
      }, function (response) {
        response.pipe(concat(function (body) {
          parse(body, function (error, data) {
            if (error) return callback(error)
            callback(null, data.success)
          })
        }))
      })
    )
  } else {
    process.nextTick(function () {
      callback(null, false)
    })
  }
}

module.exports = function (request, response, configuration) {
  var method = request.method
  if (method === 'GET') {
    get(request, response, configuration)
  } else if (request.method === 'POST') {
    post(request, response, configuration)
  } else {
    methodNotAllowed(response)
  }
}

function redirectTo (location) {
  return `
    <!doctype html>
    <html>
      <head>
        <title>Redirecting&hellip;</title>
        <meta http-equiv=refresh content="0;URL='${location}'">
      </head>
      <body>
        <p>
          Redirecting to <a href=${location}>${location}</a>&hellip;
        </p>
      </body>
    </html>
  `
}

var DELETE_IF_EMPTY = ['name', 'affiliation', 'safety']

var ARRAYS = [
  'ussubjectmatter',
  'journals',
  'naturesubjects',
  'classifications'
]

var NORMALIZE_LINES = ['finding', 'safety']

function normalize (record) {
  record.metadata = {}
  ARRAYS.forEach(function (key) {
    if (record.hasOwnProperty(key) && record[key].length !== 0) {
      var list = record[key]
      delete record[key]
      record.metadata[key] = list
    }
  })
  DELETE_IF_EMPTY.forEach(function (key) {
    if (Array.isArray(record[key])) {
      record[key] = record[key].filter(function (element) {
        return element !== ''
      })
    } else if (record[key] === '') {
      delete record[key]
    }
  })
  NORMALIZE_LINES.forEach(function (key) {
    if (typeof record[key] === 'string') {
      record[key] = record[key].replace(/\r/g, '')
    }
  })
}
