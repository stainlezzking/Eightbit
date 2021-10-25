const express = require("express")
require('dotenv').config()
const {saveNewUser,checkBallance,withdrawAndUpdateHistory,markMessageAsViewed,depositHistory, adminCollection,investors} = require("./modules/DB.js")
const {getInvestmentsOptions,cyclePlans, makeRequest, getAdminDB,editInvestor,getInvestors,resolveResquests, deleteInvestor,getAllConfirmationSlips,confirmOrDeleteSlips} = require("./modules/adminDB.js")
const {upload,path,storeAndredirect} = require("./modules/multer.js")
const app = express()
const bodyParser = require("body-parser")
const passport = require("passport")
const session = require("express-session")
const multer = require("multer")
const localStrategy = require("passport-local").Strategy
const fs = require("fs")

app.use("/admin", express.static(__dirname + "/public/admin"))
passportLocal = require("passport-local")
// express flash is to display error
const flash = require("express-flash")

app.use(flash())
app.use(session({
    secret : "any fucking string",
    //secret :secretKey.session_key,
    resave : false,
    saveUninitialized : false,
    cookie : {
        maxAge : 1000  * 60 * 60 * 24 
    }
   
}))

app.use(passport.initialize())

app.use(passport.session())


passport.serializeUser((user,done)=>{
    done(null,{id :user._id, admin : user.admin})
})

passport.deserializeUser((user,done)=>{
    if(user.admin){
       return adminCollection.findById(user.id)
        .then(user=>{
            if(user){
                return done(null,user)
            }
        })
    }
    investors.findById(user.id)
    .then(user=>{
        if(user){
           return done(null,user)
        }
    })
})
 
passport.use("user-account",
    new localStrategy((user,password,done)=>{
        investors.findOne({username: user.toLowerCase()}, function(err,data){
            if(data){
                // i dont know whhy but the tutorial used try, catch maybe its to handle the error
                try{
                    if(data.password === password){
                        return done(null,data)
                    }else{
                        return done(null, false, {message : "password incorrect, try again"})
                    }
                }catch(err){
                    done(err)
                }
            }
            if(!data){
                return done(null, false, {message : "no user found, if you don't have an account, register one"})
            }
 
        })
    })
)

// auth for admins
passport.use("admin-account",
    new localStrategy((user,password,done)=>{
        adminCollection.findOne({username: user.toLowerCase()}, function(err,data){
            if(!data){
                return done(null, false, {message : "are you sure you are at the right place, go to /login "})
            }
            if(data){
                // i dont know whhy but the tutorial used try, catch maybe its to handle the error
                try{
                    if(data.password === password){
                        return done(null,data)
                    }else{
                        return done(null, false, {message : "password incorrect"})
                    }
                }catch(err){
                    done(err)
                }
            }
 
        })
    })
)
app.use("/static",express.static("public/"))

app.set("view engine", "ejs")

app.use(bodyParser.urlencoded({extended: true}))

const authMiddleware = (req,res,next)=>{
 if(req.isAuthenticated()){
        next()
    }else{
       res.redirect("/login")
    }
}
const Assignment = async(req,res)=>{
 var investments = await getInvestmentsOptions()
 var admin = await getAdminDB();
 var referralList = await investors.find({referralAccount : req.user.referralId}).then(data => data)
      variables = {
            active : req.url,
            user : req.user,
            investments,
            show : true,
            admin,
            referralList
        }
        return variables
}

//  save their ip address during registeration

app.get("/", (req,res)=>{
    getInvestmentsOptions().then(data=>{
        res.render("home",{investments :data, show : false})
    }).catch(err=>{
        res.send("there was a problem updating the investment plans")
    })

})

app.get("/about", function(req,res){
    res.render("about")
})
app.get("/contact", function(req,res){
    res.render("contact")
})

app.get("/login", function(req,res){
    if(req.isAuthenticated()){
       return res.redirect("/dashboard")
    }else{
        res.render("login")
    }
})
app.get("/register", function(req,res){
    res.render("register")
})
app.get("/policy", function(req,res){
    res.render("policy")
})

//  profile
app.get("/dashboard",authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/dashboard", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
  
})
app.get("/profile", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/myProfile", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
 
})
app.get("/deposit", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/deposit", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
  
})
app.get("/confirm", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/confirmPayment", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
  
})
app.get("/invest", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/invest", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
  
})
app.get("/loan", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/loan", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
   
})
app.get("/withdraw", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/withdraw", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
    
})
app.get("/notifications", authMiddleware, function(req,res){
    Assignment(req,res).then(variables=>{
        res.render("profile/notification", variables)
    }).catch(err=>{
        console.log("an errow occured in the assignment function when loading up "+ req.url)
    })
    
})
app.get("/notifications/viewed/:message_id", function(req,res){
    console.log(req.user)
  return  markMessageAsViewed(req.user,req.params.message_id)
})

