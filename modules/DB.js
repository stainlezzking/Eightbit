require('dotenv').config()

const mongoose = require("mongoose")
const countryList = require('country-list')
const md5 = require("md5")
const {SendEmail} = require("./automate-email")


mongoose.connect("mongodb+srv://"+process.env.DB_USERNAME+":"+process.env.DB_PASSWORD+"@todotest.pephm.mongodb.net/"+process.env.DB_DB+"?retryWrites=true&w=majority")
const schema = new mongoose.Schema ({
    name :{
        type : String,
        required : [true, "please put in your name"]
    },
    email : {
        type: String,
        required: [true, "please put in your email"]
    },
    username : {
        type: String,
        required:[true, "please put in your username"]
    },
    password : {
        type: String,
        required: [true, "please put in your password"]
    },
    phoneNumber : {
        type: String,
        required:[true, "please put in your phone number"]
    },
    country: {
        type : String,
        required: [true, " please select your country"],
        enum : {
            values : countryList.getNames(),
            message : "{VALUE} is not a valid country, contact us if we've made a mistake... sorry for the inconveniences"
        }

    },
    walletAddress : {
        type: String,
        required: [true," please copy in your wallet address for withdrawal"]
    },
    notifications :[{
        title: String,
        body : String,
        viewed : {
            type: Boolean,
            default : false
        }
    }],
    // this users referral ID
    referralId : String,
    referralAccount : {
        // the account that referred this account
        type : String,
        default : ""
    },
    referralList :[
        {username : String}
    ],
    account: {
        ballance : {
            default : 0.00,
            type : Number
        },
        kyc : {
            type : Boolean,
            default: true
        },
        deposits : [
            // screenShot : String means i might have to use amazon bucket or google 
            {
            amount : Number,
            date : Date,
            identifier : String ,
            status : {
                type : String,
                default: "pending"
            },
            approved : Boolean,
            sort : Number
                }
        ],
        withdrawals :[
            { 
            username : String,
            amount : Number ,
            date : Date ,
            approved : Boolean,
            status : String,
            gateWay : String,
            sort : Number
            }
            // show error and request for kyc (ssn, and all good infos) verification during withdrawal
        ],
        invest :[ {
            amount : Number,
            profit : Number,
            plan : String,
            rate : Number,
            duration : Number,
            date : Date,
            expiry: Date,
            paid : {
                type : Boolean,
                default : false
            },
            status : {
                type : String,
               default : "running"
            },
            sort: Number
        }]
    },
    ipInfo :{
        ip : String,
        loc : String,
        sim : String,
        city : String,
        ipCountry : String
    }
},
 {minimize: false, timestamps: { createdAt: 'created_at' } }
 )
// thia minimize false means mongoose will save all object properrties, even if they are empty

const adminSchema = new mongoose.Schema({
    username : String,
    password : String,
    admin: {
        type: Boolean,
        default : true
    },
    account : {
        btc : String,
        etherium : String,
        perfectM : String,
    },
    investmentPlans : [
            {
                title : String,
                min : Number,
                max : Number,
                rate: Number,
                duration: Number
            }
        ],
    requests:[
        {
            username : String,
            title : String,
            body : String,
            resolved : Boolean
        }
    ],
    contactus :[
        {
            email : String,
            name : String,
            body : String
        }
    ]

})



confirmationSchema = new mongoose.Schema({
    imageBlob : Buffer,
    mimeType : String,
    username : String,
    amount : Number,
    identifier: String,
    confirmed : {
        type : Boolean,
        default : false
    }
},{
    minimize : false,
    timestamps: { createdAt: 'created_at' }
})


const investors = mongoose.model("investor", schema)
const adminCollection = mongoose.model("admin", adminSchema)
const confirmCollection = mongoose.model("confirmations", confirmationSchema)

