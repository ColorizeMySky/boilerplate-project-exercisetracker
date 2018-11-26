const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongo = require('mongodb');
const mongoose = require('mongoose');

const shortid = require('shortid');
const url = require('url');

mongoose.connect(process.env.MLAB_URI);

const UserSchema = mongoose.Schema;
const userSchema = new UserSchema({
  _id: {
    'type': String,
    'default': shortid.generate
  },
  username: {
    type: String,
    unique: true,
    required: true
  },
  exercise: [{
    'description': String,
    'durations': Number,
    'date': Date,
    '_id': false
  }]
});
const User = mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


//I can create a user by posting form data username to /api/exercise/new-user and returned will be an object with username and _id.
let urlencodedParser = bodyParser.urlencoded({ extended: false });
app.post('/api/exercise/new-user', urlencodedParser, function(req, res) {
  let user = new User({
    username: req.body.username
  });
  user.save(function (err, data) {
    if (err) console.log('Houston, we have a problem');    
    console.log(data);
    res.json({"username": req.body.username, "_id": data._id});
  });
});

//I can add an exercise to any user by posting form data userId(_id), description, duration, and optionally date to /api/exercise/add.
//If no date supplied it will use current date. Returned will the the user object with also with the exercise fields added.
app.post('/api/exercise/add', urlencodedParser, function(req, res) {
  let updObj = {
    'description': req.body.description,
    'durations': req.body.duration,
    'date': (req.body.date) ? req.body.date : new Date()
  }

  User.findByIdAndUpdate(req.body.userId, {$push: {'exercise': updObj}}, function (err, data) {
    if (err) console.log('Houston, we have a problem');
    
    data.save()
      .then(function(data) {
        res.json(data);
      })
      .catch(function(err) {
         res.end('Houston, we have a problem\n' + err);
      });
    
  });
  
});

//I can get an array of all users by getting api/exercise/users with the same info as when creating a user
app.get('/api/exercise/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users.map(function(user) {
      return {
        "_id": user._id,
        "username": user.username,
        "__v": user.__v
     }
    }));
  });
});

//I can retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). Return will be the user object with added array log and count (total exercise count).
app.get('/api/exercise/log', function(req, res){
  let queryUrl = url.parse(req.url).query;
  let userID = '';
  
  if(queryUrl == null) res.end('Designate your query, mortal!');
  
  //I can retrieve part of the log of any user by also passing along optional parameters of from & to or limit. (Date format yyyy-mm-dd, limit = int)  
  (/&/.test(queryUrl)) ? userID = queryUrl.split('&')[0] : userID = queryUrl;
  
  if(queryUrl.split('&').length == 1) {  
    User.findById(userID, function (err, data) {
      if(err) res.end('Houston, we have a problem\n' + err);
      else if(data == null) res.end('User not found');
      else {      
        let returnUser = JSON.parse(JSON.stringify(data));
        returnUser.count = data.exercise.length;
        res.json(returnUser);
      }
    });  
  }
  else {
    User.findById(userID, function (err, data) {
      if(err) res.end('Houston, we have a problem\n' + err);
      else if(data == null) res.end('User not found');
      else {
        let from = queryUrl.split('&')[1].replace(/-/g, ",");
        let to = queryUrl.split('&')[2].replace(/-/g, ",");
        let limit = queryUrl.split('&')[3];
        
        let returnUser = JSON.parse(JSON.stringify(data));        
        let filterExercise = returnUser.exercise.filter((item) => Date.parse(item.date) > Date.parse(from));       
        filterExercise = to ? filterExercise.filter((item) => Date.parse(item.date) < Date.parse(to)) : filterExercise;       
        filterExercise = limit ? filterExercise.slice(0, limit) : filterExercise;
       
        res.json(filterExercise);
      }
    })
  }
});



// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
