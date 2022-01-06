const {decrypt,encrypt} = require('./lib/crypyo');
const crypto = require ('crypto')

const secret = 'xxx'
let salt = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);


const secretId = encrypt('xxx',salt);
const secretKey = encrypt('xxx',salt);

console.log('salt : ')
console.log(salt)

console.log('secretId：');

console.log(secretId);
console.log('secretKey：');

console.log(secretKey);
console.log('--------')
console.log(decrypt(secretId,salt));
console.log(decrypt(secretKey,salt));

