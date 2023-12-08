const express = require("express");
const router = express.Router();
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post(
  "/process",
  catchAsyncErrors(async (req, res, next) => {
    const myPayment = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: "inr",
      metadata: {
        company: "Becodemy",
      },
    });
    res.status(200).json({
      success: true,
      client_secret: myPayment.client_secret,
    });
  })
);

router.get(
  "/stripeapikey",
  catchAsyncErrors(async (req, res, next) => {
    res.status(200).json({ stripeApikey: process.env.STRIPE_API_KEY });
  })
);


module.exports = router;

/*
======NOTE======
This code defines an Express router that handles two endpoints related to Stripe payments.

1. The first endpoint is a POST endpoint at "/process" that creates a payment intent 
   with Stripe using the Stripe secret key from the environment variables. 
   The amount and currency of the payment are taken from the request body, and a metadata 
   object with the company name "pShop" is attached to the payment intent. 
   If the payment intent is successfully created, the client secret for the payment intent is returned 
   in the response with a 200 status code.

2. The second endpoint is a GET endpoint at "/stripeapikey" that returns the Stripe API key from 
  the environment variables in the response body with a 200 status code.

The catchAsyncErrors middleware function is used to catch any errors that may occur during the 
handling of the requests and pass them to the error handling middleware defined elsewhere.

*/