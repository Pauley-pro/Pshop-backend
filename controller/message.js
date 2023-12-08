const Messages = require("../model/messages");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const express = require("express");
const cloudinary = require("cloudinary");
const router = express.Router();

// create new message
router.post(
  "/create-new-message",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const messageData = req.body;

      if (req.body.images) {
        const myCloud = await cloudinary.v2.uploader.upload(req.body.images, {
          folder: "messages",
        });
        messageData.images = {
          public_id: myCloud.public_id,
          url: myCloud.url,
        };
      }

      messageData.conversationId = req.body.conversationId;
      messageData.sender = req.body.sender;
      messageData.text = req.body.text;

      const message = new Messages({
        conversationId: messageData.conversationId,
        text: messageData.text,
        sender: messageData.sender,
        images: messageData.images ? messageData.images : undefined,
      });

      await message.save();

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message), 500);
    }
  })
);

// get all messages with conversation id
router.get(
  "/get-all-messages/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const messages = await Messages.find({
        conversationId: req.params.id,
      });

      res.status(201).json({
        success: true,
        messages,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message), 500);
    }
  })
);

module.exports = router;

/*
=======NOTE=======
The following are the routes and their functionalities in this router:

1. /create-new-message: This route creates a new message and adds it to the conversation with the specified conversation ID. 
   It expects the following fields in the request body: conversationId (ID of the conversation the message belongs to), 
   sender (sender of the message), text (content of the message), and an optional images field (for attaching images). 
   It uses the upload.single() middleware to handle file uploads. If successful, it returns a JSON object with the new message object.
2. /get-all-messages/:id: This route retrieves all messages from the conversation with the specified ID. 
   It expects the conversation ID to be provided as a URL parameter. 
   If successful, it returns a JSON object with an array of message objects.

*/
