const express = require("express");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Shop = require("../model/shop");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller } = require("../middleware/auth");
const CoupounCode = require("../model/coupounCode");
const router = express.Router();

// create coupoun code
router.post(
  "/create-coupon-code",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const isCoupounCodeExists = await CoupounCode.find({
        name: req.body.name,
      });

      if (isCoupounCodeExists.length !== 0) {
        return next(new ErrorHandler("Coupoun code already exists!", 400));
      }

      const coupounCode = await CoupounCode.create(req.body);

      res.status(201).json({
        success: true,
        coupounCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get all coupons of a shop
router.get(
  "/get-coupon/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const couponCodes = await CoupounCode.find({ shopId: req.seller.id });
      res.status(201).json({
        success: true,
        couponCodes,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// delete coupoun code of a shop
router.delete(
  "/delete-coupon/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const couponCode = await CoupounCode.findByIdAndDelete(req.params.id);

      if (!couponCode) {
        return next(new ErrorHandler("Coupon code dosen't exists!", 400));
      }
      res.status(201).json({
        success: true,
        message: "Coupon code deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get coupon code value by its name
router.get(
  "/get-coupon-value/:name",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const couponCode = await CoupounCode.findOne({ name: req.params.name });

      res.status(200).json({
        success: true,
        couponCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;



/*
======NOTE======
This code exports an Express router object that defines routes for managing coupons for a seller's shop. It has four endpoints:

1. /create-coupon-code: A POST request that creates a new coupon code for a seller's shop. 
   It expects a request body with a name field (the coupon code name), a discount field (the discount amount), 
   and a shopId field (the ID of the shop that the coupon belongs to). 
   It checks if a coupon code with the same name already exists, and returns an error if it does. 
   If it doesn't exist, it creates a new coupon code in the database and returns it in the response.

2. /get-coupon/:id: A GET request that retrieves all the coupon codes associated with a seller's shop. 
   It expects a seller object to be attached to the request by the isSeller middleware. 
   It returns an array of coupon codes in the response.

3. /delete-coupon/:id: A DELETE request that deletes a coupon code for a seller's shop. 
   It expects a seller object to be attached to the request by the isSeller middleware and a :id parameter 
   in the URL that specifies the ID of the coupon code to be deleted. 
   If the coupon code exists, it is deleted from the database and a success message is returned. 
   If it doesn't exist, an error is returned.

4. /get-coupon-value/:name: A GET request that retrieves the value of a coupon code by its name. 
   It expects a :name parameter in the URL that specifies the name of the coupon code to be retrieved. 
   If the coupon code exists, it is returned in the response. If it doesn't exist, an error is returned.

*/