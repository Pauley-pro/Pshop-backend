const Conversation = require("../model/conversation");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const express = require("express");
const { isSeller, isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// create a new conversation
router.post(
  "/create-new-conversation",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { groupTitle, userId, sellerId } = req.body;

      const isConversationExist = await Conversation.findOne({ groupTitle });

      if (isConversationExist) {
        const conversation = isConversationExist;
        res.status(201).json({
          success: true,
          conversation,
        });
      } else {
        const conversation = await Conversation.create({
          members: [userId, sellerId],
          groupTitle: groupTitle,
        });

        res.status(201).json({
          success: true,
          conversation,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.response.message), 500);
    }
  })
);

// get seller conversations
router.get(
  "/get-all-conversation-seller/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const conversations = await Conversation.find({
        members: {
          $in: [req.params.id],
        },
      }).sort({ updatedAt: -1, createdAt: -1 });

      res.status(201).json({
        success: true,
        conversations,
      });
    } catch (error) {
      return next(new ErrorHandler(error), 500);
    }
  })
);


// get user conversations
router.get(
  "/get-all-conversation-user/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const conversations = await Conversation.find({
        members: {
          $in: [req.params.id],
        },
      }).sort({ updatedAt: -1, createdAt: -1 });

      res.status(201).json({
        success: true,
        conversations,
      });
    } catch (error) {
      return next(new ErrorHandler(error), 500);
    }
  })
);

// update the last message
router.put(
  "/update-last-message/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { lastMessage, lastMessageId } = req.body;

      const conversation = await Conversation.findByIdAndUpdate(req.params.id, {
        lastMessage,
        lastMessageId,
      });

      res.status(201).json({
        success: true,
        conversation,
      });
    } catch (error) {
      return next(new ErrorHandler(error), 500);
    }
  })
);

module.exports = router;


/*
======NOTE======
The API has four routes defined for handling conversations between users and sellers:

1. The first route handles the creation of a new conversation. 
   It expects a POST request to the endpoint /create-new-conversation. 
   It extracts the groupTitle, userId, and sellerId from the request body. 
   If a conversation with the same groupTitle exists, it returns the existing conversation, 
   otherwise, it creates a new conversation with the members array containing the userId and sellerId, and returns it.

2. The second route handles the retrieval of conversations for sellers. 
   It expects a GET request to the endpoint /get-all-conversation-seller/:id, where :id is the sellerId. 
   It retrieves all the conversations that contain the sellerId in the members array, 
   sorts them in descending order based on the updatedAt and createdAt fields, and returns them.

3. The third route handles the retrieval of conversations for users. 
   It expects a GET request to the endpoint /get-all-conversation-user/:id, where :id is the userId. 
   It retrieves all the conversations that contain the userId in the members array, 
   sorts them in descending order based on the updatedAt and createdAt fields, and returns them.

4. The fourth route handles the update of the last message in a conversation. 
   It expects a PUT request to the endpoint /update-last-message/:id, where :id is the conversationId. 
   It extracts the lastMessage and lastMessageId from the request body, 
   and updates the corresponding fields in the conversation with the given conversationId. It then returns the updated conversation.
*/