function saveNewUser(req,res,next){
  
    req.body.username = req.body.username.toLowerCase()
    let user = req.body
    // because mongoose would not allow anything not according to the schema to save
     skeleton = {
         ...user,
         referralId : md5(user.username),
         notifications : [
             {
                 title : "Click to view message",
                 body : " Welcome To Eightbit-miners investment platform, we are happy to accompany you on your journey to financial freedom, please note that this notification is how we reach you if we don't use the convetional email. if you have any questions please chat with our 24/7 support team on the your dashboard page",
                 viewed : false
             }
         ],
         ipInfo : {
             ...user,  
         }
     }
     var {username} = user
    //   check if a user with thae account exists
     investors.findOne({username}, function(err,data){
         try{
            if(data){
                    // if there is a user with that account
                    throw ("the username \""+username+"\" is not available")
            }else{
                investors.create(
                    skeleton
                ).then((data,err)=>{
                if(err){
                    // !!!!!! i dont really know if the try or catch will catch this error
                    throw "there was a problem registering you, please report this problem to us"
                    }
                    // send welcome email to user
                    html = `
                            <body style="background-color: black;">
                                <div style="padding : 20px; text-align:center; color:white;">
                                    <h1>Hey ${username}, Welcome to Eight bit</h1>
                                    <p> we happy to welcome you into the family and delighted to go with you on your joiurney to financial Freedom</p>
                                </div>
                                <img src="https://www.eightbit-miners.com/static/email_file/welcome.jpg"  width="100%" height="auto">
                            </body>
                            `
                         SendEmail(user.email,html,"Welcome to Eightbit Miners")
                         .catch(err=> err ? console.log("email could not be sent") : console.log("email sent to " + user.email))
                         next()
                })
            }
         }catch(err){
            //  this is me defining the error message
            console.log(err)
               req.flash("error", err) 
               return res.redirect("/register") 
         }
          
     })
   
}

function checkBallance(req,res,next){
    const {amount, gateWay} = req.body
    investors.findOne({username: req.user.username}, function(err,data){
        try{
        if(err){
             console.log(err + "occured in checkBallance function")
            throw "an error occured, please report this back to us"
        }
        if(data){
            if(data.account.ballance >= Number(amount)){
                        next()
                 }else{
                         throw "insufficient ballance"
                    }
        }
    } catch(err){
        console.log(err)
        req.flash("error", err) 
        return res.redirect("/withdraw") 
}
        
    })
    
} 
const withdrawAndUpdateHistory = async function(user,amount,gateWay,res){
   var  list = [...user.account.withdrawals,{
        username : user.username,
        amount: Number(amount),
        date: Date(),
        status : "pending",
        approved : false,
        gateWay,
        sort : user.account.withdrawals.length + 1
    }]
    investors.findOneAndUpdate({username: user.username}, {"account.ballance": (user.account.ballance - amount),"account.withdrawals": list})
    .then(data=> {
       // send email to user saying their withdraw is pending
       html = `
       <h1 style="margin-bottom : 20px"> Hey ${data.name} , </h1>

       <p style="margin-bottom : 10px;" > Your request to withdraw $${amount} from your is being processed and will be credited to your crypto wallet within 24 hours </p>
       <p> please note : that if this request was not made by you, contact our support team on your dashboard or email us at support@eightbit-miners.com
       to reverse the transaction before it is complete </p> 
       `
       SendEmail(data.email, html, "withdrawal request of $"+ amount + " has been placed")
       // this function is used to respomd
       res.render("profile/withdrawalAssurance",{user,amount,gateWay})
    })
    .catch(err=> err ? console.log("error occured while trying to update user ballance and withdrawals history", err): null)
}
function markMessageAsViewed(user,message_id){
    investors.updateOne({"notifications._id":message_id },
    {$set :{"notifications.$.viewed":true}},
        function(err,data){
            if(err){
                console.log("this error occured in markMessageAsViewed fxn "+ err)
            }else{
                console.log(data)
            }
     })
    }

const depositHistory = async function(user,money,identifier){
    var  list = [...user.account.deposits,{
        amount: Number(money),
        date : Date(),
        approved : false,
        sort : user.account.deposits.length,
        identifier,
    }]
    investors.updateOne({username : user.username },{"account.deposits": list }, function(err,success){
        if(err){
            console.log("error occured in the depositHistory when trying to update history",err)
            throw "an error occured while trying to update history"
        }
        else {
        // after updating history, i should alert the admin and create a similar obj there too  
        console.log(success, "this is the success  variable from the callback of updatOne")
        }
    })
    }

module.exports ={
    saveNewUser,
    investors,
    adminCollection,
    checkBallance,
    withdrawAndUpdateHistory,
    markMessageAsViewed,
    depositHistory,
    confirmCollection
}