const {adminCollection,investors, confirmCollection} = require("./DB.js")




const getInvestmentsOptions = async function(){
    // put thisprocess.env.DB_ADMIN_USERin dotenv 
  var investment =  adminCollection.findOne({username: process.env.DB_ADMIN_USER},{investmentPlans: 1, _id: 0}).then(data=> data.investmentPlans)
  .catch(err=> console.log("the error happened in getInvestmentsOptions"))  
  return investment
}

const cyclePlans = async function(req,res,next){
    // function to find plans and cross check if post amount is withing plan amount and if ballance matches and then update invest db
    let plan = await getInvestmentsOptions().then(data=>{
       return data.filter(data=> data._id == req.params.planId)[0]
    })
    
    .catch(err=> {
                req.flash("error", "error finding investments in cycleFunction")
                res.redirect("/invest")
                res.end()
            })
            console.log("your plan is ", plan)
    try{
        if(Number(req.user.account.ballance) >= Number(req.body.amount)){
            if( Number(plan.min) <= Number(req.body.amount) && Number(plan.max) >= Number(req.body.amount)){
                // this is where we deduct ballance, update investment history and the maths begins
                history = {
                    amount : Number(req.body.amount),
                    profit : (Number(plan.rate)/100) * req.body.amount,
                    plan : plan.title,
                    rate : Number(plan.rate),
                    duration: plan.duration,
                    date: Date(),
                    expiry : new Date(new Date().setDate(new Date().getDate() + Number(plan.duration))),
                    sort : req.user.account.invest.length + 1,
                }
                ballance = req.user.account.ballance - Number(req.body.amount)
                investors.updateOne({_id:req.user._id}, {"account.ballance": ballance, $push : { "account.invest": history}}, function(err,success){
                    if(err){
                        console.log(err, "öccured in cyclePlans")
                        throw " something occured while trying to invest, please contact us"
                    }else{
                        // we'll update the admins investment page
                        next()
                    }
                })
            }else{
                throw "Make sure your investment amount is within the plans range"
            }
        }else{
            throw "Ballance is not sufficient for "+ plan.title +" investment"
        }
    }catch(err){
        console.log(err)
        req.flash("error", err)
        return res.redirect("/invest")
    }
}

function makeRequest(req,res,next){
        adminCollection.updateOne({username: process.env.DB_ADMIN_USER}, {
            $push :{
                requests : {
                    username : req.user.username,
                    title : req.body.title,
                    body : req.body.body
                }
            }
        }, function(err,success){
            if(err){
                console.log(" error occured while trying to send user request in makeRequest() "+ err)
                res.json({message: "sorry your request could not be completed, please report this problem"})
                res.end()
            }
            if(success){
                res.json({message: "your request was successfully submitted "})
                res.end()
            }
        })
        
}


//  for admin section

getAdminDB = async function(){
   return adminCollection.findOne({username: process.env.DB_ADMIN_USER})
   .catch(err=> console.log("error occured in getAdminDB function"))

}

getInvestors = async function(){
   return investors.find({})
   .catch(err=> console.log("error occured in getInvestors function"))
}


 deleteInvestor = async function(user_name){
   return  investors.deleteOne({username : user_name})
   .catch(err=> console.log("an error occured trying to delete user ", err))
}

editInvestor = async function(obj){
    if(!Number(obj["ballance"])){
        throw " ballance is not a number"
    }
    pass = true
    // checking if any filled was left empty
    for(prop in obj){
        console.log(obj[prop])
        if(!obj[prop].trim()){
           pass = false
           break;
        }
    }
  if(pass){
        return investors.updateOne({username : obj.username},{
            ...obj,
         //    because obj has same key value pair as the db data
            "account.ballance" : obj.ballance
        })
        .catch(err=> console.log("this occured in the editINvestor function ",err))
     }else{
        throw " Sorry but you left a filled empty a filled was empty in"
        }

}
getAllConfirmationSlips = async function(){
      return confirmCollection.find({})
            .catch(err=> console.log("this error occures in the getAllConfirmationSlips functions ", err))
}
confirmOrDeleteSlips = async function(obj){
        if(obj.action == "confirm"){
           return confirmCollection.updateOne({identifier : obj.identifier},{amount : obj.amount, confirmed : true})
            .then(()=>{
                return investors.findOne({username: obj.username}).then(data=>{
                    console.log(data.account.deposits)
                   data.account.deposits.forEach(history=>{
                        if(history.identifier == obj.identifier){
                            history.amount = obj.amount;
                            history.status = obj.status,
                            history.approved = true
                        } 
                    })
                    return data
                }).then(data=>{
                    investors.updateOne({username:obj.username},
                        {"account.ballance": Number(data.account.ballance) + Number(obj.amount) ,"account.deposits": data.account.deposits})
                //   update referral id account
                    .then(()=>{
                        if(data.referralAccount){
                            // find the investor with that referral id 
                            investors.findOne({referralId : data.referralAccount })
                            .then((info)=>{
                                    return investors.updateOne({username : info.username},
                                         {"account.ballance": Number(info.account.ballance) + Math.ceil(Number(obj.amount) *0.05)})
                            })
                        }
                    })
                })
            })
            .catch(err=> console.log("an error occured while trying to confirm SLip in confirmOrDeleteSlips function ", err))
        }
        if(obj.action == "delete"){
            return confirmCollection.deleteOne({identifier : obj.identifier}).then(()=>{
                investors.findOne({username: obj.username},{"account.deposits": 1,_id:0}).then(data=>{
                    Data = [...data.account.deposits]
                     Data.forEach(data=>{
                        if(data.identifier === obj.identifer){
                            data.amount = obj.amount;
                            data.status = obj.status,
                            data.approved = true
                        } 
                    })
                    return Data
                })
                 .then(data=>{
                        console.log(data)
                        investors.updateOne({username:obj.username},{"account.deposits": data})
                        .catch(err=> console.log("error occured in confirmOrDeleteFunctino oooo",err))
                    })
            })
            .catch(err=> console.log("there was an error trying to delete a slip in the confirmOrDeleteSlips function", err))
        }
        else{
            res.send("<h2> Invalid Action, trying to confirm or delete, which is it, stop changing the html button</h2>")
        }
}

resolveResquests = async function(req){
   return adminCollection.updateOne({"requests._id": req.body._id},{
        $set : {"requests.$.resolved" : true}
    })
    .catch(err=> console.log("error occured while trying to resolveRequest", err))
}
module.exports = {
    getInvestmentsOptions,
    cyclePlans,
    makeRequest,
    getAdminDB,
    getInvestors,
    editInvestor,
    deleteInvestor,
    getAllConfirmationSlips,
    confirmOrDeleteSlips,
    resolveResquests
}