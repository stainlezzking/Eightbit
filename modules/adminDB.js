const {adminCollection,investors, confirmCollection} = require("./DB.js")

const {SendEmail} = require("./automate-email.js")



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
                    if(obj.status == "approved"){
                        investors.updateOne({username:obj.username},
                            {"account.ballance": Number(data.account.ballance) + Number(obj.amount) ,"account.deposits": data.account.deposits})
                        .then(()=>{
                            html = `
                            <body>
                            <div style="text-align: center; padding:10px 20px;">
                              <h2> Hey ${data.name}</h2>
                              <p> Your deposit of </p>
                              <h1 style="font-size: bold;"> $${obj.amount}</h1>
                              <p> Status : <span style="color: green" > Confirmed </span></p>
                              <p style="margin-bottom: 20px;"> Your deposit of ${obj.amount} has been confirmed and balance updated, you can go ahead and invest in the plans of your choice now </p>
                              <div stylre="text-align: center; padding: 20px;"> 
                              <img width="100%" height="auto" src="https://www.eightbit-miners.com/static/email_file/CREDIT.jpg" />
                              </div>
                              <p>
                               visit your <a href="https://www.eightbit-miners.com/dashboard" >account </a>
                            </p>
                            </div>
                          </body>
                            `
                            SendEmail(data.email,html, "your Deposit of $"+obj.amount+ " has been confirmed" )
                            .catch(err=> err? console.log("error occured trying to sendemail in confirmationSlips"): console.log("email sent successfully "))
                        //   update referral id account
                            if(data.referralAccount){
                                // find the investor with that referral id 
                                investors.findOne({referralId : data.referralAccount })
                                .then((info)=>{
                                        return investors.updateOne({username : info.username},
                                             {"account.ballance": Number(info.account.ballance) + Math.ceil(Number(obj.amount) *0.05)})
                                })
                            }
                        })
                    }else {
                        // fake transaction
                        investors.findOneAndUpdate({username:obj.username},
                            {"account.deposits": data.account.deposits}, function(err, data){
                                if(err){
                                    console.log("the error gotten is "+ err)
                                }else{
                                    html =`
                                    <body>
                                    <div style="text-align: center; padding:10px 20px;">
                                      <h2> Hey ${data.name}</h2>
                                      <p> Your deposit of </p>
                                      <h3 style="font-size: bold;"> $${obj.amount}</h3>
                                      <p> Status : <span style="color: red" > Failed </span></p>
                                      <div stylre="text-align: center; padding: 20px;"> 
                                      <img width="150px" height="150px" src="https://www.eightbit-miners.com/static/images/favicon.png" />
                                      </div>
                                      <p style="margin-bottom: 20px;"> Your deposit of ${obj.amount} has been crosschecked and declined, please note that this maybe as 
                                      a result of the wrong picture being uploaded, visit the site and try uploading the correct receipt (screenshot), also note that
                                      too many attempts of uploading the wrong receipt could lead to your account being suspended or even banned.
                                      </p>
                                      <p> rememeber you can always speak to our customer care if you have questions, visit your <a href="https://www.eightbit-miners.com/dashboard"> dashboard </a> to speak to one
                                      or reach us through email at support@eightbit-miners.com </p>
                                      <p>
                                      visit your   <a href="https://www.eightbit-miners.com/dashboard" >account </a>
                                    </p>
                                    </div>
                                  </body>
                                    `
                                    SendEmail(data.email,html, "your Deposit of $"+obj.amount+ " has been Declined" )
                                    .catch(err=> err? console.log("error occured trying to sendemail in confirmationSlips"): console.log("email sent successfully "))

                                    console.log("declined deposits confirmation history updated "+ data)
                                }
                            })
                    }
  
                })
            })
            .catch(err=> console.log("an error occured while trying to confirm SLip in confirmOrDeleteSlips function ", err))
        }
        if(obj.action == "delete"){
            return confirmCollection.deleteOne({identifier : obj.identifier})
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
confirmWithdrawal = async function(req){

   if(req.body.action == "confirm"){
       return investors.findOneAndUpdate({"account.withdrawals._id": req.body.id},{"account.withdrawals.$.approved": true,
        "account.withdrawals.$.status": "complete"})
       .then(data=>{
        activeWithdrawal = data.account.withdrawals.find(each=> each._id == req.body.id)
           html =          `
           <body>
           <div style="text-align: center; padding:10px 20px;">
             <h2> Hey ${data.name}</h2>
             <p>
              Your application for withdrawal of<span style = "font-weight : bold"> $${activeWithdrawal.amount}</span> has been approved and 
              and credited to your account ${data.walletAddress},
              <p style="margin: 15px 0;"> 
               the transaction id ${activeWithdrawal._id}
               </p>
             </p>
             <div stylre="text-align: center; padding: 20px;"> 
             <img width="100%" height="auto" src="https://www.eightbit-miners.com/static/email_file/withdraw.jpg" />
             </div>
             <p style="margin-bottom: 20px;"> thank you for using our services  </p>
             <p>
             visit your  <a href="https://www.eightbit-miners.com/dashboard" >account </a>
           </p>
           </div>
         </body>
           `
         SendEmail(data.email, html, "Eightbit Transaction Alert (withdrawal)").then(dat=>{
        console.log("email sent to " + data.email, dat)
         })
       })
       .catch(err=> console.log("the error you got is ", err))
   }
   if(req.body.action == "decline"){
    return investors.findOneAndUpdate({"account.withdrawals._id": req.body.id},{"account.withdrawals.$.approved": true,
     "account.withdrawals.$.status": "declined"})
    .then(data=> {
        activeWithdrawal = data.account.withdrawals.find(each=> each._id == req.body.id)
        html =          
        `
        <body>
        <div style="text-align: center; padding:10px 20px;">
          <h2> Hello ${data.name}</h2>
          <p>
          we are sorry to inform you that your application for withdrawal of<span style = "font-weight : bold"> $${activeWithdrawal.amount}</span> 
          with transaction id of ${activeWithdrawal._id} has been declined, as you did not meet the 
          requirements for this withdrawal, please contact our care service on your dashboard for more 
          infomation on how to complete your withdrawal or through email at support@eightbit-miners.com.
        
          <p style="margin: 15px 0;"> 
             we are sorry for the inconvenience this might have caused you.
            </p>
          </p>
          <div stylre="text-align: center; padding: 20px;"> 
          <img width="100%" height="auto" src="https://www.eightbit-miners.com/static/email_file/decline.png" />
          </div>
          <p style="margin-bottom: 20px;"> thank you for using our services  </p>
          <p>
          visit your  <a href="https://www.eightbit-miners.com/dashboard" >account </a>
        </p>
        </div>
      </body>
        `
        SendEmail(data.email, html, "Eightbit Transaction Alert (withdrawal)")
        .then(dat=>{
         console.log("email sent to " + data.email, dat)
          })
    })
    .catch(err=> console.log("the error you got is ", err))
}
    // else if not both decline or confirm
throw " your response has to be either decline or confirm"
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