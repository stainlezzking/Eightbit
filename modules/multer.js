const path = require("path")
const {confirmCollection, depositHistory} = require("./DB.js")
const multer = require("multer")
const fs = require("fs")
const {SendEmail} = require("./automate-email")

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null,path.join('./uploads'))
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)  + '-'
      cb(null, uniqueSuffix + file.originalname)
    }
})

limits = {
    fileSize: 2000000
}

function fileFilter(req,file, cb){
    if(!file.mimetype.includes('image')){
      return  cb(new Error('file must be an image'), false)
    }
    
    return cb(null, true)
    
}
const upload = multer({storage,limits,fileFilter}).single('receipt')

function storeAndredirect(req,res){

  const file = fs.readFileSync(req.file.path)
  doc = {
    imageBlob : file,
    mimeType : req.file.mimetype,
    username : req.user.username,
    amount : req.body.amount,
    identifier : Math.ceil(Math.random()*10000000000000).toString(16)
}
  confirmCollection.create(doc)
  .then((success, err)=>{
      if(err){
          console.log("this error occure while saving image doc",err)
          req.flash("error", "file size too large")
         return res.redirect("/confirm")
      }if(success){
          depositHistory(req.user,req.body.amount,doc.identifier).then(data=>{
            // send email to customer from here that there deposit is awaiting confirmation
              req.flash("error", "your file was successfully received. we will update your ballance after validation")
              html =`
              <body>
              <div style="text-align: center; padding:10px 20px;">
                <h2> Hey ${req.user.name}</h2>
                <p> Your deposit of </p>
                <h3 style="font-weight: bold;"> $${req.body.amount}</h3>
                <p> Status : <span style="color: red" > Pending </span></p>
                <div stylre="text-align: center; padding: 20px;"> 
                <img width="150px" height="150px" src="https://www.eightbit-miners.com/static/images/favicon.png" />
                </div>
                <p style="margin-bottom: 20px;"> Has been received and awaiting confirmation, your account will be updated in 24 hours</p>
                <p>
                visit your   <a href="https://www.eightbit-miners.com/dashboard" >account </a>
              </p>
              </div>
            </body>
              `
              SendEmail(req.user.email, html , "Your Deposit of $"+ req.body.amount + " awaiting confirmation")
              .catch(err => err ? console.log("an error occured trrrying to send email in confirmaCollection fxn") : console.log("successfully sent email"))
              return res.redirect("/confirm")
          })
      }
  })
}

//  i dont know whyy req.file is undefined here in the upload function in app
module.exports = {
    upload,
    path,
    storeAndredirect,
}