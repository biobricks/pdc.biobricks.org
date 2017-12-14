/*
Copyright 2017 Kyle E. Mitchell

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
var methodNotAllowed = require('./method-not-allowed')

var publishForm = require('./publish-form')

var TYPE_HEADERS = {
  Promoter: 'The submission is a promoter.',
  RBS: 'The submission is a ribosome-binding site.',
  CDS: 'The submission is a coding DNA sequence.',
  Terminator: 'The submission is a transcription terminator.'
}

function post (request, response, configuration) {
  var parser
  /* istanbul ignore next */
  try {
    parser = new Busboy({headers: request.headers})
  } catch (error) {
    response.statusCode = 400
    response.end()
    return
  }
  var values = {
    sequences: []
  }
  var FIELDS = ['first', 'last', 'type', 'description', 'secret']
  request.pipe(
    parser
      .on('field', function (field, value) {
        if (value.length === 0) return
        if (FIELDS.indexOf(field) !== -1) values[field] = value
        else if (field === 'sequences[]') values.sequences.push(value)
      })
      .once('finish', function () {
        if (values.secret !== configuration.tenkgenes.secret) {
          response.statusCode = 400
          response.end('unauthorized')
        } else {
          // Prepend a standard type header identification to
          // the description.
          if (TYPE_HEADERS.hasOwnProperty(values.type)) {
            values.description = (
              TYPE_HEADERS[values.type] + '\n\n' +
              values.description
            )
          }
          response.setHeader('Content-Type', 'text/html; charset=UTF-8')
          response.end(
            publishForm(configuration, false, {
              name: values.first + ' ' + values.last,
              description: values.description,
              sequences: values.sequences
            })
          )
        }
      })
  )
}

module.exports = function (request, response, configuration) {
  if (request.method === 'POST') {
    post(request, response, configuration)
  } else {
    methodNotAllowed(response)
  }
}
