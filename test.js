import readline from 'node:readline/promises';
import { stdin as input, stdout as output} from 'node:process';
import { inspect } from 'util';
import * as fs from 'node:fs'

import {parse} from './src/jsParser.js';

fs.readFile('./testfile.js', 'utf-8', (err, data) => {
    fs.writeFile('output.json', JSON.stringify(parse(data)), () => {})
   })