app.get("/logout", function(req,res){
    req.logOut()
    res.redirect("/login")
})




// App POST REQUEST 
app.post("/register",saveNewUser, passport.authenticate("user-account",{
    successRedirect : "/dashboard",
    failureRedirect : "/register",
    failureFlash : true
}))

app.post("/login", passport.authenticate("user-account",{
    successRedirect : "/dashboard",
    failureRedirect : "/login",
    failureFlash : true
}))

app.post("/deposit", function(req,res){
    const {amount,gateWay} = req.body
    const {user} = req
    res.render("profile/payment",{user, amount , gateWay})
})

app.post("/withdraw",checkBallance, function(req,res){
    const {amount, gateWay} = req.body
    const {user} = req
    if(user.account.kyc){
        return withdrawAndUpdateHistory(user,amount,gateWay,res)
    }
   return res.render("profile/withdrawalAssurance",{user,amount,gateWay})
})

app.post("/invest/:planId",cyclePlans, function(req,res){
    // function to find investment plans and check if plan is stored on the data base
        res.redirect("/invest")
})

app.post("/confirm", function(req,res){

       return upload(req, res, function (err) {
           console.log("your req.files object is", req.file)
            if (err instanceof multer.MulterError) {
                 req.flash("error", err.message)
                 console.log("an error occurded ", err)
                 return res.redirect("/confirm")
            } else if (err) {
              req.flash("error", err.message)
              console.log("an error occurded ", err)
              return res.redirect("/confirm")
            }  
            return storeAndredirect(req,res)
          })
})

app.post("/request",express.json(),makeRequest)

app.post("/contactus", function(req,res){
   
    const {email, body, name } = req.body
    console.log(req.body)
    if(body && name && email){
        // ride on
      return  adminCollection.updateOne({username : process.env.DB_ADMIN_USER}, {$push : {contactus : 
            {name ,email, body }}})
            .then(()=>{
                req.flash("error", "your message has been received, we will respond to your email in 24 hours")
                 res.redirect("/#contactus")
            })
            .catch(err=> {
                req.flash("error", "there was an error trying to deliver your message, please reach out to us  on info@Eightbitinvestment.com ")
                res.redirect("/#contactus")
            })
    }else{
             req.flash("error" , "please fill all inputs, as they are important for our response")
             res.redirect("/#contactus")
    }
})

app.post("/dashboard/:id", function(req,res){
  return  investors.updateOne({"account.invest._id": req.params.id}, {"$set" : {
        "account.invest.$.paid" : true,
        "account.invest.$.status" : "complete",
        "account.ballance" : Number(req.body.ballance) + Number(req.body.amount) + Number(req.body.profit)
    }}).then(()=>{
        res.redirect("/dashboard")
    })
    .catch(err=> {
        console.log("this error occured while trying to update account and invesmtent status")
        res.send(`
        <h2> An error occured trying to update your ballance, please report this problem to us, 
        <p> Sorry for the inconvenience </p>
        </h2>
        `)
    })
});
// try to create an event listener when an investment is made, that listenes for the investmen expiry date,
// and auto resets the status to running and updates the user amount but when the server restarts, the event 
//  listener is destroyed


const adminAuth = (req,res,next)=>{
    if(req.isAuthenticated()){
          if(req.user.admin){
              next()
          }else{
            res.redirect("/login")  
          }
       }else{
          res.redirect("/admin/login")
       }
   } 

   const getNeededVariables = async function(){
    admin = await getAdminDB();
    users = await getInvestors();
    slips = await getAllConfirmationSlips();
       return {
        admin ,
        users,
        slips
        }

   }

//  admin route
app.get("/admin/login", function(req,res){
    res.render("admin/login")
})

