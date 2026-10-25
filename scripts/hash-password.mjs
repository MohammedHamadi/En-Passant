import bcrypt from 'bcryptjs';
import {
  stdin,
  stdout
} from 'node:process';
if (!stdin.isTTY) throw new Error('Run in an interactive terminal to enter the password privately.');
stdout.write('Admin password (hidden): ');
stdin.setRawMode(true);
stdin.resume();
let password = '';
stdin.on('data', async chunk => {
  for (const character of chunk.toString()) {
    if (character === '\u0003') {
      stdin.setRawMode(false);
      process.exit(130);
    }
    if (character === '\r' || character === '\n') {
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error(
        'Use a password between 12 and 72 bytes.');
      stdout.write((await bcrypt.hash(password, 12)) + '\n');
      return;
    }
    if (character === '\u007f') password = password.slice(0, -1);
    else password += character;
  }
});
