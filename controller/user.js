const express = require("express");
const path = require("path");
const User = require("../model/user");
const router = express.Router();
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: "polad",
  api_key: "218846298568879",
  api_secret: "dvc_pLr_cwKh8A9_g-qqcI2SbME",
});

// Create a user
router.post(
  "/create-user",
  catchAsyncErrors(upload.single("file")),
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      const userEmail = await User.findOne({ email });

      if (userEmail) {
        const { path: filePath } = req.file;
        await cloudinary.uploader.destroy(filePath); // Delete the file from Cloudinary
        return next(new ErrorHandler("User already exists", 400));
      }

      const result = await cloudinary.uploader.upload(req.file.path); // Upload the file to Cloudinary

      const user = new User({
        name: name,
        email: email,
        password: password,
        avatar: result.secure_url, // Store the secure URL returned by Cloudinary
      });
      const activationToken = createActivationToken(user);

      const activationUrl = `http://localhost:3000/activation/${activationToken}`;

      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          message: `<p>Hello ${user.name},</p>
            <p>Please click the following link to verify your account:</p>
            <p><a href="${activationUrl}">Verify Account</a></p>
            <p>Thank you!</p>`,
        });
        res.status(201).json({
          success: true,
          message: `Please check your email (${user.email}) to activate your account!`,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Create activation token
const createActivationToken = (user) => {
  return jwt.sign({ user }, process.env.ACTIVATION_SECRET, {
    expiresIn: '5m',
  });
};

// Activate user
router.post('/activation', async (req, res, next) => {
  try {
    const { activation_token, activated } = req.body;

    const decodedToken = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);

    if (!decodedToken || decodedToken.activated) {
      return next(new ErrorHandler('Invalid or expired token', 400));
    }
    const { user } = decodedToken;

    let existingUser = await User.findOne({ email: user.email });

    if (existingUser) {
      return next(new ErrorHandler('User already exists', 400));
    }

    const newUser = new User({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      password: user.password,
      activated: true, // Set the activated property to true
    });

    await newUser.save(); // Save the user to the database

    sendToken(newUser, 201, res);
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// login user
router.post(
  "/login-user",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {  //when one or both of email and passsword is incorrect, it returns error
        return next(new ErrorHandler("Please provide the all fields!", 400));
      }

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User doesn't exists!", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      sendToken(user, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get user
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// log out user
router.get(
  "/logout",
  catchAsyncErrors(async (req, res, next) => {
    try {
      res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
      });
      res.status(201).json({
        success: true,
        message: "Log out successful!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password, phoneNumber, name } = req.body;

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      user.name = name;
      user.email = email;
      user.phoneNumber = phoneNumber;

      await user.save();

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  upload.single("image"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const existsUser = await User.findById(req.user.id);

      // Delete the existing avatar image from Cloudinary
      await cloudinary.uploader.destroy(existsUser.avatar);

      // Upload the new avatar image to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);

      // Update the user document with the new avatar URL
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: result.secure_url },
        { new: true }
      );

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user addresses
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      const sameTypeAddress = user.addresses.find(
        (address) => address.addressType === req.body.addressType
      );
      if (sameTypeAddress) {
        return next(
          new ErrorHandler(`${req.body.addressType} address already exists`)
        );
      }

      const existsAddress = user.addresses.find(
        (address) => address._id === req.body._id
      );

      if (existsAddress) {
        Object.assign(existsAddress, req.body);
      } else {
        // add the new address to the array
        user.addresses.push(req.body);
      }

      await user.save();

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete user address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.id;

      console.log(addressId);

      await User.updateOne(
        {
          _id: userId,
        },
        { $pull: { addresses: { _id: addressId } } }
      );

      const user = await User.findById(userId);

      res.status(200).json({ success: true, user });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user password
router.put(
  "/update-user-password",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select("+password");

      const isPasswordMatched = await user.comparePassword(
        req.body.oldPassword
      );

      if (!isPasswordMatched) {
        return next(new ErrorHandler("Old password is incorrect!", 400));
      }

      if (req.body.newPassword !== req.body.confirmPassword) {
        return next(
          new ErrorHandler("Password doesn't matched with each other!", 400)
        );
      }
      user.password = req.body.newPassword;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Password updated successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// find user information with the userId
router.get(
  "/user-info/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all users --- for admin
router.get(
  "/admin-all-users",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const users = await User.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        users,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete users --- admin
router.delete(
  "/delete-user/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return next(
          new ErrorHandler("User is not available with this id", 400)
        );
      }

      await User.findByIdAndDelete(req.params.id);

      res.status(201).json({
        success: true,
        message: "User deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;


/*
======NOTE======

The code defines various routes for user-related functionalities such as creating a new user, logging in, updating user information, managing user addresses, updating the user avatar, and handling administrative tasks.

1. Create User Route (/create-user):
  This route is used to create a new user.
  The route expects a POST request with the user's name, email, password, and an optional file (avatar image) uploaded through a form.
  It checks if the provided email already exists in the database. If it does, it returns an error indicating that the user already exists and deletes the uploaded avatar image from Cloudinary.
  If the user is new, it uploads the avatar image to Cloudinary and saves the user's information, including the avatar URL, in the database.
  It also sends an activation email to the user with an activation link to verify the account.
  
2.  Create Activation Token Function (createActivationToken):
  This function is called during the user creation process to generate an activation token.
  The token is signed using JWT (JSON Web Token) and includes the user's information.
  The token expires after 5 minutes.

3.  Activate User Route (/activation):
  This route is used to activate the user's account when they click the activation link received in the activation email.
  It expects a POST request with the activation_token and activated fields in the request body.
  It verifies the validity and expiration of the activation token using JWT.
  If the token is valid and not expired, it checks if the user with the given email already exists in the database. If it does, it returns an error.
  If the user is new, it creates and saves the user with the activated property set to true, indicating the account is now active.

4.  Login User Route (/login-user):
  This route is used to authenticate and log in a user.
  It expects a POST request with the user's email and password.
  If the provided email is not found in the database, it returns an error indicating that the user doesn't exist.
  It then compares the provided password with the hashed password stored in the database using the comparePassword method of the User model.
  If the password is correct, it generates and sends an authentication token to the client.

5.  Get User Route (/getuser):
  This route is used to fetch the information of the currently logged-in user.
  It expects a GET request and requires authentication (isAuthenticated middleware).
  It retrieves the user information from the database based on the user ID stored in the authentication token.

6.  Logout User Route (/logout):
  This route is used to log out the user by clearing the authentication token.
  It expects a GET request and clears the token by setting it to null.

7.  Update User Info Route (/update-user-info):
  This route is used to update the user's information such as email, password, phoneNumber, and name.
  It expects a PUT request and requires authentication (isAuthenticated middleware).
  It finds the user in the database based on the provided email, validates the old password, and then updates the user's information.

8.  Update User Avatar Route (/update-avatar):
  This route is used to update the user's avatar (profile picture).
  It expects a PUT request with the new avatar image uploaded through the image field.
  It requires authentication (isAuthenticated middleware) and uploads the new avatar image to Cloudinary, replacing the existing one.

9.  Update User Addresses Route (/update-user-addresses):
  This route is used to update or add addresses for the user.
  It expects a PUT request and requires authentication (isAuthenticated middleware).
  It checks if an address with the same type already exists for the user and either updates the existing address or adds a new one.
  Delete User Address Route (/delete-user-address/:id):

10. This route is used to delete a specific address of the user.
  It expects a DELETE request and requires authentication (isAuthenticated middleware).
  It removes the address with the specified ID from the user's addresses array.

11. Update User Password Route (/update-user-password):
  This route is used to update the user's password.
  It expects a PUT request and requires authentication (isAuthenticated middleware).
  It verifies the old password, checks if the new password matches the confirmation, and then updates the user's password.

12. Find User Information Route (/user-info/:id):
  This route is used to find and retrieve user information by providing the user ID.
  It expects a GET request and can be used to fetch user details for display in public profiles.

13. Get All Users Route (/admin-all-users):
  This route is used to retrieve a list of all users and their information (only for admin users).
  It expects a GET request and requires authentication (isAuthenticated middleware) and that the user has an "Admin" role.

14.  Delete User Route (/delete-user/:id):
  This route is used to delete a specific user account (only for admin users).
  It expects a DELETE request and requires authentication (isAuthenticated middleware) and that the user has an "Admin" role.

*/


/*router.post('/create-user', upload.single('file'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const userEmail = await User.findOne({ email });

    if (userEmail) {
      const filename = req.file.filename;
      const filePath = path.join('uploads/', filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ message: 'Error deleting file' });
        }
      });
      return next(new ErrorHandler('User already exists', 400));
    }
    const filename = req.file.filename;
    const fileUrl = path.join('uploads/', filename);

    const user = new User({
      name: name,
      email: email,
      password: password,
      avatar: fileUrl,
    });

    const activationToken = createActivationToken(user);

    const activationUrl = `http://localhost:3000/activation/${activationToken}`;

    await user.save(); // Save the user to the database

    try {
      await sendMail({
        email: user.email,
        subject: 'Activate your account',
        message: `<p>Hello ${user.name},</p>
        <p>Please click the following link to verify your account:</p>
            <p><a href="${activationUrl}">Verify Account</a></p>
            <p>Thank you!</p>`,
      });
      res.status(201).json({
        success: true,
        message: `Please check your email (${user.email}) to activate your account!`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});*/

/*
router.post("/create-user", upload.single("file"), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const userEmail = await User.findOne({ email });

    if (userEmail) {
      const filename = req.file.filename;
      const filePath = `uploads/${filename}`;
      fs.unlink(filePath, (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ message: "Error deleting file" });
        }
      });
      return next(new ErrorHandler("User already exists", 400));
    }

    const filename = req.file.filename;
    const fileUrl = path.join(filename);

    const user = {
      name: name,
      email: email,
      password: password,
      avatar: fileUrl,
    };

    const activationToken = createActivationToken(user);

    const activationUrl = `http://localhost:3000/activation/${activationToken}`;

    try {
      await sendMail({
        email: user.email,
        subject: "Activate your account",
        message: `<p>Hello ${user.name},</p>
            <p>Please click the following link to verify your account:</p>
            <p><a href="${activationUrl}">Verify Account</a></p>
            <p>Thank you!</p>`
      });
      res.status(201).json({
        success: true,
        message: `please check your email:- ${user.email} to activate your account!`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// create activation token
const createActivationToken = (user) => {
  return jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: "5m",
  });
};

// activate user
router.post(
  "/activation",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { activation_token } = req.body;

      const newUser = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newUser) {
        return next(new ErrorHandler("Invalid token", 400));
      }
      const { name, email, password, avatar } = newUser;

      let user = await User.findOne({ email });

      if (user) {
        return next(new ErrorHandler("User already exists", 400));
      }
      user = await User.create({
        name,
        email,
        avatar,
        password,
      });

      sendToken(user, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);
*/

/*router.put(
  "/update-avatar",
  isAuthenticated,
  upload.single("image"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const existsUser = await User.findById(req.user.id);

      const existAvatarPath = `uploads/${existsUser.avatar}`;

      fs.unlinkSync(existAvatarPath);

      const fileUrl = path.join(req.file.filename);

      const user = await User.findByIdAndUpdate(req.user.id, {
        avatar: fileUrl,
      });

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);
*/