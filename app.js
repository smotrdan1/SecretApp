//jshint esversion:6
// NOTe: the order of all the code is super important!! else the app wont work properly!
//require
require('dotenv').config();
const express= require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds=10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require('mongoose-findorcreate');


//const md5 = require("md5");
//const encrypt = require("mongoose-encryption");
//end-require

//setting up the app..
const app = express();
//console.log(process.env.API_KEY);

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended:true
}));

app.use(session({
  secret:"Our little secret.",
  resave: false,
  saveUninitialized:false
}));
// init the passport
app.use(passport.initialize());
app.use(passport.session());
//done inting the passport
//end of setting up the app

//setting up mongoose
mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser: true, useUnifiedTopology: true});
//to avoid the deprication warning
mongoose.set("useCreateIndex", true);
//setting up our Schema || notice: the full Schema set up and not a regular Json!
const userSchema = new mongoose.Schema(
{
email: String,
password: String,
googleId:
{
type: String,
unique:true
},
facebookId:
{
type: String,
unique:true
},
    secret: [{type: Array}]
});
//the heavyLifting part of operationg the cookie
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
//setting up our encyption
 //userSchema.plugin(encrypt,{secret: process.env.SECRET, encryptedFields :["password"] });
//DONE-setting up our encyption



const User= new mongoose.model("User", userSchema);
//passport use and serialize and deserialize .. in order to use passport properly
passport.use(User.createStrategy());
passport.serializeUser(function(user,done){
  done(null,user.id);
});

passport.deserializeUser(function(id,done){
  User.findById(id,function(err,user){
    done(err,user);
  })
});
//GOOGLE AUTH
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"

  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));
 // //facebook AUTH
 // passport.use(new FacebookStrategy(
 //  {
 //      clientID: process.env.FACEBOOK_CLIENT_ID,
 //      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
 //      callbackURL: "https://localhost:3000/auth/facebook/secrets",
 //      profileFields: ['id', 'displayName', 'photos', 'email'],
 //      enableProof: true
 //  },
 //
 // function(accessToken, refreshToken, profile, cb)
 //    {
 //  User.findOrCreate({ facebookId: profile.id }, function (err, user)
 //  {
 //        return cb(err, user);
 //    });
 //    }
 //  ));




//Routs
app.get("/",function(req,res){
  res.render("home");
});


//GOOGLE AUTHENTICATION
app.get("/auth/google",
passport.authenticate("google",{scope:['profile']})
);
//sign in with google
app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');

  });
//FACEBOOK AUTHENTICATION
app.get("/auth/facebook",
  passport.authenticate("facebook", {scope: ["user_friends","email"]} ));

app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(req, res)
  {
    res.redirect("/secrets");
  });


//LOGIN
app.get("/login",function(req,res){
  res.render("login");
});

app.get("/register",function(req,res){
  res.render("register");
});

//going to see secrets
app.get("/secrets",function(req,res){
User.find({"secret":{$ne:null}},function(err,foundUsers){
  if(err){
    console.log(err);
  }else{
    if(foundUsers){
      res.render("secrets",{usersWithSecrets: foundUsers});
    }
  }
});
});
//secret submit
app.get("/submit",function(req,res){
if(req.isAuthenticated()){
    res.render("submit");
}else{
  res.redirect("/login");
}

});

app.post("/submit",function(req,res){
  const submittedSecret=req.body.secret;
  User.findById(req.user._id, function(err,foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        foundUser.secret=submittedSecret;
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
})




app.post("/register", function(req,res){
   //bcrypt part
  // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    // const newUser = new User({
      // email: req.body.username,
      // password: hash
    // });
    // newUser.save(function(err){
      // if(err){
        // console.log(err);
      // }
      // res.render("secrets");
    // });
    User.register({username:req.body.username},req.body.password,function(err,user){
      if(err){
        console.log(err);
        res.redirect("/register");
      }else{
        passport.authenticate("local")(req,res,function(){
          res.redirect("/secrets");
        });
      }
    });
  });




app.post("/login", function(req,res){
////Bcrypt Par
//   const username = req.body.username;
//   const  password = req.body.password;
//     User.findOne({email: username},function(err,foundUser){
//       if(err){
//         console.log(err);
//       }else{
//         if(foundUser){
//           bcrypt.compare(password, foundUser.password, function(err, result) {
//     if(result === true){
//       res.render("secrets");
//     }
// });
//           //if(foundUser.password===password){
//             //result.render("secrets");
//           //}
//         }
//       }
//     });
const user= new User({
  username: req.body.username,
  password: req.body.password
});
req.login(user,function(err){
  if(err){
    console.log(err);
  }else{
    passport.authenticate("local")(req,res,function(){
      res.redirect("/secrets");
  });
}
});
});



app.listen(3000,function(){
  console.log("Server started on port 3000");
});
