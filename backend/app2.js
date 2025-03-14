// npm i multer

var express = require('express');
const multer = require('multer');
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const { GoogleAIFileManager } = require("@google/generative-ai/server");
const { log } = require('console');

var app = express();
app.use(express.static('public'));

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' }); // Files will be temporarily stored in the 'uploads' folder

app.post('/uploadFile', upload.single('file'), async (req, res) => {
    console.log('====================================');
    console.log("working on it");
    console.log('====================================');
    try {
        const fs = require('fs');
        const path = require('path');

        // Access the uploaded file
        const uploadedFilePath = req.file.path;
        const mimeType = req.file.mimetype;

        // Initialize Google Generative AI
        const genAI = new GoogleGenerativeAI(process.env.YOUR_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.YOUR_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'models/gemini-2.0-flash',
            maxOutputTokens: 1256128,
        });

        // Upload the file to Google Generative AI
        const uploadResult = await fileManager.uploadFile(uploadedFilePath, {
            mimeType,
            displayName: req.file.originalname,
        });



        const myPrompt = `
        explain in 100 words the main idea of the file's text
       `


        const result = await model.generateContent([
            {
                fileData: {
                    fileUri: uploadResult.file.uri,
                    mimeType: uploadResult.file.mimeType,
                },
            },
            myPrompt,
        ]);

        const theResponse = result.response.text();
        console.log(theResponse);

        // Cleanup uploaded file from the server
        fs.unlinkSync(uploadedFilePath);

        // Send the result back to the client
        res.json({ theResultFromGemini: theResponse });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "An error occurred while processing your file." });
    }
});

//=========================
const port = process.env.PORT || 3001;

app.listen(port, function () {
    console.log(`My app is listening on port ${port}!`);
});





