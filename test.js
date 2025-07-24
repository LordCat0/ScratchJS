const fs = require('fs')
const parse = require('./src/jsParser.js')

fs.readFile('./testfile.js', 'utf-8', (err, data) => {
    fs.writeFile('output.json', JSON.stringify(parse(data)), () => {})
   })