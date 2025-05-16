const QRCode = require('qrcode');
const fs = require('fs');

// Create output directory
if (!fs.existsSync('./qrcodes')) {
  fs.mkdirSync('./qrcodes');
}

// Function to generate QR code
async function generateQRCode(programName) {
  // Encode parameters for the referrer
  const referrerParams = `program=${encodeURIComponent(programName)}&route=signup`;
  const encodedReferrer = encodeURIComponent(referrerParams);
  
  // Create Play Store URL with referrer
  const playStoreUrl = `https://play.google.com/store/apps/details?id=com.mynarnapp&referrer=${encodedReferrer}`;
  
  try {
    // Generate QR code
    await QRCode.toFile(
      `./qrcodes/${programName.replace(/\s+/g, '_')}.png`,
      playStoreUrl,
      {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 2,
      }
    );
    console.log(`QR code for "${programName}" generated successfully!`);
  } catch (error) {
    console.error(`Error generating QR code for "${programName}":`, error);
  }
}

// List of programs
const programs = [
  'Program A',
  'Program B',
  'Program C',
  'Special Program',
];

// Generate QR codes for all programs
programs.forEach(program => {
  generateQRCode(program);
}); 