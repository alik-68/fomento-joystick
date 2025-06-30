const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const https = require('https');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');


const app = express();
const port = 3000;
const genAI = new GoogleGenerativeAI("AIzaSyA4uynwR5RfHjoppWd4yxhjk_-4TZryZkI");


// Enable CORS for all routes
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Create HTTPS options
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Create HTTPS server
https.createServer(options, app).listen(port, '0.0.0.0', () => {
    console.log(`HTTPS Server running at https://localhost:${port}`);
    console.log(`To access from Meta Quest, use your computer's local IP address`);
    console.log(`For example: https://192.168.1.xxx:${port}`);
    console.log(`Note: You may need to accept the security warning in your browser`);
}); 