app.get("/admin/dashboard",adminAuth, function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/dashboard", data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})
app.get("/admin/confirm",adminAuth,function(req,res){
    // find all confirmation documents and fill
    getNeededVariables().then(data=>{
       return res.render("admin/confirmDeposits",data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})

app.get("/admin/update",adminAuth,function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/investmentPlans",data)
     })
     .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})
app.get("/admin/request",adminAuth,function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/requests", data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})

app.get("/admin/support", adminAuth,  function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/support", data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})
app.get("/admin/account", adminAuth,  function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/account", data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})

app.get("/admin/contactus", adminAuth,  function(req,res){
    getNeededVariables().then(data=>{
        return res.render("admin/contactus", data)
    })
    .catch(err=> res.send("An errror occured! trying to get "+ req.url))
})

app.get("/admin/logout", function(req,res){
    req.logOut()
    res.redirect("/admin/login")
})

//  POST ROUTE FOR ADMIN SECCTION

app.post("/admin/login", passport.authenticate("admin-account",{
    successRedirect : "/admin/dashboard",
    failureRedirect : "/admin/login",
    failureFlash : true
}))

// delete user
app.post("/admin/dashboard/delete", function(req,res){
  return deleteInvestor(req.body.username)
   .then(data =>{
       res.redirect("/admin/dashboard")
       console.log("user successfully deleted")
   })
   .catch(err=>{
       console.log("an errror occured, trying to delete user in "+ req.url)
      return res.send("an errror occured, trying to delete user in "+ req.url)
   })
    
})
// edit investors
app.post("/admin/dashboard/update", function(req,res){
    return editInvestor(req.body).then(data=>{
                  if(data) return res.redirect("/admin/dashboard")
              })
              .catch(err=>{
                  console.log("there was an error trying to update investors in edditInvestor "+ err)
                  return res.send("<h1> there was an error trying to update investors </h1> /n err :" +err)
              })
})

app.post("/admin/confirm", function(req,res){
    console.log(req.body)
   return confirmOrDeleteSlips(req.body).then(data=>{
       return res.redirect("/admin/confirm")
    })
    .catch(err=> {
        console.log("there was an error trying to confirm or delete slips "+ err)
        return res.send("<h1> there was an error trying to confirm or delete slips </h1> /n err :" +err)
    })
})

app.post("/admin/support", function(req,res){
    investors.updateOne({username:req.body.username},{
        $push : {
            notifications : {
                title : req.body.title,
                body : req.body.body
            }
        }
    }).then(data=> {
        if(data.modifiedCount < 1){
           return res.send("<h3> No user found with the username </h3>"+req.body.username)
        }
        res.redirect("/admin/support")
    })
    .catch(err=> {
        console.log("an errror occured while trying to post your message", err)
        res.send("<h1> an error occured trying to post your message "+ err)
    })
})
// post route to resolve request
app.post("/admin/request", function(req,res){
    return resolveResquests(req)
    .then(data=> res.redirect("/admin/request"))
    .catch(err=> {
        console.log("error occured while trying to resolve request", err)
        res.send("<h3> error occured while trying to resolve request </h3>")
    })
    
})
// delete investment plans
app.post("/admin/delete/:id", function(req,res){
       return  adminCollection.findOne({username: process.env.DB_ADMIN_USER},{investmentPlans:1})
        .then(data=> {
           filtered = data.investmentPlans.filter(plan=> plan._id != req.params.id)
           console.log(filtered)
           adminCollection.updateOne({username: process.env.DB_ADMIN_USER},{investmentPlans : filtered})
           .then(()=> res.redirect("/admin/update"))
        })
        .catch(err=> console.log("error occured while trying to delete plans ", err))
})

//  update investment plans
app.post("/admin/update", function(req,res){
    console.log(req.body)
        return adminCollection.updateOne({username:process.env.DB_ADMIN_USER},{$push:{investmentPlans : req.body}})
        .then(()=> res.redirect("/admin/update"))
        .catch(err=> console.log("an error occured while adding new investment plan", err))
})

app.post("/admin/account", function(req,res){
    console.log(req.body)
    if(req.body.address.trim() && req.body.gateWay){
            if(req.body.gateWay === "btc"){
               return adminCollection.updateOne({username :process.env.DB_ADMIN_USER},{"account.btc": req.body.address})
                .then(data=> res.redirect("/admin/account"))
                .catch(err=> console.log("an error occured ", err))
            }
            else if(req.body.gateWay === "etherium"){
               return adminCollection.updateOne({username :process.env.DB_ADMIN_USER},{"account.etherium": req.body.address})
                .then(data=> res.redirect("/admin/account"))
                .catch(err=> console.log("an error occured ", err))
            }
            else if(req.body.gateWay === "perfectM"){
                return adminCollection.updateOne({username :process.env.DB_ADMIN_USER},{"account.perfectM": req.body.address})
                .then(data=> res.redirect("/admin/account"))
                .catch(err=> console.log("an error occured ", err))
            }
            res.send("<h1>Seems you put a payment means that is not recognized </h1>")
              
        }
        else{
            res.send("<h1>Fill both input fields </h1>")
            res.end()
        }
})



const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
    console.log(`server runing on port ${PORT}`)
})