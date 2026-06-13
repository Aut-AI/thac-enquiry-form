const qrcode = require('qrcode-terminal');

// Generate QR code for localhost:8081
const url = 'http://localhost:8081';
console.log('\n📱 Scan this QR code with Expo Go:\n');
qrcode.generate(url, { small: true }, (qr) => {
  console.log(qr);
  console.log(`\nOr manually enter: ${url}\n`);
});
