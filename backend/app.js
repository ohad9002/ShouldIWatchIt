//  npm install @google/generative-ai dotenv express jsonwebtoken cookie-parser
const { GoogleGenerativeAI } = require("@google/generative-ai");
// import { GoogleAIFileManager } from "@google/generative-ai/server";
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const myRepository = require("./myRepository");

const express = require('express');
const app = express();
app.use(express.static("public"));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

var jsonwebtoken = require('jsonwebtoken');
const SECRET_KEY = 'my-secret-key-for-jwt';

// ALWAYS: 
// MAKE SURE TO ADD THOSE
//  SO YOU WONT SEE EMPTY "BODY"!
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// import fs from "fs";
const fs = require('fs');



require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.YOUR_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.YOUR_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

//-------------------------------------------------
//   This Middleware will ONLY handle Requests with route starting with 
//    /auth     
app.use('/auth', function (req, res, next) {
    console.log(`received Request for route starting with site2: 
                ${req.method} , ${req.url}`);
    // check if jwt token exists and valid,
    //   if not
    //   res.status(401).json({err:"describe whats wrong"})
    //////// const token = req.cookies.auth_token;
    const token = req.body.auth_token;

    if (!token) {
        return res.status(401).send('No token, access denied');
    }

    // Verify the token
    jsonwebtoken.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send('Invalid or expired token');
        }

        // if we reached here it means that the token is valid
        req.theReadToken = token;

        // Access granted, token is valid
        // res.send(`Welcome, user ID: ${decoded.userId}`);

        // if all good...
        next();
    });
});
//-------------------------------------------------
app.post("/login", async (req, res) => {
    // get the "username" and "password" from the body
    let username = req.body.username;
    let password = req.body.password;

    // send the "username" and "password" to the db to check if OK
    let result = await myRepository.checkIfUserLoginValid(username, password);

    // if not OK 
    //   res.status(401).json({err:"describe whats wrong"})
    if (result === "no") {
        res.status(401).send();
    }

    // if all good
    //  generate jwt token and return as cookie
    if (result === "yayy") {
        // Create the payload for your JWT
        const payload = { userId: '12345' };

        // Sign the JWT, setting it to expire in 2 minutes (120 seconds)
        const token = jsonwebtoken.sign(payload, SECRET_KEY, { expiresIn: '2m' });

        // Set the JWT token in a cookie with the 'HttpOnly' and 'Secure' flags (recommended for production)
        res.cookie('auth_token', token, {
            httpOnly: true, // This ensures the cookie can't be accessed via JavaScript
            secure: process.env.NODE_ENV === 'production', // Only set the cookie over HTTPS in production
            maxAge: 2 * 60 * 1000 // Cookie expires in 2 minutes (in milliseconds)
        });
        res.send("done with login")
    }

})
//===========================================================
app.post('/auth/getTheSecret', (req, res) => {
    console.log("req.theReadToken", req.theReadToken);
    res.json({ isAllGood: "yes", theSecret: "top secret!!!" })
});



//===========================================================
app.get('/simpleTextToText', async (req, res) => {
    // const prompt = "Explain how AI works";

    const prompt = `

    does any of those models ignors any part of the image it receives?:
    
    Gemini 1.0 Pro Vision: Each image accounts for 258 tokens.
Gemini 1.5 Flash and Gemini 1.5 Pro: If both dimensions of an image are less than or equal to 384 pixels, then 258 tokens are used. If one dimension of an image is greater than 384 pixels, then the image is cropped into tiles. Each tile size defaults to the smallest dimension (width or height) divided by 1.5. If necessary, each tile is adjusted so that it's not smaller than 256 pixels and not greater than 768 pixels. Each tile is then resized to 768x768 and uses 258 tokens.
Gemini 2.0 Flash: Image inputs with both dimensions <=384 pixels are counted as 258 tokens. Images larger in one or both dimensions are cropped and scaled as needed into tiles of 768x768 pixels, each counted as 258 tokens.



`
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
    res.json(result);
});
//===========================================================


app.get('/ImgLocalTextToText', async (req, res) => {
    // Converts local file information to base64
    function fileToGenerativePart(path, mimeType) {
        return {
            inlineData: {
                data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                mimeType
            },
        };
    }

    async function run() {
        const prompt = "Write an advertising jingle for business which serves whats in the images";

        const imageParts = [
            fileToGenerativePart("images/sushi.jpg", "image/jpeg"),
            fileToGenerativePart("images/seshimi.jpg", "image/jpeg"),
        ];

        const generatedContent = await model.generateContent([prompt, ...imageParts]);

        console.log(generatedContent.response.text());
        res.json(generatedContent.response);
        // res.json(generatedContent.response.text());
    }

    run();
});

//===================================================================
app.get("/publicUrlImgToText", async (req, res) => {

    const imageResp = await fetch(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Palace_of_Westminster_from_the_dome_on_Methodist_Central_Hall.jpg/2560px-Palace_of_Westminster_from_the_dome_on_Methodist_Central_Hall.jpg'
    )
        .then((response) => response.arrayBuffer());

    const result = await model.generateContent([
        {
            inlineData: {
                data: Buffer.from(imageResp).toString("base64"),
                mimeType: "image/jpeg",
            },
        },
        'do you see any statues in the image? describe them',
    ]);
    console.log(result.response.text());
    res.json(result.response);
})
//===================================================================
// for uploading files larger than 20 MB
//  we must use fileManager as follows:
app.get('/largeFilesUploadToText', async (req, res) => {
    const mediaPath = 'images';
    const uploadResult = await fileManager.uploadFile(
        `${mediaPath}/sushi.jpg`,
        {
            mimeType: "image/jpeg",
            displayName: "amazing sushi",
        },
    );
    // View the response.
    console.log(
        `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`,
    );

    const result = await model.generateContent([
        "Tell me about this image.",
        {
            fileData: {
                fileUri: uploadResult.file.uri,
                mimeType: uploadResult.file.mimeType,
            },
        },
    ]);
    console.log(result.response.text());
})





const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`listening at ${port}`);
});