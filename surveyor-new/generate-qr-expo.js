const qrcode = require('qrcode-terminal');

// Generate QR code with exp:// protocol for Expo Go
const url = 'exp://10.100.0.4:8081';
console.log('\n📱 Try this Expo Go URL:\n');
qrcode.generate(url, { small: true }, (qr) => {
  console.log(qr);
  console.log(`\nOr manually enter in Expo Go:\n${url}\n`);
});
