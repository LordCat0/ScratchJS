import readline from 'node:readline/promises';
import { stdin as input, stdout as output} from 'node:process';

import {parse} from './src/jsParser.js';

const rl = readline.createInterface({ input, output });

rl.question('Enter code to tokenize:\n\n\n').then(code => {
    //Tokenize(code);
    parse(code)
    rl.close();
});