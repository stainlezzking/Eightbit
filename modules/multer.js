const path = require("path")
const {confirmCollection, depositHistory} = require("./DB.js")
const multer = require("multer")
const fs = require("fs")

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
              req.flash("error", "your file was successfully received. we will update your ballance after validation")
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